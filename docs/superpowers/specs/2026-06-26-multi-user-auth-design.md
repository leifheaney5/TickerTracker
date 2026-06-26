# Multi-User Authentication — Design Spec

**Date:** 2026-06-26
**Status:** Approved
**Branch:** `feature/auth`
**Goal:** Add optional multi-user authentication to Ticker Tracker so anyone can
browse for free, but personalization (their own watchlist, targets, alerts,
portfolio, settings) requires a free account — a freemium "moat" where attempting
a personalized action prompts signup.

---

## 1. Context

Ticker Tracker is live on Railway (single Flask service serving the React SPA +
`/api`, with a Postgres plugin). The schema is already multi-user-ready (every
user-owned table carries `user_id`), but the app runs as one hardcoded user
(`current_user_id() = 1`, auto-seeded). There is no auth, no credentials storage,
and no login. This spec adds real authentication.

### Locked product decisions

| Decision | Choice |
|---|---|
| Auth methods | Email+password **and** Google OAuth |
| Email verification | Required, via Resend |
| Password reset | Email link via Resend (hashed token, 1h expiry, single-use) |
| Password policy | 8-char minimum (NIST-style; length over complexity) |
| Login protection | 5 failed attempts / 15 min / (email+IP) → 15 min lockout (423) |
| Sessions | Server-side signed HTTP-only cookies (Flask-Login) |
| Access model | Freemium moat — browsing free; personalization gated |
| Logged-out UX | Read-only demo watchlist + full market data; gated clicks → signup |
| OAuth providers | Google only (schema is multi-provider for later) |
| Existing data | Wiped for a clean public launch; remove the hardcoded seed user |

---

## 2. Architecture & Stack

**Libraries (backend):**
- `Flask-Login` — session management via signed HTTP-only cookies, `current_user`.
- `Authlib` — Google OAuth 2.0.
- `argon2-cffi` — password hashing.
- `resend` — transactional email (verification + reset).
- `itsdangerous` (already present) — sign/verify email + reset tokens.

**New backend modules** (focused files, matching the existing `services/` /
`providers/` structure):
```
backend/
  auth/
    __init__.py
    routes.py        # /api/auth/* endpoints
    passwords.py     # argon2 hash/verify + 8-char policy
    tokens.py        # itsdangerous sign/verify; hash-before-store helpers
    rate_limit.py    # login/forgot attempt limiter (Postgres-backed)
    google.py        # Authlib Google client + callback handling
  providers/
    email.py         # Resend send wrappers (verify + reset templates)
```
`auth.py` (currently `current_user_id() -> 1`) is replaced by Flask-Login:
`current_user_id()` returns the session user's id, or `None` when anonymous.

**Config (env vars, set on Railway):**
- `SECRET_KEY` — signs cookies + tokens (strong random).
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- `RESEND_API_KEY`, `MAIL_FROM`.
- `APP_BASE_URL` — builds verification/reset links + OAuth redirect base.

**Frontend:** an `auth` slice in the Zustand store (`currentUser`, `isAuthed`),
an `AuthScreen` (login / signup / forgot / reset / verify-interstitial), and a
reusable `requireAuth(action)` guard that redirects gated clicks to signup. The
API client sends `credentials: 'include'` so the session cookie rides along — no
token plumbing in JS.

---

## 3. Database Schema

**Modify `users`:**
```
users
  id              PK (existing)
  email           UNIQUE, NOT NULL, indexed (stored lowercased)
  name, phone     (existing)
  password_hash   TEXT nullable      (null for OAuth-only accounts)
  email_verified  BOOLEAN default false
  created_at      (existing)
```

**New tables:**
```
oauth_identities
  id PK
  user_id    → users.id, indexed
  provider   TEXT            ('google')
  subject    TEXT            (provider stable id, "sub")
  UNIQUE(provider, subject)

email_tokens
  id PK
  user_id    → users.id, indexed
  kind       TEXT            ('verify' | 'reset')
  token_hash TEXT            (SHA-256 of the raw token; raw never stored)
  expires_at TIMESTAMP
  used_at    TIMESTAMP nullable   (single-use enforcement)

login_attempts
  id PK
  email      TEXT indexed
  ip         TEXT
  created_at TIMESTAMP indexed
  success    BOOLEAN
```

**Migration:** a new Alembic revision adds the columns + tables and wipes
existing seed data (the `user id=1` row and its dependent rows). The auto-seed in
`init_db()` is removed.

**Security rationale:** store token *hashes* (DB leak can't verify/reset
accounts); `password_hash` nullable supports Google-only accounts; separate
`oauth_identities` allows multiple providers per account later without schema
change. Existing personalization tables (`watchlist_items`, `holdings`,
`alert_log`, `settings`, `custom_symbols`) are unchanged — they start empty and
fill per real user.

---

## 4. Backend Endpoints & Flows

**Auth endpoints** (`/api/auth/*`, JSON, manage the session cookie):
```
POST /api/auth/signup   {email, password, name?}
    → create user (email_verified=false), argon2 hash, create 'verify' token,
      email link via Resend. Returns 200 "check your email". No login until
      verified.
GET  /api/auth/verify?token=
    → validate (unexpired, unused, hash match) → email_verified=true, mark used,
      log in, redirect to app.
POST /api/auth/login    {email, password}
    → rate-limit check; verify hash; require email_verified; start session.
      Generic error on failure (no enumeration).
POST /api/auth/logout   → clear session.
GET  /api/auth/me       → {user} or {user: null}.
POST /api/auth/forgot   {email}
    → always 200 (no enumeration); if exists, send 'reset' link via Resend.
POST /api/auth/reset    {token, password}
    → validate token, set new hash, mark used, invalidate other reset tokens.
GET  /api/auth/google           → redirect to Google consent (Authlib, state).
GET  /api/auth/google/callback  → exchange code, upsert user + oauth_identity by
      (provider, subject); Google email pre-verified → email_verified=true; start
      session; redirect to app.
```

**Personalization routes become auth-scoped.** Existing watchlist/settings/
holdings routes: require a session (401 if anonymous) and scope every query to
`current_user.id`. The frontend treats 401 as the moat trigger.

**Public routes unchanged (no auth):** `/api/quotes`, `/api/history`,
`/api/fundamentals`, `/api/crypto`, `/api/fng`, `/api/news`, `/api/ratings`,
`/api/health` — logged-out browsing + demo watchlist work fully.

**Rate limiting:** `login` + `forgot` record `login_attempts`; 5 failures per
(email+IP) in 15 min → 423 for 15 min; rows older than the window are pruned.

**Resend** (`providers/email.py`): two templated emails (verify, reset) linking
to `APP_BASE_URL`. Best-effort: a Resend outage logs an error but the endpoint
still returns 200 (token persisted; user can re-request).

---

## 5. Frontend

**Store `auth` slice:**
```
currentUser: {id, email, name, email_verified} | null
isAuthed:    derived boolean
loadMe()     → GET /api/auth/me on app start
login / signup / logout / forgot / reset → call API, refresh currentUser
```
API client uses `credentials: 'include'`.

**Demo vs real watchlist:**
- Anonymous → read-only demo list (current default tickers) from a static client
  constant; no API writes. Selecting a ticker still drives the public
  chart/stats/news.
- Authenticated → DB-backed `/api/watchlist` scoped to the user; new users start
  empty with the "Add a ticker" prompt.

**Moat guard (one reusable mechanism):**
```
requireAuth(action)  // isAuthed → run; else → open AuthScreen(signup)
```
Applied to: Add ticker, edit/remove card, set/edit target, set/edit alert,
drag-reorder. Controls render for anonymous users (value visible) but clicking
routes to signup with a short context line.

**`AuthScreen`** (same design tokens) with states: Login (email/password +
"Continue with Google" + "Forgot password?"), Sign up, Forgot password, Reset
(via emailed link), and a post-signup "verify your email" interstitial; handles
`?token=` verify/reset deep links.

**Header:** logged-out → "Sign in" button (avatar slot); logged-in → avatar →
Settings, which gains Sign out + email-verified status. Brokerage "Connect
account" chip is unrelated and unchanged.

**Gated views:** Holdings/Alerts show "Sign in to track…" prompts for anonymous
users instead of data.

---

## 6. Error Handling, Security & Testing

**Error handling:**
- Account enumeration prevented on `login` + `forgot` (generic responses).
- Expired/used/invalid tokens → friendly message + resend path.
- Resend outage → endpoint still 200; logged error; user-visible "resend".
- OAuth cancel/state-mismatch → redirect to AuthScreen with readable message.
- Email collision: existing password account → generic "check your email";
  Google sign-in matching an existing verified email links to that account.

**Security:**
- argon2 hashing; 8-char min enforced server-side.
- HTTP-only + Secure + SameSite=Lax session cookies; `SECRET_KEY` from env.
- Tokens random, stored hashed, single-use, time-limited (verify 24h, reset 1h).
- CSRF: SameSite=Lax + OAuth state param.
- Rate limiting on login + forgot.
- Every personalization query scoped to `current_user.id` (no IDOR).
- Secrets only in env/Railway vars.

**Testing** (extends the 47-test backend suite, SQLite test DB):
- passwords: hash/verify, policy rejects <8.
- tokens: sign/verify, expiry, single-use, hash-not-raw.
- rate_limit: locks after 5, unlocks after window.
- auth routes: signup→verify→login; login-before-verify blocked; wrong-password
  generic; forgot→reset; enumeration-safe; logout.
- scoping: A can't see B's data; anonymous 401 on personalization; public open.
- Resend + Google mocked (assert calls + fallback).
- Frontend (Vitest): auth store transitions; `requireAuth` redirect; demo-vs-real
  watchlist branch.

**Out of scope (v1):** remember-me tuning, 2FA, account deletion UI,
multi-OAuth-linking UI (schema ready), email-change flow.

---

## 7. Rollout

1. Build + test on `feature/auth` in small commits.
2. Register Google OAuth app (client id/secret, redirect `…/api/auth/google/
   callback`); create Resend API key + verify sender.
3. Set Railway vars (`SECRET_KEY`, Google, Resend, `APP_BASE_URL`).
4. Migration wipes seed data on deploy.
5. Verify live: signup→email→verify→login; Google sign-in; forgot→reset; moat
   redirects; anonymous browsing intact.
