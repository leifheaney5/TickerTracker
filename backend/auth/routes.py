import os
from flask import Blueprint, request, jsonify, redirect
from flask_login import login_user, logout_user, current_user

import db
import models
from auth.passwords import hash_password, verify_password, valid_password
from auth.tokens import create_token, consume_token
from auth.rate_limit import record_attempt, is_locked
from providers.email import send_verify_email, send_reset_email

_DUMMY_HASH = hash_password("x" * 12)

auth_bp = Blueprint("auth", __name__)


def _public_user(u):
    return {"id": u.id, "email": u.email, "name": u.name or "",
            "email_verified": bool(u.email_verified)}


def _base():
    base = os.environ.get("APP_BASE_URL")
    if not base:
        raise RuntimeError("APP_BASE_URL must be set (used to build verification/reset email links).")
    return base.rstrip("/")


@auth_bp.post("/signup")
def signup():
    b = request.get_json(force=True) or {}
    email = (b.get("email") or "").strip().lower()
    password = b.get("password") or ""
    name = (b.get("name") or "").strip()
    if "@" not in email or not valid_password(password):
        return jsonify({"error": "invalid email or password (min 8 chars)"}), 400
    with db.get_session() as s:
        existing = s.query(models.User).filter_by(email=email).first()
        if existing is None:
            u = models.User(email=email, name=name, password_hash=hash_password(password),
                            email_verified=False)
            s.add(u); s.commit(); uid = u.id
        else:
            uid = None  # do not reveal; do not resend for existing verified accounts
    if uid is not None:
        raw = create_token(uid, "verify", 24)
        send_verify_email(email, f"{_base()}/api/auth/verify?token={raw}")
    return jsonify({"message": "Check your email to verify your account."}), 200


@auth_bp.get("/verify")
def verify():
    raw = request.args.get("token", "")
    uid = consume_token(raw, "verify")
    if uid is None:
        return redirect(f"{_base()}/?verify=failed")
    with db.get_session() as s:
        u = s.get(models.User, uid)
        if u:
            u.email_verified = True; s.commit()
            login_user(u)
    return redirect(f"{_base()}/?verify=ok")


@auth_bp.post("/login")
def login():
    b = request.get_json(force=True) or {}
    email = (b.get("email") or "").strip().lower()
    password = b.get("password") or ""
    xff = request.headers.get("X-Forwarded-For", "")
    ip = (xff.split(",")[0].strip() if xff else "") or (request.remote_addr or "")
    if is_locked(email):
        return jsonify({"error": "too many attempts, try again later"}), 423
    with db.get_session() as s:
        u = s.query(models.User).filter_by(email=email).first()
        if u and u.password_hash:
            ok = verify_password(password, u.password_hash)
        else:
            # constant-time-ish: still run an argon2 verify against a dummy hash so a
            # missing user takes the same time as a wrong password (no enumeration).
            verify_password(password, _DUMMY_HASH)
            ok = False
        record_attempt(email, ip, ok)
        if not ok:
            return jsonify({"error": "invalid email or password"}), 401
        if not u.email_verified:
            return jsonify({"error": "please verify your email first"}), 403
        login_user(u)
        return jsonify({"user": _public_user(u)}), 200


@auth_bp.post("/logout")
def logout():
    logout_user()
    return jsonify({"message": "logged out"}), 200


@auth_bp.get("/me")
def me():
    if getattr(current_user, "is_authenticated", False):
        return jsonify({"user": _public_user(current_user)}), 200
    return jsonify({"user": None}), 200


@auth_bp.post("/forgot")
def forgot():
    b = request.get_json(force=True) or {}
    email = (b.get("email") or "").strip().lower()
    with db.get_session() as s:
        u = s.query(models.User).filter_by(email=email).first()
        uid = u.id if (u and u.password_hash) else None
    if uid is not None:
        raw = create_token(uid, "reset", 1)
        send_reset_email(email, f"{_base()}/?reset_token={raw}")
    return jsonify({"message": "If that email exists, a reset link was sent."}), 200


@auth_bp.post("/reset")
def reset():
    b = request.get_json(force=True) or {}
    raw = b.get("token") or ""
    password = b.get("password") or ""
    if not valid_password(password):
        return jsonify({"error": "password too short (min 8)"}), 400
    uid = consume_token(raw, "reset")
    if uid is None:
        return jsonify({"error": "invalid or expired token"}), 400
    with db.get_session() as s:
        u = s.get(models.User, uid)
        if not u:
            return jsonify({"error": "invalid token"}), 400
        u.password_hash = hash_password(password)
        u.email_verified = True  # proves email ownership
        s.commit()
    return jsonify({"message": "password updated"}), 200


from flask import current_app
from authlib.integrations.flask_client import OAuthError
from auth.google import oauth, upsert_google_user, is_enabled as google_is_enabled
from auth.apple import (
    is_enabled as apple_is_enabled,
    build_client_secret,
    upsert_apple_user,
    parse_apple_user_form,
)


@auth_bp.get("/providers")
def providers():
    """Return which OAuth providers are configured (for the frontend button gating)."""
    return jsonify({
        "google": google_is_enabled(),
        "apple": apple_is_enabled(),
    }), 200


@auth_bp.get("/google")
def google_login():
    if not google_is_enabled():
        return jsonify({"error": "google oauth not configured"}), 503
    return oauth.google.authorize_redirect(f"{_base()}/api/auth/google/callback")


@auth_bp.get("/google/callback")
def google_callback():
    try:
        token = oauth.google.authorize_access_token()
        info = token.get("userinfo") or {}
        sub, email, name = info.get("sub"), info.get("email"), info.get("name", "")
        if not sub or not email or not info.get("email_verified"):
            return redirect(f"{_base()}/?auth=failed")
        u = upsert_google_user(sub, email, name)
        login_user(u)
        return redirect(f"{_base()}/?auth=ok")
    except OAuthError as e:
        current_app.logger.warning("google oauth callback failed: %s", e)
        return redirect(f"{_base()}/?auth=failed")


@auth_bp.get("/apple")
def apple_login():
    if not apple_is_enabled():
        return jsonify({"error": "apple sign in not configured"}), 503
    # Apple requires form_post response_mode; the callback must be POST.
    return oauth.apple.authorize_redirect(f"{_base()}/api/auth/apple/callback")


@auth_bp.route("/apple/callback", methods=["GET", "POST"])
def apple_callback():
    """Handle Apple's form_post callback (code + state arrive in POST body)."""
    if not apple_is_enabled():
        return redirect(f"{_base()}/?auth=failed")
    try:
        # Apple requires the client_secret to be a fresh ES256 JWT per exchange.
        client_secret = build_client_secret()
        token = oauth.apple.authorize_access_token(client_secret=client_secret)

        # id_token carries the authoritative sub + email claims.
        id_token_claims = token.get("userinfo") or {}
        sub = id_token_claims.get("sub")
        email = id_token_claims.get("email")
        email_verified = id_token_claims.get("email_verified", True)

        # Apple sends user name only on the FIRST auth, in the form POST body.
        form_email, form_name = parse_apple_user_form(request.form)
        # Prefer id_token email; fall back to form-posted email.
        email = email or form_email

        if not sub:
            current_app.logger.warning("apple callback: missing sub in id_token")
            return redirect(f"{_base()}/?auth=failed")

        # Apple may mark the email as not verified for relay (private) addresses.
        # We still allow relay addresses — Apple has already authenticated the user.
        if email and email_verified is False:
            current_app.logger.info(
                "apple callback: email_verified=False for sub=%s (relay address)", sub
            )

        u = upsert_apple_user(sub, email, form_name)
        if u is None:
            current_app.logger.warning(
                "apple callback: could not find or create user for sub=%s", sub
            )
            return redirect(f"{_base()}/?auth=failed")

        login_user(u)
        return redirect(f"{_base()}/?auth=ok")
    except OAuthError as e:
        current_app.logger.warning("apple oauth callback failed: %s", e)
        return redirect(f"{_base()}/?auth=failed")
