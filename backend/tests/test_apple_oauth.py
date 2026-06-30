"""Tests for Apple Sign In (auth.apple):
  - build_client_secret() ES256 JWT structure
  - Provider gating (503 when env vars absent)
  - Callback links OAuthIdentity (mocked token exchange)
  - parse_apple_user_form helper
"""
import base64
import json
import os
import time

import pytest

# ── Helpers ────────────────────────────────────────────────────────────────────

def _generate_ec_key_pem() -> tuple[str, str]:
    """Return (private_key_pem, public_key_pem) for a test P-256 EC key."""
    from cryptography.hazmat.primitives.asymmetric.ec import (
        generate_private_key,
        SECP256R1,
    )
    from cryptography.hazmat.primitives.serialization import (
        Encoding,
        PrivateFormat,
        PublicFormat,
        NoEncryption,
    )

    priv = generate_private_key(SECP256R1())
    priv_pem = priv.private_bytes(
        Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()
    ).decode()
    pub_pem = priv.public_key().public_bytes(
        Encoding.PEM, PublicFormat.SubjectPublicKeyInfo
    ).decode()
    return priv_pem, pub_pem


def _decode_jwt_claims(token: str) -> dict:
    """Decode the payload of a JWT without verifying the signature."""
    parts = token.split(".")
    assert len(parts) == 3, "JWT must have 3 parts"
    # Add padding
    payload_b64 = parts[1] + "=="
    return json.loads(base64.urlsafe_b64decode(payload_b64))


def _decode_jwt_header(token: str) -> dict:
    header_b64 = token.split(".")[0] + "=="
    return json.loads(base64.urlsafe_b64decode(header_b64))


# ── build_client_secret tests ──────────────────────────────────────────────────

class TestBuildClientSecret:
    def _set_apple_env(self, monkeypatch, priv_pem: str):
        monkeypatch.setenv("APPLE_TEAM_ID", "TESTTEAM01")
        monkeypatch.setenv("APPLE_CLIENT_ID", "com.example.test")
        monkeypatch.setenv("APPLE_KEY_ID", "TESTKEYID1")
        monkeypatch.setenv("APPLE_PRIVATE_KEY", priv_pem)

    def test_produces_three_part_jwt(self, monkeypatch):
        priv_pem, _pub_pem = _generate_ec_key_pem()
        self._set_apple_env(monkeypatch, priv_pem)
        from auth.apple import build_client_secret
        secret = build_client_secret()
        assert isinstance(secret, str)
        assert secret.count(".") == 2, "ES256 JWT must have 3 dot-separated parts"

    def test_header_alg_and_kid(self, monkeypatch):
        priv_pem, _pub = _generate_ec_key_pem()
        self._set_apple_env(monkeypatch, priv_pem)
        from auth.apple import build_client_secret
        secret = build_client_secret()
        header = _decode_jwt_header(secret)
        assert header["alg"] == "ES256"
        assert header["kid"] == "TESTKEYID1"

    def test_claims_content(self, monkeypatch):
        priv_pem, _pub = _generate_ec_key_pem()
        self._set_apple_env(monkeypatch, priv_pem)
        from auth.apple import build_client_secret
        before = int(time.time())
        secret = build_client_secret()
        after = int(time.time())
        claims = _decode_jwt_claims(secret)
        assert claims["iss"] == "TESTTEAM01"
        assert claims["sub"] == "com.example.test"
        assert claims["aud"] == "https://appleid.apple.com"
        assert before <= claims["iat"] <= after
        # exp should be ~ 180 days in the future
        assert claims["exp"] > claims["iat"] + 86400 * 170
        assert claims["exp"] <= claims["iat"] + 86400 * 181

    def test_signature_verifiable_with_public_key(self, monkeypatch):
        """The JWT must be verifiable with the corresponding public key."""
        from cryptography.hazmat.primitives.asymmetric.ec import (
            generate_private_key, SECP256R1,
        )
        from cryptography.hazmat.primitives.serialization import (
            Encoding, PrivateFormat, PublicFormat, NoEncryption,
        )
        priv = generate_private_key(SECP256R1())
        priv_pem = priv.private_bytes(
            Encoding.PEM, PrivateFormat.PKCS8, NoEncryption()
        ).decode()
        pub_pem = priv.public_key().public_bytes(
            Encoding.PEM, PublicFormat.SubjectPublicKeyInfo
        ).decode()

        monkeypatch.setenv("APPLE_TEAM_ID", "T1")
        monkeypatch.setenv("APPLE_CLIENT_ID", "com.x.y")
        monkeypatch.setenv("APPLE_KEY_ID", "K1")
        monkeypatch.setenv("APPLE_PRIVATE_KEY", priv_pem)

        from auth.apple import build_client_secret
        from authlib.jose import jwt as jose_jwt
        from cryptography.hazmat.primitives.serialization import load_pem_public_key

        secret = build_client_secret()
        pub_key = load_pem_public_key(pub_pem.encode())
        # Verify — should not raise
        claims = jose_jwt.decode(secret, pub_key)
        assert claims["iss"] == "T1"
        assert claims["sub"] == "com.x.y"


# ── Provider gating tests ──────────────────────────────────────────────────────

class TestProviderGating:
    def test_apple_login_not_configured(self):
        """Without APPLE_* env vars, /apple returns 503."""
        # Apple env vars are not set in test environment (conftest doesn't set them)
        from app import app
        c = app.test_client()
        r = c.get("/api/auth/apple")
        assert r.status_code == 503
        body = r.get_json()
        assert "not configured" in (body or {}).get("error", "")

    def test_providers_endpoint_apple_false(self):
        """GET /api/auth/providers returns apple=false when not configured."""
        from app import app
        c = app.test_client()
        r = c.get("/api/auth/providers")
        assert r.status_code == 200
        data = r.get_json()
        assert isinstance(data.get("apple"), bool)
        assert data["apple"] is False  # Apple not configured in test env

    def test_providers_endpoint_google_false(self):
        """GET /api/auth/providers returns google=false when not configured."""
        from app import app
        c = app.test_client()
        r = c.get("/api/auth/providers")
        assert r.status_code == 200
        data = r.get_json()
        assert isinstance(data.get("google"), bool)
        # Google not configured in test env either
        assert data["google"] is False


# ── Callback integration tests (mocked token exchange) ────────────────────────

class TestAppleCallback:
    def test_callback_not_configured_redirects_to_failed(self):
        """When Apple is not enabled, callback falls through to auth=failed redirect."""
        from app import app
        c = app.test_client()
        r = c.post("/api/auth/apple/callback", data={"code": "x", "state": "y"})
        # Expect redirect to /?auth=failed
        assert r.status_code in (302, 303)
        assert "auth=failed" in r.headers.get("Location", "")

    def test_callback_creates_oauth_identity(self, monkeypatch):
        """Mocked token exchange creates an OAuthIdentity and logs the user in."""
        import auth.apple as apple_mod
        import auth.routes as routes_mod

        # Temporarily enable Apple provider in-process
        original_enabled = apple_mod._apple_enabled
        apple_mod._apple_enabled = True

        try:
            # Mock build_client_secret so no real key is needed
            monkeypatch.setattr(routes_mod, "build_client_secret", lambda: "fake-jwt")

            # Mock oauth.apple.authorize_access_token to return a fake token dict
            fake_token = {
                "access_token": "fake-access-token",
                "userinfo": {
                    "sub": "apple-sub-12345",
                    "email": "testapple@privaterelay.appleid.com",
                    "email_verified": True,
                },
            }

            class _FakeAppleClient:
                def authorize_access_token(self, **kwargs):
                    return fake_token

            # Patch oauth.apple on the routes module's oauth reference
            from auth.google import oauth
            monkeypatch.setattr(oauth, "apple", _FakeAppleClient(), raising=False)

            from app import app
            c = app.test_client()
            r = c.post(
                "/api/auth/apple/callback",
                data={"code": "fake-code", "state": "fake-state"},
            )
            # Should redirect to /?auth=ok
            assert r.status_code in (302, 303)
            assert "auth=ok" in r.headers.get("Location", "")

            # Verify OAuthIdentity was created
            import db
            import models as m
            with db.get_session() as s:
                ident = (
                    s.query(m.OAuthIdentity)
                    .filter_by(provider="apple", subject="apple-sub-12345")
                    .first()
                )
                assert ident is not None
                user = s.get(m.User, ident.user_id)
                assert user is not None
                assert "appleid" in user.email or "privaterelay" in user.email

        finally:
            apple_mod._apple_enabled = original_enabled

    def test_callback_missing_sub_redirects_failed(self, monkeypatch):
        """Token without sub claim redirects to /?auth=failed."""
        import auth.apple as apple_mod
        import auth.routes as routes_mod

        original_enabled = apple_mod._apple_enabled
        apple_mod._apple_enabled = True

        try:
            monkeypatch.setattr(routes_mod, "build_client_secret", lambda: "fake-jwt")

            fake_token = {
                "access_token": "tok",
                "userinfo": {"email": "no-sub@example.com"},  # no 'sub'
            }

            class _FakeAppleClient:
                def authorize_access_token(self, **kwargs):
                    return fake_token

            from auth.google import oauth
            monkeypatch.setattr(oauth, "apple", _FakeAppleClient(), raising=False)

            from app import app
            c = app.test_client()
            r = c.post("/api/auth/apple/callback", data={"code": "c", "state": "s"})
            assert r.status_code in (302, 303)
            assert "auth=failed" in r.headers.get("Location", "")
        finally:
            apple_mod._apple_enabled = original_enabled


# ── parse_apple_user_form tests ────────────────────────────────────────────────

class TestParseAppleUserForm:
    def test_first_auth_with_name_and_email(self):
        from auth.apple import parse_apple_user_form
        form_data = {
            "user": json.dumps({
                "name": {"firstName": "Jane", "lastName": "Doe"},
                "email": "jane@privaterelay.appleid.com",
            })
        }
        email, name = parse_apple_user_form(form_data)
        assert email == "jane@privaterelay.appleid.com"
        assert name == "Jane Doe"

    def test_missing_user_field(self):
        from auth.apple import parse_apple_user_form
        email, name = parse_apple_user_form({})
        assert email is None
        assert name is None

    def test_malformed_json(self):
        from auth.apple import parse_apple_user_form
        email, name = parse_apple_user_form({"user": "not-json{"})
        assert email is None
        assert name is None

    def test_partial_name(self):
        from auth.apple import parse_apple_user_form
        form_data = {
            "user": json.dumps({
                "name": {"firstName": "Alice", "lastName": ""},
                "email": "a@b.com",
            })
        }
        email, name = parse_apple_user_form(form_data)
        assert name == "Alice"
        assert email == "a@b.com"
