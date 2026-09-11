"""WebAuthn / passkey endpoints for Ticker Tracker.

Feature-gated on three environment variables:
  WEBAUTHN_RP_ID      e.g. "tickertracker.info"
  WEBAUTHN_RP_NAME    e.g. "Ticker Tracker"
  WEBAUTHN_ORIGIN     e.g. "https://tickertracker.info"

When any of these is unset, or when the `webauthn` library is not installed,
all endpoints return {enabled: false} / 404 — they NEVER fake success.

Endpoints:
  GET  /api/webauthn/status               → {enabled: bool}
  POST /api/webauthn/register/begin       → creation options JSON   (auth required)
  POST /api/webauthn/register/complete    → {ok: true, label: str} (auth required)
  POST /api/webauthn/auth/begin           → request options JSON    (public)
  POST /api/webauthn/auth/complete        → {user: {...}}           (public)
  GET  /api/webauthn/credentials          → [{id, label, created_at}] (auth required)
  DELETE /api/webauthn/credentials/<cid>  → {deleted: bool}         (auth required)
"""
from __future__ import annotations

import base64
import json
import os
from datetime import datetime, timezone

try:
    import webauthn as _wn
    from webauthn.helpers.structs import (  # type: ignore[attr-defined]
        PublicKeyCredentialDescriptor,
        PublicKeyCredentialType,
    )
    _WN_OK = True
except ImportError:  # pragma: no cover
    _wn = None  # type: ignore[assignment]
    PublicKeyCredentialDescriptor = None  # type: ignore[assignment,misc]
    PublicKeyCredentialType = None  # type: ignore[assignment,misc]
    _WN_OK = False

from flask import Blueprint, request, jsonify, session, current_app
from flask_login import login_required, login_user, current_user

import db
import models

webauthn_bp = Blueprint("webauthn", __name__)


# ── Feature gate ──────────────────────────────────────────────────────────────

def _config() -> tuple[str, str, str] | None:
    """Return (rp_id, rp_name, origin) or None if not fully configured."""
    rp_id = os.environ.get("WEBAUTHN_RP_ID", "").strip()
    rp_name = os.environ.get("WEBAUTHN_RP_NAME", "Ticker Tracker").strip()
    origin = os.environ.get("WEBAUTHN_ORIGIN", "").strip()
    if not rp_id or not origin or not _WN_OK:
        return None
    return rp_id, rp_name, origin


def is_enabled() -> bool:
    return _config() is not None


def _not_enabled():
    return jsonify({"enabled": False, "error": "WebAuthn not configured on this server"}), 404


# ── Challenge session helpers ─────────────────────────────────────────────────
# Challenges are ephemeral (5-min session lifetime) and stored in the signed
# Flask session cookie (SECRET_KEY-backed). This is safe for a single-server
# deployment; swap for Redis if multi-instance.

_CHALLENGE_KEY = "_wn_challenge"
_PENDING_USER_KEY = "_wn_uid"


def _store_challenge(challenge_bytes: bytes, user_id: int | None = None) -> None:
    session[_CHALLENGE_KEY] = base64.b64encode(challenge_bytes).decode()
    if user_id is not None:
        session[_PENDING_USER_KEY] = user_id


def _pop_challenge() -> bytes | None:
    raw = session.pop(_CHALLENGE_KEY, None)
    if raw is None:
        return None
    return base64.b64decode(raw)


def _pop_pending_user_id() -> int | None:
    return session.pop(_PENDING_USER_KEY, None)


# ── Credential DB helpers ──────────────────────────────────────────────────────

def _bytes_to_b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _b64url_to_bytes(s: str) -> bytes:
    padding = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * (padding % 4))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@webauthn_bp.get("/status")
def status():
    return jsonify({"enabled": is_enabled()}), 200


@webauthn_bp.post("/register/begin")
@login_required
def register_begin():
    cfg = _config()
    if cfg is None:
        return _not_enabled()
    rp_id, rp_name, _origin = cfg

    uid = int(current_user.id)
    with db.get_session() as s:
        u = s.get(models.User, uid)
        if not u:
            return jsonify({"error": "user not found"}), 404
        # Collect already-registered credential IDs to exclude from the prompt.
        existing = s.query(models.WebAuthnCredential).filter_by(user_id=uid).all()
        exclude_creds = [
            PublicKeyCredentialDescriptor(
                id=_b64url_to_bytes(c.credential_id),
                type=PublicKeyCredentialType.PUBLIC_KEY,
            )
            for c in existing
        ]

    options = _wn.generate_registration_options(
        rp_id=rp_id,
        rp_name=rp_name,
        user_id=str(uid).encode(),
        user_name=current_user.email,
        user_display_name=current_user.name or current_user.email,
        exclude_credentials=exclude_creds,
    )

    _store_challenge(options.challenge, user_id=uid)
    options_json = _wn.options_to_json(options)
    return current_app.response_class(
        options_json, status=200, mimetype="application/json"
    )


@webauthn_bp.post("/register/complete")
@login_required
def register_complete():
    cfg = _config()
    if cfg is None:
        return _not_enabled()
    rp_id, _rp_name, origin = cfg

    challenge = _pop_challenge()
    if challenge is None:
        return jsonify({"error": "no registration challenge in session; call /begin first"}), 400

    body = request.get_json(force=True) or {}
    label = str(body.pop("label", "") or "").strip()[:64] or "Passkey"

    uid = int(current_user.id)

    try:
        verified = _wn.verify_registration_response(
            credential=body,
            expected_challenge=challenge,
            expected_rp_id=rp_id,
            expected_origin=origin,
        )
    except Exception as exc:
        current_app.logger.warning("WebAuthn register/complete failed: %s", exc)
        return jsonify({"error": "registration verification failed"}), 400

    cred_id = _bytes_to_b64url(verified.credential_id)
    pub_key = _bytes_to_b64url(verified.credential_public_key)

    with db.get_session() as s:
        # Guard against duplicate registration (race condition).
        existing = (
            s.query(models.WebAuthnCredential)
            .filter_by(credential_id=cred_id)
            .first()
        )
        if existing:
            return jsonify({"error": "credential already registered"}), 409
        s.add(models.WebAuthnCredential(
            user_id=uid,
            credential_id=cred_id,
            public_key=pub_key,
            sign_count=verified.sign_count,
            label=label,
        ))
        s.commit()

    return jsonify({"ok": True, "label": label}), 201


@webauthn_bp.post("/auth/begin")
def auth_begin():
    """Generate authentication options.

    Accepts optional JSON body {"credential_ids": ["..."]}.
    If omitted, returns empty allow_credentials (discoverable / passkey flow).
    """
    cfg = _config()
    if cfg is None:
        return _not_enabled()
    rp_id, _rp_name, _origin = cfg

    body = request.get_json(force=True, silent=True) or {}
    allow_creds = [
        PublicKeyCredentialDescriptor(
            id=_b64url_to_bytes(cid),
            type="public-key",
        )
        for cid in (body.get("credential_ids") or [])
        if isinstance(cid, str)
    ]

    options = _wn.generate_authentication_options(
        rp_id=rp_id,
        allow_credentials=allow_creds,
    )

    _store_challenge(options.challenge)
    options_json = _wn.options_to_json(options)
    return current_app.response_class(
        options_json, status=200, mimetype="application/json"
    )


@webauthn_bp.post("/auth/complete")
def auth_complete():
    cfg = _config()
    if cfg is None:
        return _not_enabled()
    rp_id, _rp_name, origin = cfg

    challenge = _pop_challenge()
    if challenge is None:
        return jsonify({"error": "no auth challenge in session; call /begin first"}), 400

    body = request.get_json(force=True) or {}

    # Extract credential_id from the response body to look up stored key.
    raw_id = body.get("rawId") or body.get("id") or ""
    if not raw_id:
        return jsonify({"error": "missing credential id in response"}), 400

    with db.get_session() as s:
        cred_row = (
            s.query(models.WebAuthnCredential)
            .filter_by(credential_id=raw_id)
            .first()
        )
        if not cred_row:
            return jsonify({"error": "unknown credential"}), 400

        pub_key_bytes = _b64url_to_bytes(cred_row.public_key)
        sign_count = cred_row.sign_count

        try:
            verified = _wn.verify_authentication_response(
                credential=body,
                expected_challenge=challenge,
                expected_rp_id=rp_id,
                expected_origin=origin,
                credential_public_key=pub_key_bytes,
                credential_current_sign_count=sign_count,
            )
        except Exception as exc:
            current_app.logger.warning("WebAuthn auth/complete failed: %s", exc)
            return jsonify({"error": "authentication verification failed"}), 400

        # Update sign count to defend against replay attacks.
        cred_row.sign_count = verified.new_sign_count
        s.commit()

        u = s.get(models.User, cred_row.user_id)
        if not u:
            return jsonify({"error": "user not found"}), 404

    login_user(u)
    return jsonify({"user": {
        "id": u.id,
        "email": u.email,
        "name": u.name or "",
        "email_verified": bool(u.email_verified),
    }}), 200


@webauthn_bp.get("/credentials")
@login_required
def list_credentials():
    uid = int(current_user.id)
    with db.get_session() as s:
        rows = (
            s.query(models.WebAuthnCredential)
            .filter_by(user_id=uid)
            .order_by(models.WebAuthnCredential.created_at)
            .all()
        )
        result = [
            {
                "id": r.credential_id,
                "label": r.label or "Passkey",
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
    return jsonify({"credentials": result}), 200


@webauthn_bp.delete("/credentials/<cred_id>")
@login_required
def delete_credential(cred_id: str):
    uid = int(current_user.id)
    with db.get_session() as s:
        row = (
            s.query(models.WebAuthnCredential)
            .filter_by(credential_id=cred_id, user_id=uid)
            .first()
        )
        if not row:
            return jsonify({"error": "credential not found"}), 404
        s.delete(row)
        s.commit()
    return jsonify({"deleted": True}), 200
