"""Tests for WebAuthn / passkey endpoints.

Focus areas:
1. Feature-gating: when WEBAUTHN_RP_ID / WEBAUTHN_ORIGIN are unset,
   endpoints return {enabled:false}/404.
2. Status endpoint always reachable.
3. Register/begin returns valid WebAuthn creation options when feature is on.
4. Auth/begin returns valid WebAuthn request options when feature is on.
5. No real browser or network calls are made.
"""
import os
import json
import pytest


from app import app as _app


def _client():
    return _app.test_client()


# ── Gate-off tests (no env vars set) ─────────────────────────────────────────

def test_status_off_by_default():
    """Without WEBAUTHN_RP_ID set, status returns enabled=false."""
    r = _client().get("/api/webauthn/status")
    assert r.status_code == 200
    assert r.get_json()["enabled"] is False


def test_register_begin_gated_off():
    """register/begin returns 404 with enabled=false when not configured."""
    import auth.routes as routes
    with _app.test_client() as c:
        # Need to be authed
        c.post("/api/auth/signup", json={"email": "wn_gated@x.com", "password": "password123"})
        import db, models
        with db.get_session() as s:
            u = s.query(models.User).filter_by(email="wn_gated@x.com").first()
            u.email_verified = True
            s.commit()
        c.post("/api/auth/login", json={"email": "wn_gated@x.com", "password": "password123"})
        r = c.post("/api/webauthn/register/begin")
    assert r.status_code == 404
    assert r.get_json()["enabled"] is False


def test_auth_begin_gated_off():
    """auth/begin returns 404 with enabled=false when not configured."""
    r = _client().post("/api/webauthn/auth/begin")
    assert r.status_code == 404
    assert r.get_json()["enabled"] is False


def test_credentials_list_gated_requires_auth():
    """GET /api/webauthn/credentials requires auth (not gated, just 401)."""
    r = _client().get("/api/webauthn/credentials")
    assert r.status_code == 401


# ── Gate-on tests (env vars present) ─────────────────────────────────────────

@pytest.fixture
def wn_env(monkeypatch):
    """Enable WebAuthn feature for a test by setting required env vars."""
    monkeypatch.setenv("WEBAUTHN_RP_ID", "localhost")
    monkeypatch.setenv("WEBAUTHN_RP_NAME", "Ticker Tracker Test")
    monkeypatch.setenv("WEBAUTHN_ORIGIN", "http://localhost")
    # Reload the module's _config so it picks up monkeypatched env.
    yield


def test_status_on_when_configured(wn_env):
    from auth.webauthn_auth import is_enabled
    assert is_enabled() is True
    r = _client().get("/api/webauthn/status")
    assert r.status_code == 200
    assert r.get_json()["enabled"] is True


def test_register_begin_returns_options(wn_env, monkeypatch):
    """register/begin returns a WebAuthn creation options JSON blob."""
    monkeypatch.setattr("auth.routes.send_verify_email", lambda *a, **kw: True)
    with _app.test_client() as c:
        c.post("/api/auth/signup", json={"email": "wn_begin@x.com", "password": "password123"})
        import db, models
        with db.get_session() as s:
            u = s.query(models.User).filter_by(email="wn_begin@x.com").first()
            u.email_verified = True
            s.commit()
        c.post("/api/auth/login", json={"email": "wn_begin@x.com", "password": "password123"})
        r = c.post("/api/webauthn/register/begin")
    assert r.status_code == 200
    data = r.get_json()
    # Standard WebAuthn creation options fields
    assert "rp" in data
    assert data["rp"]["id"] == "localhost"
    assert "challenge" in data
    assert "user" in data
    assert "pubKeyCredParams" in data


def test_auth_begin_returns_options(wn_env):
    """auth/begin returns a WebAuthn request options JSON blob."""
    r = _client().post("/api/webauthn/auth/begin", json={})
    assert r.status_code == 200
    data = r.get_json()
    assert "challenge" in data
    assert "rpId" in data
    assert data["rpId"] == "localhost"


def test_register_begin_excludes_existing_credentials(wn_env, monkeypatch):
    """register/begin sets excludeCredentials for already-registered credentials."""
    monkeypatch.setattr("auth.routes.send_verify_email", lambda *a, **kw: True)
    with _app.test_client() as c:
        c.post("/api/auth/signup", json={"email": "wn_excl@x.com", "password": "password123"})
        import db, models
        with db.get_session() as s:
            u = s.query(models.User).filter_by(email="wn_excl@x.com").first()
            u.email_verified = True
            uid = u.id
            s.commit()
        c.post("/api/auth/login", json={"email": "wn_excl@x.com", "password": "password123"})

        # Seed a fake existing credential
        with db.get_session() as s:
            s.add(models.WebAuthnCredential(
                user_id=uid,
                credential_id="ZmFrZWNyZWQ",
                public_key="ZmFrZWtleQ",
                sign_count=0,
                label="My key",
            ))
            s.commit()

        r = c.post("/api/webauthn/register/begin")
    assert r.status_code == 200
    data = r.get_json()
    exclude = data.get("excludeCredentials", [])
    assert any(e["id"] == "ZmFrZWNyZWQ" for e in exclude)


def test_is_enabled_false_without_env():
    """is_enabled() returns False when env is not set (import-time default)."""
    from auth import webauthn_auth
    # Remove env vars temporarily
    original_get = os.environ.get
    saved_rp = os.environ.pop("WEBAUTHN_RP_ID", None)
    saved_origin = os.environ.pop("WEBAUTHN_ORIGIN", None)
    try:
        assert webauthn_auth.is_enabled() is False
    finally:
        if saved_rp:
            os.environ["WEBAUTHN_RP_ID"] = saved_rp
        if saved_origin:
            os.environ["WEBAUTHN_ORIGIN"] = saved_origin
