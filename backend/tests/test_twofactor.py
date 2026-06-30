"""Tests for TOTP 2FA — pure helpers + endpoint integration.

Runs fully with in-memory SQLite, no env vars required.
Existing users default to totp_enabled=False so the no-2FA login path
is exercised by the existing test_auth_routes.py tests (left unchanged).
"""
import pytest
import pyotp


# ── Pure helper tests (no Flask context) ─────────────────────────────────────

def test_generate_totp_secret_is_valid_base32():
    from auth.twofactor import generate_totp_secret
    secret = generate_totp_secret()
    # Must decode without error and produce a valid TOTP
    totp = pyotp.TOTP(secret)
    code = totp.now()
    assert len(code) == 6 and code.isdigit()


def test_provisioning_uri_format():
    from auth.twofactor import provisioning_uri, generate_totp_secret
    secret = generate_totp_secret()
    uri = provisioning_uri(secret, "test@example.com")
    assert uri.startswith("otpauth://totp/")
    assert "Ticker%20Tracker" in uri or "Ticker+Tracker" in uri or "Ticker Tracker" in uri
    assert "test%40example.com" in uri or "test@example.com" in uri


def test_verify_totp_current_code_passes():
    from auth.twofactor import verify_totp, generate_totp_secret
    secret = generate_totp_secret()
    code = pyotp.TOTP(secret).now()
    assert verify_totp(secret, code) is True


def test_verify_totp_wrong_code_fails():
    from auth.twofactor import verify_totp, generate_totp_secret
    secret = generate_totp_secret()
    assert verify_totp(secret, "000000") is False


def test_generate_recovery_codes_count_and_format():
    from auth.twofactor import generate_recovery_codes
    codes = generate_recovery_codes(8)
    assert len(codes) == 8
    for c in codes:
        parts = c.split("-")
        assert len(parts) == 3, f"Expected 3 parts, got {parts}"
        for p in parts:
            assert len(p) == 4 and p.isalnum(), f"Part {p!r} has wrong format"
    # All codes unique
    assert len(set(codes)) == 8


def test_recovery_codes_uniqueness_across_calls():
    from auth.twofactor import generate_recovery_codes
    a = set(generate_recovery_codes())
    b = set(generate_recovery_codes())
    # Astronomical probability that two independent batches share all 8 codes
    assert a != b


# ── Pending token round-trip ──────────────────────────────────────────────────

def test_pending_token_round_trip(app_ctx):
    from auth.twofactor import create_pending_token, consume_pending_token
    token = create_pending_token(42)
    uid = consume_pending_token(token)
    assert uid == 42


def test_pending_token_invalid_returns_none(app_ctx):
    from auth.twofactor import consume_pending_token
    assert consume_pending_token("garbage") is None
    assert consume_pending_token("") is None


@pytest.fixture
def app_ctx():
    """Minimal Flask app context for itsdangerous tests."""
    from app import app
    with app.app_context():
        yield


# ── Endpoint integration tests ────────────────────────────────────────────────

from app import app as _app


def _make_client():
    return _app.test_client()


def _seed_verified_user(email="t2fa@example.com", password="password123"):
    """Create + verify a user, return (client, email, password)."""
    import db, models
    from auth.passwords import hash_password
    with db.get_session() as s:
        u = models.User(
            email=email,
            password_hash=hash_password(password),
            email_verified=True,
        )
        s.add(u)
        s.commit()
        uid = u.id
    return uid


def test_status_endpoint_unauthenticated():
    c = _make_client()
    r = c.get("/api/2fa/status")
    assert r.status_code == 401


def test_status_endpoint_returns_false_when_no_2fa(monkeypatch):
    import auth.routes as routes
    monkeypatch.setattr(routes, "send_verify_email", lambda *a, **kw: True)
    c = _make_client()
    # Signup + verify via email link
    c.post("/api/auth/signup", json={"email": "s2fa@x.com", "password": "password123"})
    import db, models
    with db.get_session() as s:
        u = s.query(models.User).filter_by(email="s2fa@x.com").first()
        u.email_verified = True
        s.commit()
    c.post("/api/auth/login", json={"email": "s2fa@x.com", "password": "password123"})
    r = c.get("/api/2fa/status")
    assert r.status_code == 200
    assert r.get_json()["enabled"] is False


def test_setup_and_verify_enables_2fa(monkeypatch):
    import auth.routes as routes
    monkeypatch.setattr(routes, "send_verify_email", lambda *a, **kw: True)
    c = _make_client()
    c.post("/api/auth/signup", json={"email": "en2fa@x.com", "password": "password123"})
    import db, models
    with db.get_session() as s:
        u = s.query(models.User).filter_by(email="en2fa@x.com").first()
        u.email_verified = True
        s.commit()
    c.post("/api/auth/login", json={"email": "en2fa@x.com", "password": "password123"})

    # Setup
    r = c.post("/api/2fa/setup")
    assert r.status_code == 200
    data = r.get_json()
    assert "secret" in data and "otpauth_uri" in data
    secret = data["secret"]

    # Verify with a valid TOTP code
    code = pyotp.TOTP(secret).now()
    r = c.post("/api/2fa/verify", json={"code": code})
    assert r.status_code == 200
    result = r.get_json()
    assert "recovery_codes" in result
    codes = result["recovery_codes"]
    assert len(codes) == 8

    # Status now shows enabled
    r = c.get("/api/2fa/status")
    assert r.get_json()["enabled"] is True


def test_setup_refused_when_already_enabled(monkeypatch):
    """Step-up guard: /setup must not rotate the secret / reset enabled once 2FA
    is active — that would let a hijacked session knock out working 2FA without
    proving a current factor. Re-enrolling requires /disable first."""
    import auth.routes as routes
    monkeypatch.setattr(routes, "send_verify_email", lambda *a, **kw: True)
    c = _make_client()
    c.post("/api/auth/signup", json={"email": "reen2fa@x.com", "password": "password123"})
    import db, models
    with db.get_session() as s:
        u = s.query(models.User).filter_by(email="reen2fa@x.com").first()
        u.email_verified = True
        s.commit()
    c.post("/api/auth/login", json={"email": "reen2fa@x.com", "password": "password123"})

    secret = c.post("/api/2fa/setup").get_json()["secret"]
    c.post("/api/2fa/verify", json={"code": pyotp.TOTP(secret).now()})

    # Second /setup while enabled must be refused, and state must be untouched.
    r = c.post("/api/2fa/setup")
    assert r.status_code == 400
    with db.get_session() as s:
        u = s.query(models.User).filter_by(email="reen2fa@x.com").first()
        assert u.totp_enabled is True
        assert u.totp_secret == secret  # secret was NOT rotated
    assert c.get("/api/2fa/status").get_json()["enabled"] is True


def test_verify_bad_code_rejected(monkeypatch):
    import auth.routes as routes
    monkeypatch.setattr(routes, "send_verify_email", lambda *a, **kw: True)
    c = _make_client()
    c.post("/api/auth/signup", json={"email": "bad2fa@x.com", "password": "password123"})
    import db, models
    with db.get_session() as s:
        u = s.query(models.User).filter_by(email="bad2fa@x.com").first()
        u.email_verified = True
        s.commit()
    c.post("/api/auth/login", json={"email": "bad2fa@x.com", "password": "password123"})
    c.post("/api/2fa/setup")
    r = c.post("/api/2fa/verify", json={"code": "000000"})
    assert r.status_code == 400
    assert "invalid" in r.get_json().get("error", "").lower()


def test_login_with_2fa_enabled_returns_pending_token(monkeypatch):
    import auth.routes as routes
    monkeypatch.setattr(routes, "send_verify_email", lambda *a, **kw: True)
    c = _make_client()
    email, pw = "login2fa@x.com", "password123"
    c.post("/api/auth/signup", json={"email": email, "password": pw})
    import db, models
    with db.get_session() as s:
        u = s.query(models.User).filter_by(email=email).first()
        u.email_verified = True
        s.commit()
    c.post("/api/auth/login", json={"email": email, "password": pw})

    # Enable 2FA
    r_setup = c.post("/api/2fa/setup")
    secret = r_setup.get_json()["secret"]
    code = pyotp.TOTP(secret).now()
    c.post("/api/2fa/verify", json={"code": code})

    # Logout, then attempt login — should get pending token, NOT a session
    c.post("/api/auth/logout")
    r = c.post("/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200
    data = r.get_json()
    assert data.get("two_factor_required") is True
    assert "token" in data
    assert "user" not in data


def test_login_no_2fa_path_unchanged(monkeypatch):
    """Users with totp_enabled=False still log in directly (regression guard)."""
    import auth.routes as routes
    monkeypatch.setattr(routes, "send_verify_email", lambda *a, **kw: True)
    c = _make_client()
    email, pw = "no2fa@x.com", "password123"
    c.post("/api/auth/signup", json={"email": email, "password": pw})
    import db, models
    with db.get_session() as s:
        u = s.query(models.User).filter_by(email=email).first()
        u.email_verified = True
        s.commit()
    r = c.post("/api/auth/login", json={"email": email, "password": pw})
    assert r.status_code == 200
    data = r.get_json()
    # Must return user directly, no two_factor_required
    assert "user" in data
    assert data["user"]["email"] == email
    assert "two_factor_required" not in data


def test_two_factor_login_endpoint(monkeypatch):
    import auth.routes as routes
    monkeypatch.setattr(routes, "send_verify_email", lambda *a, **kw: True)
    c = _make_client()
    email, pw = "2falogin@x.com", "password123"
    c.post("/api/auth/signup", json={"email": email, "password": pw})
    import db, models
    with db.get_session() as s:
        u = s.query(models.User).filter_by(email=email).first()
        u.email_verified = True
        s.commit()
    c.post("/api/auth/login", json={"email": email, "password": pw})

    # Enable 2FA
    r_setup = c.post("/api/2fa/setup")
    secret = r_setup.get_json()["secret"]
    code_en = pyotp.TOTP(secret).now()
    c.post("/api/2fa/verify", json={"code": code_en})
    c.post("/api/auth/logout")

    # Trigger pending token
    r = c.post("/api/auth/login", json={"email": email, "password": pw})
    pending_token = r.get_json()["token"]

    # Exchange pending token + valid TOTP code → full session
    code = pyotp.TOTP(secret).now()
    r2 = c.post("/api/auth/2fa", json={"token": pending_token, "code": code})
    assert r2.status_code == 200
    data = r2.get_json()
    assert "user" in data
    assert data["user"]["email"] == email

    # /me confirms session is now established
    r3 = c.get("/api/auth/me")
    assert r3.get_json()["user"]["email"] == email


def test_two_factor_login_with_recovery_code(monkeypatch):
    import auth.routes as routes
    monkeypatch.setattr(routes, "send_verify_email", lambda *a, **kw: True)
    c = _make_client()
    email, pw = "2farecover@x.com", "password123"
    c.post("/api/auth/signup", json={"email": email, "password": pw})
    import db, models
    with db.get_session() as s:
        u = s.query(models.User).filter_by(email=email).first()
        u.email_verified = True
        s.commit()
    c.post("/api/auth/login", json={"email": email, "password": pw})

    r_setup = c.post("/api/2fa/setup")
    secret = r_setup.get_json()["secret"]
    code_en = pyotp.TOTP(secret).now()
    r_ver = c.post("/api/2fa/verify", json={"code": code_en})
    recovery_codes = r_ver.get_json()["recovery_codes"]
    c.post("/api/auth/logout")

    r = c.post("/api/auth/login", json={"email": email, "password": pw})
    pending_token = r.get_json()["token"]

    # Use a recovery code instead of TOTP
    r2 = c.post("/api/auth/2fa", json={"token": pending_token, "code": recovery_codes[0]})
    assert r2.status_code == 200
    assert "user" in r2.get_json()

    # Recovery code is single-use — second use with same code + new token must fail
    c.post("/api/auth/logout")
    r3 = c.post("/api/auth/login", json={"email": email, "password": pw})
    pending_token2 = r3.get_json()["token"]
    r4 = c.post("/api/auth/2fa", json={"token": pending_token2, "code": recovery_codes[0]})
    assert r4.status_code == 400


def test_disable_2fa_with_totp_code(monkeypatch):
    import auth.routes as routes
    monkeypatch.setattr(routes, "send_verify_email", lambda *a, **kw: True)
    c = _make_client()
    email, pw = "dis2fa@x.com", "password123"
    c.post("/api/auth/signup", json={"email": email, "password": pw})
    import db, models
    with db.get_session() as s:
        u = s.query(models.User).filter_by(email=email).first()
        u.email_verified = True
        s.commit()
    c.post("/api/auth/login", json={"email": email, "password": pw})
    r_setup = c.post("/api/2fa/setup")
    secret = r_setup.get_json()["secret"]
    c.post("/api/2fa/verify", json={"code": pyotp.TOTP(secret).now()})

    # Disable with valid TOTP
    r = c.post("/api/2fa/disable", json={"code": pyotp.TOTP(secret).now()})
    assert r.status_code == 200
    assert r.get_json().get("ok") is True

    # Status back to disabled
    assert c.get("/api/2fa/status").get_json()["enabled"] is False


def test_invalid_pending_token_rejected():
    c = _make_client()
    r = c.post("/api/auth/2fa", json={"token": "invalid.token.here", "code": "123456"})
    assert r.status_code == 400
