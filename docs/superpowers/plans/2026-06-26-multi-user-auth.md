# Multi-User Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional multi-user auth (email+password + Google OAuth, email verification + password reset via Resend, cookie sessions) with a freemium moat — browsing is free; personalization requires an account.

**Architecture:** Flask-Login manages signed HTTP-only cookie sessions; Authlib handles Google OAuth; argon2-cffi hashes passwords; Resend sends verification/reset emails; itsdangerous signs tokens (stored hashed). New `backend/auth/` package holds routes + helpers; existing personalization routes become session-scoped. Frontend gains an auth store slice, an AuthScreen, and a `requireAuth` guard.

**Tech Stack:** Flask 3, Flask-Login, Authlib, argon2-cffi, resend, itsdangerous, SQLAlchemy 2, Alembic, pytest, responses (HTTP mocking); React + Zustand + Vitest.

## Global Constraints

- Python 3.11; backend venv at `backend/.venv`; run tests `Set-Location backend; .\.venv\Scripts\python.exe -m pytest -q`.
- Tests set `DATABASE_URL=sqlite://` (in-memory) before importing `db` (see `backend/tests/conftest.py`) and must not hit the network (mock Resend + Google).
- Envelope unchanged: API JSON is `{data, meta:{source, stale}}` for data routes; auth routes may return plain `{...}` JSON + appropriate status codes.
- Password policy: minimum 8 characters, enforced server-side.
- Token expiries: verify 24h, reset 1h. Tokens are random, stored as SHA-256 hash, single-use.
- Rate limit: 5 failed login/forgot attempts per (email+IP) within 15 min → HTTP 423 for 15 min.
- Cookies: HTTP-only, Secure, SameSite=Lax. `SECRET_KEY` from env.
- Personalization routes (`/api/watchlist`, `/api/settings`, `/api/holdings`) require a session (401 if anonymous) and scope every query to `current_user.id`.
- Public routes stay open: quotes, history, fundamentals, crypto, fng, news, ratings, health, and the SPA.
- Secrets only via env/Railway vars, never committed.
- New env vars: `SECRET_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, `APP_BASE_URL`.

## File Structure

```
backend/
  requirements.txt        # + Flask-Login, Authlib, argon2-cffi, resend
  models.py               # + password_hash/email_verified on User; new tables
  db.py                   # remove auto-seed of user id=1
  auth.py                 # replace: current_user_id() reads Flask-Login session
  auth/
    __init__.py
    passwords.py          # hash_password / verify_password / valid_password
    tokens.py             # create_token / verify_token (hash-before-store)
    rate_limit.py         # record_attempt / is_locked
    google.py             # Authlib client + callback upsert
    routes.py             # blueprint: /api/auth/*
  providers/
    email.py              # Resend send_verify_email / send_reset_email
  app.py                  # init Flask-Login, register auth blueprint, scope routes
  migrations/versions/*   # new revision: auth columns/tables + wipe seed
  tests/
    test_passwords.py, test_tokens.py, test_rate_limit.py,
    test_auth_routes.py, test_auth_scoping.py, test_google_oauth.py
frontend/
  src/api/types.ts        # + AuthUser
  src/api/client.ts       # credentials:'include'; auth methods
  src/state/store.ts      # auth slice: currentUser/isAuthed/loadMe/login/...
  src/components/AuthScreen.tsx
  src/components/RequireAuth.ts   # requireAuth(action) helper hook
  src/data/demo.ts        # DEMO_WATCH constant (read-only anon list)
  src/components/Watchlist.tsx    # branch demo vs real; gate actions
  src/components/Header.tsx       # Sign in button / avatar
  src/views/Settings.tsx          # Sign out + verified status
  src/App.tsx             # loadMe on start; mount AuthScreen
  src/state/store.test.ts # Vitest: auth transitions + requireAuth
```

---

### Task 1: Dependencies + User model columns + new tables + migration

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/models.py`
- Modify: `backend/db.py` (remove auto-seed)
- Test: `backend/tests/test_auth_models.py`

**Interfaces:**
- Produces SQLAlchemy models: `User` (+`password_hash`, `email_verified`),
  `OAuthIdentity(user_id, provider, subject)`,
  `EmailToken(user_id, kind, token_hash, expires_at, used_at)`,
  `LoginAttempt(email, ip, created_at, success)`.

- [ ] **Step 1: Add deps** — append to `backend/requirements.txt`:
```
Flask-Login==0.6.3
Authlib==1.3.1
argon2-cffi==23.1.0
resend==2.4.0
```
Run: `.\.venv\Scripts\python.exe -m pip install -r requirements.txt`

- [ ] **Step 2: Write the failing test** — `backend/tests/test_auth_models.py`:
```python
import db
import models


def test_user_has_auth_columns():
    with db.get_session() as s:
        u = models.User(email="a@b.com", password_hash="x", email_verified=True)
        s.add(u); s.commit()
        got = s.query(models.User).filter_by(email="a@b.com").first()
        assert got.email_verified is True and got.password_hash == "x"


def test_oauth_identity_roundtrip():
    with db.get_session() as s:
        u = models.User(email="g@b.com"); s.add(u); s.commit()
        s.add(models.OAuthIdentity(user_id=u.id, provider="google", subject="sub123"))
        s.commit()
        oi = s.query(models.OAuthIdentity).filter_by(provider="google", subject="sub123").first()
        assert oi.user_id == u.id


def test_email_token_and_login_attempt():
    with db.get_session() as s:
        u = models.User(email="t@b.com"); s.add(u); s.commit()
        s.add(models.EmailToken(user_id=u.id, kind="verify", token_hash="h", expires_at=__import__("datetime").datetime(2030,1,1)))
        s.add(models.LoginAttempt(email="t@b.com", ip="1.2.3.4", success=False))
        s.commit()
        assert s.query(models.EmailToken).count() == 1
        assert s.query(models.LoginAttempt).count() == 1
```

- [ ] **Step 3: Run → FAIL** (`pytest tests/test_auth_models.py -v` → AttributeError/no column).

- [ ] **Step 4: Implement** — edit `backend/models.py`. Add to `User`:
```python
    password_hash = Column(String, nullable=True)
    email_verified = Column(Boolean, default=False)
```
Make `email` unique+indexed: change its column to
`email = Column(String, nullable=False, unique=True, index=True)`.
Append new models:
```python
class OAuthIdentity(Base):
    __tablename__ = "oauth_identities"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    provider = Column(String, nullable=False)
    subject = Column(String, nullable=False)
    __table_args__ = (UniqueConstraint("provider", "subject", name="uq_provider_subject"),)


class EmailToken(Base):
    __tablename__ = "email_tokens"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    kind = Column(String, nullable=False)            # 'verify' | 'reset'
    token_hash = Column(String, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)


class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    id = Column(Integer, primary_key=True)
    email = Column(String, nullable=False, index=True)
    ip = Column(String, default="")
    created_at = Column(DateTime, server_default=func.now(), index=True)
    success = Column(Boolean, default=False)
```
Add `UniqueConstraint` to the imports at the top of `models.py`:
`from sqlalchemy import (..., UniqueConstraint)`.

- [ ] **Step 5: Remove auto-seed** in `backend/db.py` `init_db()` — delete the
blocks that create `User(id=1, ...)` and `Settings(user_id=1)`. Keep
`Base.metadata.create_all(engine)` (wrapped as-is). Result:
```python
def init_db():
    try:
        import models  # noqa: F401
        Base.metadata.create_all(engine)
    except Exception as e:  # pragma: no cover
        logging.getLogger(__name__).error("init_db failed (continuing): %s", e)
```

- [ ] **Step 6: Run → PASS** (`pytest tests/test_auth_models.py -v`).

- [ ] **Step 7: Generate migration**
Run (from `backend/`):
`$env:DATABASE_URL="sqlite:///alembic_tmp.db"; .\.venv\Scripts\alembic.exe revision --autogenerate -m "auth: user columns + oauth/email_tokens/login_attempts"`
Then edit the new revision's `upgrade()` to also wipe seed data at the end:
```python
    op.execute("DELETE FROM watchlist_items")
    op.execute("DELETE FROM holdings")
    op.execute("DELETE FROM alert_log")
    op.execute("DELETE FROM custom_symbols")
    op.execute("DELETE FROM settings")
    op.execute("DELETE FROM users")
```
Verify `alembic upgrade head` succeeds, then delete `alembic_tmp.db`.

- [ ] **Step 8: Commit**
```bash
git add backend/requirements.txt backend/models.py backend/db.py backend/migrations backend/tests/test_auth_models.py
git commit -m "feat(auth): user auth columns + oauth/token/attempt tables + migration"
```

---

### Task 2: Password hashing + policy

**Files:** Create `backend/auth/__init__.py` (empty), `backend/auth/passwords.py`; Test `backend/tests/test_passwords.py`.

**Interfaces:**
- `hash_password(pw: str) -> str`
- `verify_password(pw: str, hashed: str) -> bool`
- `valid_password(pw: str) -> bool` (≥8 chars)

- [ ] **Step 1: Failing test** — `backend/tests/test_passwords.py`:
```python
from auth.passwords import hash_password, verify_password, valid_password


def test_hash_verify_roundtrip():
    h = hash_password("hunter2hunter")
    assert h != "hunter2hunter"
    assert verify_password("hunter2hunter", h) is True
    assert verify_password("wrong", h) is False


def test_policy():
    assert valid_password("12345678") is True
    assert valid_password("short") is False
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** — `backend/auth/passwords.py`:
```python
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

_ph = PasswordHasher()


def hash_password(pw: str) -> str:
    return _ph.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    if not hashed:
        return False
    try:
        return _ph.verify(hashed, pw)
    except VerifyMismatchError:
        return False
    except Exception:
        return False


def valid_password(pw: str) -> bool:
    return isinstance(pw, str) and len(pw) >= 8
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** `feat(auth): argon2 password hashing + policy`.

---

### Task 3: Email tokens (hash-before-store, expiry, single-use)

**Files:** Create `backend/auth/tokens.py`; Test `backend/tests/test_tokens.py`.

**Interfaces:**
- `create_token(user_id: int, kind: str, ttl_hours: int) -> str` — returns the
  RAW token (to email); stores its SHA-256 hash in `email_tokens`.
- `consume_token(raw: str, kind: str) -> int | None` — returns user_id if valid
  (unexpired, unused, kind matches), marking it used; else None.

- [ ] **Step 1: Failing test** — `backend/tests/test_tokens.py`:
```python
import auth.tokens as tk
import models, db


def _mk_user():
    with db.get_session() as s:
        u = models.User(email="tok@b.com"); s.add(u); s.commit(); return u.id


def test_create_and_consume():
    uid = _mk_user()
    raw = tk.create_token(uid, "verify", 24)
    assert isinstance(raw, str) and len(raw) > 20
    # raw token is not stored directly
    with db.get_session() as s:
        row = s.query(models.EmailToken).filter_by(user_id=uid).first()
        assert row.token_hash != raw
    assert tk.consume_token(raw, "verify") == uid
    # single use
    assert tk.consume_token(raw, "verify") is None


def test_wrong_kind_and_expiry():
    uid = _mk_user()
    raw = tk.create_token(uid, "reset", 1)
    assert tk.consume_token(raw, "verify") is None  # kind mismatch
    assert tk.consume_token(raw, "reset") == uid


def test_expired(monkeypatch):
    uid = _mk_user()
    raw = tk.create_token(uid, "verify", -1)  # already expired
    assert tk.consume_token(raw, "verify") is None
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** — `backend/auth/tokens.py`:
```python
import datetime as dt
import hashlib
import secrets

import db
import models


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def create_token(user_id: int, kind: str, ttl_hours: int) -> str:
    raw = secrets.token_urlsafe(32)
    expires = dt.datetime.utcnow() + dt.timedelta(hours=ttl_hours)
    with db.get_session() as s:
        s.add(models.EmailToken(user_id=user_id, kind=kind,
                                token_hash=_hash(raw), expires_at=expires))
        s.commit()
    return raw


def consume_token(raw: str, kind: str):
    h = _hash(raw)
    now = dt.datetime.utcnow()
    with db.get_session() as s:
        row = (s.query(models.EmailToken)
               .filter_by(token_hash=h, kind=kind, used_at=None).first())
        if not row or row.expires_at < now:
            return None
        row.used_at = now
        s.commit()
        return row.user_id
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** `feat(auth): email token create/consume (hashed, single-use, expiring)`.

---

### Task 4: Resend email provider (best-effort, mockable)

**Files:** Create `backend/providers/email.py`; Test `backend/tests/test_email_provider.py`.

**Interfaces:**
- `send_verify_email(to: str, link: str) -> bool`
- `send_reset_email(to: str, link: str) -> bool`
  Both return True on send, False on failure (never raise). No-op returning
  False when `RESEND_API_KEY` unset (dev/test).

- [ ] **Step 1: Failing test** — `backend/tests/test_email_provider.py`:
```python
import providers.email as email


def test_no_key_is_noop(monkeypatch):
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    assert email.send_verify_email("a@b.com", "http://x/verify?token=1") is False


def test_send_calls_resend(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "test")
    monkeypatch.setenv("MAIL_FROM", "noreply@x.com")
    calls = {}
    def fake_send(payload):
        calls.update(payload); return {"id": "1"}
    monkeypatch.setattr(email, "_resend_send", fake_send)
    ok = email.send_reset_email("a@b.com", "http://x/reset?token=2")
    assert ok is True and calls["to"] == ["a@b.com"] and "reset" in calls["html"]


def test_send_failure_returns_false(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY", "test")
    monkeypatch.setattr(email, "_resend_send", lambda p: (_ for _ in ()).throw(RuntimeError("down")))
    assert email.send_verify_email("a@b.com", "http://x") is False
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** — `backend/providers/email.py`:
```python
import logging
import os

logger = logging.getLogger(__name__)


def _resend_send(payload: dict):
    import resend
    resend.api_key = os.environ["RESEND_API_KEY"]
    return resend.Emails.send(payload)


def _send(to: str, subject: str, html: str) -> bool:
    if not os.environ.get("RESEND_API_KEY"):
        logger.info("RESEND_API_KEY unset; skipping email to %s", to)
        return False
    try:
        _resend_send({
            "from": os.environ.get("MAIL_FROM", "noreply@example.com"),
            "to": [to], "subject": subject, "html": html,
        })
        return True
    except Exception as e:
        logger.error("email send failed to %s: %s", to, e)
        return False


def send_verify_email(to: str, link: str) -> bool:
    html = (f'<p>Welcome to Ticker Tracker. Confirm your email to finish '
            f'signing up:</p><p><a href="{link}">Verify my email</a></p>'
            f'<p>This link expires in 24 hours.</p>')
    return _send(to, "Verify your Ticker Tracker email", html)


def send_reset_email(to: str, link: str) -> bool:
    html = (f'<p>Reset your Ticker Tracker password:</p>'
            f'<p><a href="{link}">Reset password</a></p>'
            f'<p>This link expires in 1 hour. If you did not request this, '
            f'ignore this email.</p>')
    return _send(to, "Reset your Ticker Tracker password", html)
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** `feat(auth): Resend email provider (verify + reset, best-effort)`.

---

### Task 5: Login rate limiting

**Files:** Create `backend/auth/rate_limit.py`; Test `backend/tests/test_rate_limit.py`.

**Interfaces:**
- `record_attempt(email: str, ip: str, success: bool) -> None`
- `is_locked(email: str, ip: str) -> bool` — True if ≥5 failures in last 15 min.

- [ ] **Step 1: Failing test** — `backend/tests/test_rate_limit.py`:
```python
import auth.rate_limit as rl


def test_locks_after_five_failures():
    for _ in range(4):
        rl.record_attempt("x@b.com", "1.1.1.1", False)
    assert rl.is_locked("x@b.com", "1.1.1.1") is False
    rl.record_attempt("x@b.com", "1.1.1.1", False)
    assert rl.is_locked("x@b.com", "1.1.1.1") is True


def test_other_identity_not_locked():
    for _ in range(5):
        rl.record_attempt("y@b.com", "1.1.1.1", False)
    assert rl.is_locked("z@b.com", "9.9.9.9") is False
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** — `backend/auth/rate_limit.py`:
```python
import datetime as dt

import db
import models

WINDOW_MIN = 15
MAX_FAILURES = 5


def record_attempt(email: str, ip: str, success: bool) -> None:
    with db.get_session() as s:
        s.add(models.LoginAttempt(email=(email or "").lower(), ip=ip or "", success=success))
        s.commit()


def is_locked(email: str, ip: str) -> bool:
    cutoff = dt.datetime.utcnow() - dt.timedelta(minutes=WINDOW_MIN)
    with db.get_session() as s:
        n = (s.query(models.LoginAttempt)
             .filter(models.LoginAttempt.email == (email or "").lower(),
                     models.LoginAttempt.ip == (ip or ""),
                     models.LoginAttempt.success == False,  # noqa: E712
                     models.LoginAttempt.created_at >= cutoff)
             .count())
        return n >= MAX_FAILURES
```
Note: `created_at` uses `server_default=func.now()`; for SQLite tests this is set
on flush. If the test DB returns naive timestamps, the comparison still holds
since both are naive UTC.

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** `feat(auth): Postgres-backed login rate limiting`.

---

### Task 6: Flask-Login setup + current_user_id replacement

**Files:** Modify `backend/auth.py`, `backend/app.py`; Test `backend/tests/test_login_manager.py`.

**Interfaces:**
- `auth.current_user_id() -> int | None` (session user id or None).
- `auth.login_manager` configured on the app; `User` gets Flask-Login mixin
  behavior via a loader.

- [ ] **Step 1: Failing test** — `backend/tests/test_login_manager.py`:
```python
from app import app
import auth


def test_anonymous_current_user_id_is_none():
    with app.test_request_context("/"):
        assert auth.current_user_id() is None


def test_login_manager_registered():
    assert app.config.get("SECRET_KEY")
    assert "_login" in app.extensions or hasattr(app, "login_manager")
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** — replace `backend/auth.py`:
```python
import os
from flask_login import LoginManager, current_user

login_manager = LoginManager()


def init_login(app):
    app.config.setdefault("SECRET_KEY", os.environ.get("SECRET_KEY", "dev-insecure-change-me"))
    login_manager.init_app(app)

    @login_manager.user_loader
    def load_user(user_id):
        import db, models
        with db.get_session() as s:
            return s.get(models.User, int(user_id))

    # API: return 401 JSON instead of redirecting to a login page.
    @login_manager.unauthorized_handler
    def _unauth():
        from flask import jsonify
        return jsonify({"error": "authentication required"}), 401


def current_user_id():
    return int(current_user.id) if getattr(current_user, "is_authenticated", False) else None
```
Add Flask-Login mixin to `User` in `models.py`:
```python
from flask_login import UserMixin
class User(UserMixin, Base):
    ...
```
In `backend/app.py`, after `app = Flask(...)`, call:
```python
from auth import init_login
init_login(app)
```
Set a real cookie policy in `init_login` after `init_app`:
```python
    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=bool(os.environ.get("APP_BASE_URL", "").startswith("https")),
        REMEMBER_COOKIE_HTTPONLY=True,
    )
```

- [ ] **Step 4: Run → PASS.** Also run full suite to confirm `current_user_id()`
change didn't break store/route imports: `pytest -q`.

- [ ] **Step 5: Commit** `feat(auth): Flask-Login setup, session current_user_id, 401 handler`.

---

### Task 7: Auth routes — signup, verify, login, logout, me

**Files:** Create `backend/auth/routes.py`; Modify `backend/app.py` (register blueprint); Test `backend/tests/test_auth_routes.py`.

**Interfaces (blueprint `auth_bp`, registered at `/api/auth`):**
- `POST /signup {email,password,name?}` → 200 `{message}`; 400 on bad input;
  200 generic even if email exists (no enumeration).
- `GET /verify?token=` → 302 redirect to `APP_BASE_URL` (logged in) or error page.
- `POST /login {email,password}` → 200 `{user}` + session cookie; 401 generic;
  403 if unverified; 423 if rate-locked.
- `POST /logout` → 200.
- `GET /me` → 200 `{user}` or `{user: null}`.

- [ ] **Step 1: Failing test** — `backend/tests/test_auth_routes.py`:
```python
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
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** — `backend/auth/routes.py`:
```python
import os
from flask import Blueprint, request, jsonify, redirect
from flask_login import login_user, logout_user, current_user

import db
import models
from auth.passwords import hash_password, verify_password, valid_password
from auth.tokens import create_token, consume_token
from auth.rate_limit import record_attempt, is_locked
from providers.email import send_verify_email, send_reset_email

auth_bp = Blueprint("auth", __name__)


def _public_user(u):
    return {"id": u.id, "email": u.email, "name": u.name or "",
            "email_verified": bool(u.email_verified)}


def _base():
    return os.environ.get("APP_BASE_URL", request.host_url.rstrip("/"))


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
    ip = request.headers.get("X-Forwarded-For", request.remote_addr or "")
    if is_locked(email, ip):
        return jsonify({"error": "too many attempts, try again later"}), 423
    with db.get_session() as s:
        u = s.query(models.User).filter_by(email=email).first()
        ok = bool(u and verify_password(password, u.password_hash or ""))
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
```
Register in `backend/app.py` (after `init_login(app)`):
```python
from auth.routes import auth_bp
app.register_blueprint(auth_bp, url_prefix="/api/auth")
```

- [ ] **Step 4: Run → PASS** (`pytest tests/test_auth_routes.py -v`).
- [ ] **Step 5: Commit** `feat(auth): signup/verify/login/logout/me routes`.

---

### Task 8: Password reset (forgot + reset)

**Files:** Modify `backend/auth/routes.py`; Test add to `backend/tests/test_auth_routes.py`.

**Interfaces:**
- `POST /forgot {email}` → always 200 (no enumeration); sends reset link if user
  exists with a password.
- `POST /reset {token,password}` → 200 on success; 400 invalid token / bad pw.

- [ ] **Step 1: Failing test** — append to `test_auth_routes.py`:
```python
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
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** — append to `backend/auth/routes.py`:
```python
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
```

- [ ] **Step 4: Run → PASS.**
- [ ] **Step 5: Commit** `feat(auth): password reset (forgot + reset)`.

---

### Task 9: Google OAuth

**Files:** Create `backend/auth/google.py`; Modify `backend/auth/routes.py`, `backend/app.py`; Test `backend/tests/test_google_oauth.py`.

**Interfaces:**
- `google.register(app)` — sets up Authlib OAuth client when creds present.
- `google.upsert_google_user(subject: str, email: str, name: str) -> User` —
  links/creates user by (provider, subject), else by verified email.
- Routes `GET /google` (redirect) and `GET /google/callback`.

- [ ] **Step 1: Failing test** — `backend/tests/test_google_oauth.py` (tests the
upsert logic directly; the redirect dance is integration-only):
```python
from auth.google import upsert_google_user
import db, models


def test_creates_user_and_identity():
    u = upsert_google_user("sub-1", "g1@b.com", "G One")
    assert u.email == "g1@b.com" and u.email_verified is True
    with db.get_session() as s:
        assert s.query(models.OAuthIdentity).filter_by(provider="google", subject="sub-1").count() == 1


def test_links_existing_email():
    with db.get_session() as s:
        s.add(models.User(email="link@b.com", password_hash="x", email_verified=True)); s.commit()
    u = upsert_google_user("sub-2", "link@b.com", "Linked")
    assert u.email == "link@b.com"
    with db.get_session() as s:
        assert s.query(models.OAuthIdentity).filter_by(subject="sub-2").first().user_id == u.id


def test_returns_same_user_on_repeat():
    a = upsert_google_user("sub-3", "rep@b.com", "R")
    b = upsert_google_user("sub-3", "rep@b.com", "R")
    assert a.id == b.id
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** — `backend/auth/google.py`:
```python
import os
from authlib.integrations.flask_client import OAuth

import db
import models

oauth = OAuth()


def register(app):
    if not os.environ.get("GOOGLE_CLIENT_ID"):
        return
    oauth.init_app(app)
    oauth.register(
        name="google",
        client_id=os.environ["GOOGLE_CLIENT_ID"],
        client_secret=os.environ["GOOGLE_CLIENT_SECRET"],
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )


def upsert_google_user(subject: str, email: str, name: str):
    email = (email or "").strip().lower()
    with db.get_session() as s:
        ident = s.query(models.OAuthIdentity).filter_by(provider="google", subject=subject).first()
        if ident:
            return s.get(models.User, ident.user_id)
        u = s.query(models.User).filter_by(email=email).first()
        if u is None:
            u = models.User(email=email, name=name or "", email_verified=True)
            s.add(u); s.commit()
        else:
            u.email_verified = True; s.commit()
        s.add(models.OAuthIdentity(user_id=u.id, provider="google", subject=subject))
        s.commit()
        return s.get(models.User, u.id)
```
Append routes to `backend/auth/routes.py`:
```python
from authlib.integrations.flask_client import OAuthError
from auth.google import oauth, upsert_google_user


@auth_bp.get("/google")
def google_login():
    if "google" not in getattr(oauth, "_clients", {}):
        return jsonify({"error": "google oauth not configured"}), 503
    return oauth.google.authorize_redirect(f"{_base()}/api/auth/google/callback")


@auth_bp.get("/google/callback")
def google_callback():
    try:
        token = oauth.google.authorize_access_token()
        info = token.get("userinfo") or {}
        sub, email, name = info.get("sub"), info.get("email"), info.get("name", "")
        if not sub or not email:
            return redirect(f"{_base()}/?auth=failed")
        u = upsert_google_user(sub, email, name)
        login_user(u)
        return redirect(f"{_base()}/?auth=ok")
    except OAuthError:
        return redirect(f"{_base()}/?auth=failed")
```
Register in `backend/app.py` (after blueprint):
```python
from auth.google import register as register_google
register_google(app)
```

- [ ] **Step 4: Run → PASS** (`pytest tests/test_google_oauth.py -v`).
- [ ] **Step 5: Commit** `feat(auth): Google OAuth (Authlib) login + identity upsert`.

---

### Task 10: Scope personalization routes to the session user

**Files:** Modify `backend/app.py` (watchlist/settings/holdings routes); Modify `backend/services/store.py` (already uses `current_user_id()` — now returns None when anon); Test `backend/tests/test_auth_scoping.py`.

**Interfaces:** personalization routes return 401 when anonymous; otherwise scope
to `current_user.id`. `store.py` functions raise/short-circuit on `None` uid.

- [ ] **Step 1: Failing test** — `backend/tests/test_auth_scoping.py`:
```python
import auth.routes as routes
from app import app


def _verified_client(email):
    c = app.test_client()
    import db, models
    from auth.passwords import hash_password
    with db.get_session() as s:
        s.add(models.User(email=email, password_hash=hash_password("password123"), email_verified=True)); s.commit()
    c.post("/api/auth/login", json={"email": email, "password": "password123"})
    return c


def test_anonymous_blocked_on_personalization():
    c = app.test_client()
    assert c.get("/api/watchlist").status_code == 401
    assert c.post("/api/watchlist", json={"symbol": "AAPL"}).status_code == 401
    assert c.get("/api/settings").status_code == 401


def test_public_routes_open_when_anonymous(monkeypatch):
    import cache; cache.clear()
    import services.quotes as q
    monkeypatch.setattr(q, "fetch_quote", lambda s: (_ for _ in ()).throw(RuntimeError("x")))
    c = app.test_client()
    assert c.get("/api/quotes?syms=AAPL").status_code == 200
    assert c.get("/api/health").status_code == 200


def test_users_are_isolated():
    a = _verified_client("a@iso.com"); b = _verified_client("b@iso.com")
    a.post("/api/watchlist", json={"symbol": "AAPL"})
    assert any(w["symbol"] == "AAPL" for w in a.get("/api/watchlist").get_json()["data"])
    assert b.get("/api/watchlist").get_json()["data"] == []
```

- [ ] **Step 2: Run → FAIL** (currently routes use uid=1, no 401).

- [ ] **Step 3: Implement** — in `backend/app.py`, add a guard helper and apply it
to each personalization route:
```python
from flask_login import current_user

def _require_user():
    if not getattr(current_user, "is_authenticated", False):
        return None
    return int(current_user.id)
```
At the top of each of `watchlist_get/post`, `watchlist_patch`, `watchlist_delete`,
`settings_get/patch`, `holdings_get/post`, `holdings_delete`, add:
```python
    if _require_user() is None:
        return envelope({"error": "authentication required"}), 401
```
In `backend/services/store.py`, change `current_user_id()` usages to fetch the
real id and guard None (it now comes from `auth.current_user_id`). Since the
routes already block anonymous, store functions will always receive a real user;
no change needed beyond confirming `from auth import current_user_id` resolves.

- [ ] **Step 4: Run → PASS** (`pytest tests/test_auth_scoping.py -v`), then full
suite `pytest -q` (older store-route tests that assumed uid=1 must now log in
first — update `test_store_routes.py` to create+login a verified user in a
fixture before calling personalization routes).

- [ ] **Step 5: Commit** `feat(auth): scope watchlist/settings/holdings to session user (401 anon)`.

---

### Task 11: Frontend — auth store slice + API client

**Files:** Modify `frontend/src/api/types.ts`, `frontend/src/api/client.ts`, `frontend/src/state/store.ts`; Test `frontend/src/state/store.test.ts`.

**Interfaces:**
- `api` gains `me/login/signup/logout/forgot/reset`; all `fetch` calls include
  `credentials: 'include'`.
- store: `currentUser: AuthUser | null`, `isAuthed` (selector), `loadMe()`,
  `login(email,pw)`, `signup(...)`, `logout()`, `forgot(email)`, `reset(token,pw)`.

- [ ] **Step 1: Add types** — `frontend/src/api/types.ts`:
```typescript
export interface AuthUser { id: number; email: string; name: string; email_verified: boolean }
```

- [ ] **Step 2: API client** — in `frontend/src/api/client.ts`, add
`credentials: 'include'` to both `get` and `send` fetch options, and add:
```typescript
  me: () => get<{ user: AuthUser | null }>('/api/auth/me'),
  login: (email: string, password: string) => send<{ user: AuthUser }>('/api/auth/login', 'POST', { email, password }),
  signup: (email: string, password: string, name?: string) => send<{ message: string }>('/api/auth/signup', 'POST', { email, password, name }),
  logout: () => send<{ message: string }>('/api/auth/logout', 'POST'),
  forgot: (email: string) => send<{ message: string }>('/api/auth/forgot', 'POST', { email }),
  reset: (token: string, password: string) => send<{ message: string }>('/api/auth/reset', 'POST', { token, password }),
```
(`get`/`send` return `{data, source, stale}`; auth endpoints ignore meta — wrap
so a non-enveloped JSON `{user}` is read from `data` if present, else the raw
body. Simplest: add a `raw` variant — see Step 3.)

- [ ] **Step 3: store auth slice** — add to `frontend/src/state/store.ts` state +
actions:
```typescript
  currentUser: AuthUser | null
  authChecked: boolean
  loadMe: () => Promise<void>
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signup: (email: string, password: string, name?: string) => Promise<{ ok: boolean; error?: string }>
  logout: () => Promise<void>
```
Implementation (using direct fetch for clean status handling):
```typescript
  currentUser: null,
  authChecked: false,
  loadMe: async () => {
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include' })
      const j = await r.json()
      set({ currentUser: j.user ?? null, authChecked: true })
    } catch { set({ authChecked: true }) }
  },
  login: async (email, password) => {
    const r = await fetch('/api/auth/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    if (!r.ok) { const j = await r.json().catch(() => ({})); return { ok: false, error: j.error || 'Login failed' } }
    const j = await r.json(); set({ currentUser: j.user })
    return { ok: true }
  },
  signup: async (email, password, name) => {
    const r = await fetch('/api/auth/signup', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, name }) })
    const j = await r.json().catch(() => ({}))
    return r.ok ? { ok: true } : { ok: false, error: j.error || 'Signup failed' }
  },
  logout: async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' })
    set({ currentUser: null, watchlist: [], holdings: [] })
  },
```
Add `isAuthed` as a selector: `(s) => s.currentUser !== null`.

- [ ] **Step 4: Vitest** — install + configure Vitest, `frontend/src/state/store.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStore } from './store'

beforeEach(() => { useStore.setState({ currentUser: null }) })

describe('auth store', () => {
  it('login sets currentUser', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ user: { id: 1, email: 'a@b.com', name: '', email_verified: true } }) }) as never
    const res = await useStore.getState().login('a@b.com', 'password123')
    expect(res.ok).toBe(true)
    expect(useStore.getState().currentUser?.email).toBe('a@b.com')
  })
  it('login failure returns error', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'invalid email or password' }) }) as never
    const res = await useStore.getState().login('a@b.com', 'x')
    expect(res.ok).toBe(false)
    expect(useStore.getState().currentUser).toBeNull()
  })
})
```
Add to `frontend/package.json` devDeps `vitest`, script `"test": "vitest run"`.
Run: `npm run test`.

- [ ] **Step 5: Commit** `feat(frontend): auth store slice + credentialed API client + Vitest`.

---

### Task 12: Frontend — AuthScreen + moat guard + demo watchlist + chrome

**Files:** Create `frontend/src/components/AuthScreen.tsx`, `frontend/src/hooks/useRequireAuth.ts`, `frontend/src/data/demo.ts`; Modify `frontend/src/components/Watchlist.tsx`, `frontend/src/components/Header.tsx`, `frontend/src/views/Settings.tsx`, `frontend/src/App.tsx`.

**Interfaces:**
- `useRequireAuth()` → `(action: () => void) => void` (runs action if authed, else opens AuthScreen).
- `DEMO_WATCH: string[]` (the read-only anon list).
- store gains `authModal: boolean`, `openAuth()`, `closeAuth()`.

- [ ] **Step 1: demo list** — `frontend/src/data/demo.ts`:
```typescript
import { DEFAULT_WATCH } from './universe'
export const DEMO_WATCH = DEFAULT_WATCH
```

- [ ] **Step 2: store modal flags** — add to store: `authModal: false`,
`openAuth: () => set({ authModal: true })`, `closeAuth: () => set({ authModal: false })`.

- [ ] **Step 3: requireAuth hook** — `frontend/src/hooks/useRequireAuth.ts`:
```typescript
import { useStore } from '../state/store'
export function useRequireAuth() {
  const isAuthed = useStore((s) => s.currentUser !== null)
  const openAuth = useStore((s) => s.openAuth)
  return (action: () => void) => { if (isAuthed) action(); else openAuth() }
}
```

- [ ] **Step 4: Watchlist branch** — in `frontend/src/components/Watchlist.tsx`:
  - read `isAuthed`; when anonymous, source the list from `DEMO_WATCH` (mapped to
    the same card shape) and wrap Add/edit/remove/target/drag handlers in
    `requireAuth(...)` so clicks open the auth modal.
  - the "Add ticker" footer button calls `requireAuth(() => setShowAdd(true))`.

- [ ] **Step 5: AuthScreen** — `frontend/src/components/AuthScreen.tsx`: a modal
(uses design tokens) with `mode` state `login|signup|forgot`, fields, a
"Continue with Google" button linking to `/api/auth/google`, error display, and
calls to store `login/signup/forgot`. On signup success show "check your email".
Reads `authModal`; renders null when false. Include a reset view when URL has
`?reset_token=`.

- [ ] **Step 6: chrome** — Header: when `!isAuthed` show a "Sign in" button
(calls `openAuth`) in the avatar slot; when authed show avatar → Settings.
Settings: add "Sign out" (calls `logout`) and show email-verified status.

- [ ] **Step 7: App wiring** — `frontend/src/App.tsx`: call `loadMe()` in the
startup effect; render `<AuthScreen />` always (it self-hides). Handle
`?verify=ok|failed` and `?reset_token=` query params on load (open the right
AuthScreen state / toast).

- [ ] **Step 8: build + verify** — `npm run build` (type-check), then run dev +
backend and confirm: anonymous sees demo list; clicking Add opens AuthScreen;
signup→ (mock email link) →verify→login shows personal empty watchlist; logout
returns to demo. `npm run test` green.

- [ ] **Step 9: Commit** `feat(frontend): AuthScreen, moat guard, demo watchlist, auth chrome`.

---

### Task 13: Deploy config + docs

**Files:** Modify `Dockerfile` (none needed — same), `.env.example`, `README.md`, `CHANGELOG.md`, `VERSION`, `frontend/package.json`.

- [ ] **Step 1: .env.example** — add `SECRET_KEY`, `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, `APP_BASE_URL` with
comments.
- [ ] **Step 2: README** — add an "Authentication" section (env vars, Google
OAuth app setup with redirect `…/api/auth/google/callback`, Resend setup).
- [ ] **Step 3: CHANGELOG + VERSION** — new minor version (e.g. 1.1.0) describing
multi-user auth.
- [ ] **Step 4: Full test pass** — backend `pytest -q` (all green incl. updated
store-route tests), frontend `npm run test` + `npm run build`.
- [ ] **Step 5: Commit + tag** `feat(auth): docs + env + v1.1.0`; `git tag v1.1.0`.

---

## Milestone

Backend: signup→verify→login, Google OAuth, forgot/reset, rate limiting, and
per-user scoping all green under pytest with Resend + Google mocked. Frontend:
anonymous demo browsing + moat redirect + authenticated personalization,
type-checked and Vitest-green. Ready to register Google/Resend creds, set Railway
vars, deploy, and run the migration (which wipes seed data).

## Self-Review

- **Spec coverage:** §2 stack (Flask-Login/Authlib/argon2/resend) → Task 1,2,4,6,9 ✓. §3 schema → Task 1 ✓. §4 endpoints signup/verify/login/logout/me/forgot/reset/google → Tasks 7,8,9 ✓; scoping + public-open → Task 10 ✓; rate limit → Task 5 ✓. §5 frontend store/AuthScreen/moat/demo/chrome → Tasks 11,12 ✓. §6 security (argon2, hashed tokens, single-use, enumeration-safe, IDOR scoping, cookie flags) → Tasks 2,3,6,7,10 ✓; testing → each task's tests + Task 13 full pass ✓. §7 rollout → Task 13 ✓.
- **Placeholder scan:** none — every step has concrete code/commands.
- **Type consistency:** `current_user_id() -> int | None` (Task 6) used by store guard (Task 10); `_public_user` shape `{id,email,name,email_verified}` matches frontend `AuthUser` (Task 11); `create_token/consume_token` signatures consistent across Tasks 3,7,8,9; `upsert_google_user(subject,email,name)` consistent Task 9.
- **Note:** Task 10 requires updating the existing `test_store_routes.py` to log in first (called out in its Step 4); flagged so it isn't missed.
