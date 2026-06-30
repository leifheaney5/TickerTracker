"""TOTP 2FA helpers and endpoints for Ticker Tracker.

Dependency: pyotp (guarded import — app still boots if missing, endpoints return 503).

Endpoints (all require @login_required unless noted):
  GET  /api/2fa/status    → {enabled: bool}
  POST /api/2fa/setup     → {secret, otpauth_uri}   (generates secret, stored encrypted)
  POST /api/2fa/verify    → {recovery_codes: [...]}  (confirms code, enables 2FA, emits codes ONCE)
  POST /api/2fa/disable   → {ok: true}               (requires valid TOTP or recovery code)

Login step (no auth; uses itsdangerous signed token, registered on auth_bp):
  POST /api/auth/2fa      → {user: {...}}             (see auth/routes.py)
"""
from __future__ import annotations

import secrets
import string
from datetime import datetime, timezone

try:
    import pyotp as _pyotp
    _PYOTP_OK = True
except ImportError:  # pragma: no cover
    _pyotp = None  # type: ignore[assignment]
    _PYOTP_OK = False

from flask import Blueprint, request, jsonify, current_app
from flask_login import login_required, current_user
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

import db
import models
from auth.passwords import hash_password, verify_password

twofactor_bp = Blueprint("twofactor", __name__)

_ISSUER = "Ticker Tracker"
_RECOVERY_CODE_COUNT = 8
_PENDING_TOKEN_MAX_AGE = 300  # seconds (5 minutes)
_TOKEN_SALT = "2fa-pending"


# ── Pure helpers (fully unit-testable with no Flask context) ──────────────────

def is_available() -> bool:
    """True if pyotp is installed and TOTP is usable."""
    return _PYOTP_OK


def generate_totp_secret() -> str:
    """Return a new random base32 TOTP secret (RFC 4648)."""
    if not _PYOTP_OK:
        raise RuntimeError("pyotp is not installed")
    return _pyotp.random_base32()


def provisioning_uri(secret: str, email: str) -> str:
    """Return the otpauth:// URI suitable for a QR code."""
    if not _PYOTP_OK:
        raise RuntimeError("pyotp is not installed")
    return _pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=_ISSUER)


def verify_totp(secret: str, code: str, valid_window: int = 1) -> bool:
    """Return True if *code* is currently valid for *secret*.

    valid_window=1 allows the immediately preceding and following 30-second
    steps to compensate for clock skew.
    """
    if not _PYOTP_OK:
        return False
    try:
        return _pyotp.TOTP(secret).verify(str(code).strip(), valid_window=valid_window)
    except Exception:
        return False


def generate_recovery_codes(n: int = _RECOVERY_CODE_COUNT) -> list[str]:
    """Generate *n* random single-use recovery codes (XXXX-XXXX-XXXX format)."""
    alphabet = string.ascii_uppercase + string.digits
    codes: list[str] = []
    for _ in range(n):
        parts = ["".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(3)]
        codes.append("-".join(parts))
    return codes


def create_pending_token(user_id: int) -> str:
    """Return a short-lived signed token encoding *user_id* for the TOTP step.

    Requires Flask application context (uses app.config["SECRET_KEY"]).
    """
    s = URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt=_TOKEN_SALT)
    return s.dumps({"uid": user_id})


def consume_pending_token(token: str) -> int | None:
    """Validate *token* and return the embedded user_id, or None if invalid/expired."""
    s = URLSafeTimedSerializer(current_app.config["SECRET_KEY"], salt=_TOKEN_SALT)
    try:
        data = s.loads(token, max_age=_PENDING_TOKEN_MAX_AGE)
        uid = data.get("uid")
        return int(uid) if uid is not None else None
    except (BadSignature, SignatureExpired):
        return None


# ── Session-level: recovery code verification + consumption ──────────────────

def verify_and_consume_recovery_code(user_id: int, code: str) -> bool:
    """Try *code* against the user's unused RecoveryCode rows (Argon2 verify).

    If a matching row is found, marks it used (single-use) and returns True.
    Runs in its own DB session so it's safe to call from within an outer block.
    """
    code_clean = code.strip().upper()
    with db.get_session() as s:
        rows = (
            s.query(models.RecoveryCode)
            .filter_by(user_id=user_id, used_at=None)
            .all()
        )
        for row in rows:
            if verify_password(code_clean, row.code_hash):
                row.used_at = datetime.now(timezone.utc)
                s.commit()
                return True
    return False


# ── Endpoints ─────────────────────────────────────────────────────────────────

@twofactor_bp.get("/status")
@login_required
def status():
    uid = int(current_user.id)
    with db.get_session() as s:
        u = s.get(models.User, uid)
        enabled = bool(u and u.totp_enabled)
    return jsonify({"enabled": enabled}), 200


@twofactor_bp.post("/setup")
@login_required
def setup():
    if not is_available():
        return jsonify({"error": "TOTP not available — pyotp not installed"}), 503
    uid = int(current_user.id)
    with db.get_session() as s:
        u = s.get(models.User, uid)
        if not u:
            return jsonify({"error": "user not found"}), 404
        # Step-up guard: do NOT let an already-enrolled user (or a hijacked
        # session) silently rotate the secret and reset totp_enabled, which would
        # knock out the victim's working 2FA without proving a current factor.
        # Re-enrolling requires disabling first (which demands a TOTP/recovery code).
        if u.totp_enabled:
            return jsonify({"error": "2FA already enabled — disable it first to re-enroll"}), 400
        secret = generate_totp_secret()
        u.totp_secret = secret   # EncryptedString transparently encrypts at rest
        u.totp_enabled = False   # not yet confirmed; setup call alone does not enable
        s.commit()
        uri = provisioning_uri(secret, u.email)
    return jsonify({"secret": secret, "otpauth_uri": uri}), 200


@twofactor_bp.post("/verify")
@login_required
def verify_endpoint():
    """Confirm the TOTP code from the user's authenticator app.

    On success: enables 2FA, stores hashed recovery codes, returns plaintext
    codes ONCE. The client must display/download these before dismissing.
    """
    if not is_available():
        return jsonify({"error": "TOTP not available — pyotp not installed"}), 503
    b = request.get_json(force=True) or {}
    code = str(b.get("code") or "").strip()
    uid = int(current_user.id)
    with db.get_session() as s:
        u = s.get(models.User, uid)
        if not u or not u.totp_secret:
            return jsonify({"error": "TOTP not set up; call /setup first"}), 400
        if u.totp_enabled:
            return jsonify({"error": "TOTP already enabled"}), 400
        if not verify_totp(u.totp_secret, code):
            return jsonify({"error": "invalid or expired code"}), 400
        u.totp_enabled = True
        # Replace any stale recovery codes for this user.
        s.query(models.RecoveryCode).filter_by(user_id=uid).delete()
        plain_codes = generate_recovery_codes()
        for c in plain_codes:
            s.add(models.RecoveryCode(user_id=uid, code_hash=hash_password(c)))
        s.commit()
    return jsonify({"recovery_codes": plain_codes}), 200


@twofactor_bp.post("/disable")
@login_required
def disable():
    """Disable TOTP for the current user.

    Requires a valid current TOTP code OR a valid (unused) recovery code.
    On success, clears the secret and deletes all recovery codes.
    """
    if not is_available():
        return jsonify({"error": "TOTP not available — pyotp not installed"}), 503
    b = request.get_json(force=True) or {}
    code = str(b.get("code") or "").strip()
    uid = int(current_user.id)
    with db.get_session() as s:
        u = s.get(models.User, uid)
        if not u or not u.totp_enabled:
            return jsonify({"error": "TOTP is not enabled"}), 400

        # Accept a valid TOTP code or a recovery code (checked in that order).
        totp_ok = bool(u.totp_secret and verify_totp(u.totp_secret, code))
        if not totp_ok:
            # verify_and_consume_recovery_code opens its own session; call before
            # we clear any state so the row still exists to match against.
            recovery_ok = verify_and_consume_recovery_code(uid, code)
        else:
            recovery_ok = False

        if not totp_ok and not recovery_ok:
            return jsonify({"error": "invalid code"}), 400

        u.totp_secret = None
        u.totp_enabled = False
        s.query(models.RecoveryCode).filter_by(user_id=uid).delete()
        s.commit()
    return jsonify({"ok": True}), 200
