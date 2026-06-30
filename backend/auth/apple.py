"""Apple Sign In OAuth/OIDC provider.

Required env vars (all four must be set together; if any is absent the provider
is not registered and the /apple routes return HTTP 503):

  APPLE_CLIENT_ID   - Services ID, e.g. "com.example.signinwithapple"
  APPLE_TEAM_ID     - 10-character team identifier from Apple Developer portal
  APPLE_KEY_ID      - Key ID of the Sign In with Apple private key (from portal)
  APPLE_PRIVATE_KEY - Full content of the .p8 file including BEGIN/END headers

Client secret: Apple requires the OAuth client_secret to be a short-lived
ES256 JWT signed with APPLE_PRIVATE_KEY. build_client_secret() produces this
JWT fresh on each token exchange (Apple enforces a 6-month maximum validity).

Response mode: Apple mandates response_mode=form_post for response_type=code,
so the /apple/callback route accepts POST (the code and state arrive in the
POST body, not query params).
"""
from __future__ import annotations

import json
import logging
import os
import time

log = logging.getLogger(__name__)

_apple_enabled = False

# Shared OAuth instance from google.py. Both providers use the same Authlib
# OAuth registry so one init_app() call covers both.
from auth.google import oauth


def _required_env() -> tuple[str, str, str, str] | None:
    """Return (client_id, team_id, key_id, private_key) or None if any is absent."""
    client_id = os.environ.get("APPLE_CLIENT_ID", "").strip()
    team_id = os.environ.get("APPLE_TEAM_ID", "").strip()
    key_id = os.environ.get("APPLE_KEY_ID", "").strip()
    private_key = os.environ.get("APPLE_PRIVATE_KEY", "").strip()
    if all((client_id, team_id, key_id, private_key)):
        return client_id, team_id, key_id, private_key
    return None


def build_client_secret() -> str:
    """Build the ES256 JWT Apple requires as the OAuth client_secret.

    Header: alg=ES256, kid=APPLE_KEY_ID
    Claims: iss=APPLE_TEAM_ID, iat=now, exp=now+6mo,
            aud=https://appleid.apple.com, sub=APPLE_CLIENT_ID

    Raises KeyError / RuntimeError when APPLE_* env vars are not set
    (callers should check is_enabled() first or catch the exception).
    """
    from cryptography.hazmat.primitives.serialization import load_pem_private_key
    from authlib.jose import jwt as jose_jwt

    team_id = os.environ["APPLE_TEAM_ID"]
    client_id = os.environ["APPLE_CLIENT_ID"]
    key_id = os.environ["APPLE_KEY_ID"]
    private_key_pem = os.environ["APPLE_PRIVATE_KEY"]

    now = int(time.time())
    header = {"alg": "ES256", "kid": key_id}
    payload = {
        "iss": team_id,
        "iat": now,
        "exp": now + 86400 * 180,  # 6 months — Apple enforced maximum
        "aud": "https://appleid.apple.com",
        "sub": client_id,
    }

    private_key = load_pem_private_key(private_key_pem.encode("utf-8"), password=None)
    token_bytes = jose_jwt.encode(header, payload, private_key)
    return token_bytes.decode() if isinstance(token_bytes, bytes) else token_bytes


def register(app) -> None:
    """Register the Apple OAuth2/OIDC client with Authlib. No-op if env is incomplete."""
    env = _required_env()
    if not env:
        return

    client_id, _team_id, _key_id, _private_key = env

    # init_app may have already been called by google.register(); calling it a
    # second time is safe (Authlib just reassigns self.app and re-registers teardown).
    if getattr(oauth, "app", None) is None:
        oauth.init_app(app)

    oauth.register(
        name="apple",
        client_id=client_id,
        # client_secret is built fresh per token exchange via build_client_secret().
        # A placeholder is needed here to satisfy Authlib's internal validation;
        # the real JWT is passed as a kwarg to authorize_access_token().
        client_secret="PLACEHOLDER_OVERRIDDEN_PER_REQUEST",
        server_metadata_url=(
            "https://appleid.apple.com/.well-known/openid-configuration"
        ),
        client_kwargs={
            "scope": "openid email name",
            "response_mode": "form_post",
            "token_endpoint_auth_method": "client_secret_post",
        },
    )

    global _apple_enabled
    _apple_enabled = True
    log.info("Apple Sign In enabled for client_id=%s", client_id)


def is_enabled() -> bool:
    return _apple_enabled


def upsert_apple_user(subject: str, email: str | None, name: str | None):
    """Find or create a User linked to the given Apple subject (sub claim).

    Apple only provides the user's real email and name on the very first
    authentication; subsequent sign-ins omit them. The OAuthIdentity lookup
    by (provider='apple', subject=sub) handles repeat sign-ins without email.

    Returns None only if neither an existing identity nor an email is available
    (should not occur in normal Apple flows).
    """
    from auth.oauth_common import upsert_oauth_user

    # Derive a best-effort display name. Apple may send None after first auth.
    display_name = (name or "").strip()
    if not display_name and email:
        display_name = email.split("@")[0]
    if not display_name:
        display_name = "Apple User"

    return upsert_oauth_user(
        provider="apple",
        subject=subject,
        email=email,
        name=display_name,
        verified=True,  # Apple only surfaces verified / relay emails
    )


def parse_apple_user_form(form_data: dict) -> tuple[str | None, str | None]:
    """Extract (email, name) from Apple's first-auth 'user' form field.

    Apple sends a JSON 'user' field in the callback POST body only on the
    FIRST authentication. The name object has 'firstName' and 'lastName'.
    Returns (None, None) on missing / malformed data.
    """
    raw = form_data.get("user")
    if not raw:
        return None, None
    try:
        data = json.loads(raw)
        name_obj = data.get("name") or {}
        parts = [
            (name_obj.get("firstName") or "").strip(),
            (name_obj.get("lastName") or "").strip(),
        ]
        name = " ".join(p for p in parts if p) or None
        email = (data.get("email") or "").strip() or None
        return email, name
    except Exception:
        return None, None
