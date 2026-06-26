import auth.tokens as tk
import providers.email as email
import auth.routes as routes
from app import app


def _client():
    return app.test_client()


def test_signup_then_verify_then_login(monkeypatch):
    sent = {}
    monkeypatch.setattr(routes, "send_verify_email", lambda to, link: sent.update({"to": to, "link": link}) or True)
    c = _client()
    r = c.post("/api/auth/signup", json={"email": "u@b.com", "password": "password123", "name": "U"})
    assert r.status_code == 200
    # cannot log in before verifying
    r = c.post("/api/auth/login", json={"email": "u@b.com", "password": "password123"})
    assert r.status_code == 403
    # extract raw token from the link the email would contain
    raw = sent["link"].split("token=")[1]
    r = c.get(f"/api/auth/verify?token={raw}")
    assert r.status_code in (302, 200)
    # now login works
    r = c.post("/api/auth/login", json={"email": "u@b.com", "password": "password123"})
    assert r.status_code == 200 and r.get_json()["user"]["email"] == "u@b.com"
    # me reflects session
    assert c.get("/api/auth/me").get_json()["user"]["email"] == "u@b.com"
    # logout
    assert c.post("/api/auth/logout").status_code == 200
    assert c.get("/api/auth/me").get_json()["user"] is None


def test_signup_short_password():
    assert _client().post("/api/auth/signup", json={"email": "a@b.com", "password": "short"}).status_code == 400


def test_login_wrong_password_generic(monkeypatch):
    monkeypatch.setattr(routes, "send_verify_email", lambda to, link: True)
    c = _client()
    c.post("/api/auth/signup", json={"email": "w@b.com", "password": "password123"})
    # mark verified directly
    import db, models
    with db.get_session() as s:
        u = s.query(models.User).filter_by(email="w@b.com").first(); u.email_verified = True; s.commit()
    r = c.post("/api/auth/login", json={"email": "w@b.com", "password": "WRONGWRONG"})
    assert r.status_code == 401


def test_duplicate_signup_no_enumeration(monkeypatch):
    monkeypatch.setattr(routes, "send_verify_email", lambda to, link: True)
    c = _client()
    c.post("/api/auth/signup", json={"email": "d@b.com", "password": "password123"})
    r = c.post("/api/auth/signup", json={"email": "d@b.com", "password": "password123"})
    assert r.status_code == 200  # generic, no "already exists"


def test_forgot_and_reset(monkeypatch):
    sent = {}
    monkeypatch.setattr(routes, "send_verify_email", lambda to, link: True)
    monkeypatch.setattr(routes, "send_reset_email", lambda to, link: sent.update({"link": link}) or True)
    c = _client()
    c.post("/api/auth/signup", json={"email": "r@b.com", "password": "password123"})
    import db, models
    with db.get_session() as s:
        u = s.query(models.User).filter_by(email="r@b.com").first(); u.email_verified = True; s.commit()
    # forgot always 200, even unknown
    assert c.post("/api/auth/forgot", json={"email": "nobody@b.com"}).status_code == 200
    assert c.post("/api/auth/forgot", json={"email": "r@b.com"}).status_code == 200
    raw = sent["link"].split("token=")[1]
    # reset
    assert c.post("/api/auth/reset", json={"token": raw, "password": "newpassword1"}).status_code == 200
    # old password fails, new works
    assert c.post("/api/auth/login", json={"email": "r@b.com", "password": "password123"}).status_code == 401
    assert c.post("/api/auth/login", json={"email": "r@b.com", "password": "newpassword1"}).status_code == 200
    # token single-use
    assert c.post("/api/auth/reset", json={"token": raw, "password": "another12"}).status_code == 400
