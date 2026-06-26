# TickerTracker Security Review

**Target:** https://tickertracker.info (React SPA + Flask API + Postgres on Railway)
**Source:** `C:\Users\lphea\_DEVELOPMENT_\TickerTracker` (backend `backend/`, frontend `frontend/src/`)
**Scope:** Authorized black-box + white-box review. No destructive/at-scale testing performed (a handful of probe requests only).
**Date:** 2026-06-26

---

## Summary — counts by severity

| Severity | Count |
|----------|-------|
| Critical | 0 |
| High     | 1 |
| Medium   | 3 |
| Low      | 4 |
| Informational / verified-fixed | 8 |

**Risk verdict:** No Critical issues. **One High** (complete absence of HTTP security response headers — clickjacking + MIME-sniffing exposure) should be fixed before a public launch; it is a quick, low-risk config change. Everything else is Medium/Low and not launch-blocking. The previously-flagged auth issues (enumeration, token security, SECRET_KEY fallback, reset poisoning, lockout keying, OAuth email_verified) are all confirmed FIXED in current code.

---

## Findings

### H-1 — No HTTP security headers (clickjacking / MIME-sniff / no HSTS / no CSP) — HIGH
**Location:** entire app; no `after_request`/Talisman/CSP anywhere (grep for `after_request|Talisman|X-Frame|Content-Security` = no matches). Confirmed live:
```
$ curl -sI https://tickertracker.info/        # and /api/health
# No X-Frame-Options, no Content-Security-Policy, no X-Content-Type-Options,
# no Strict-Transport-Security, no Referrer-Policy
```
**Why exploitable:**
- No `X-Frame-Options`/CSP `frame-ancestors` → the app can be framed → **clickjacking** of the authenticated dashboard.
- No `X-Content-Type-Options: nosniff` → MIME-sniffing of user/news-sourced content.
- No `Strict-Transport-Security` → first-visit SSL-strip / downgrade window.
- No CSP → no defense-in-depth against any future XSS sink.

**Fix:** Add a global `after_request` (or `flask-talisman`) in `backend/app.py`:
```python
@app.after_request
def _security_headers(resp):
    resp.headers["X-Frame-Options"] = "DENY"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if os.environ.get("APP_BASE_URL", "").startswith("https"):
        resp.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    resp.headers["Content-Security-Policy"] = (
        "default-src 'self'; img-src 'self' data: https:; "
        "frame-ancestors 'none'; object-src 'none'; base-uri 'self'"
    )
    return resp
```
(Test the CSP against the SPA's inline-style usage; `style-src 'unsafe-inline'` may be required given the heavy inline `style=` objects in the React components.)

---

### M-1 — Unauthenticated market endpoints proxy upstream providers, only cache-protected — MEDIUM
**Location:** `backend/app.py` — `/api/quotes` (L56), `/api/history/<sym>` (L64), `/api/news` (L99), `/api/fundamentals`, `/api/ratings`, `/api/crypto`, `/api/fng`. No auth, no rate limit.
**Why exploitable:** Cache (`services/news.py` uses `cache.cached(..., 900, ...)`; quotes similarly) blunts repeats, but `/api/quotes?syms=` accepts up to 60 distinct symbols per request and any attacker can rotate symbols to force fresh upstream fetches (Yahoo/Finnhub), burning your provider quota / risking provider IP ban. This is an availability/cost abuse vector, not data exposure. Input validation IS present (regex + whitelist + `_MAX_SYMS` cap), which limits cache-poisoning — good.
**Fix:** Add a lightweight IP-keyed rate limit (e.g. `flask-limiter`) on the `/api/*` market routes, and/or a short global cap on distinct cache-miss symbols per window.

### M-2 — Settings/watchlist mass-assignment via `**b` — MEDIUM (low impact, self-scoped)
**Location:** `backend/app.py` `settings_patch` (L174) → `services/store.update_settings(**fields)` (L83), and `watchlist_patch` (L149) → `update_watch(sym, **b)`.
**Why exploitable:** The whole JSON body is splatted into the updater. It IS constrained by `hasattr(st, k)` so only real columns are writable, and it is scoped to `current_user_id()` — a user can only modify their OWN row. So worst case a user sets their own `broker_connected=True` / `broker_name` to arbitrary strings (cosmetic). Not cross-user. Risk is that future sensitive columns added to these models would become silently client-writable.
**Fix:** Replace `**b`/`hasattr` with an explicit allowlist of patchable fields per endpoint.

### M-3 — Login still works through a verification-status oracle / unverified-account timing — MEDIUM (minor enumeration residue)
**Location:** `backend/auth/routes.py` `login` (L65-89).
**Why exploitable:** Login is well-built (dummy-hash constant-time path, generic `invalid email or password`, email-keyed lockout). BUT: after a *correct* password it returns a distinct `403 "please verify your email first"` (L86-87). For an attacker who already knows/guesses the right password this distinguishes "valid+verified" vs "valid+unverified" vs "invalid" — a narrow enumeration/credential-validity oracle. Low practical impact (requires correct password) but worth noting.
**Fix:** Acceptable to keep for UX; if hardening, return the same generic error and surface the "verify your email" hint only after an out-of-band check, or gate it behind a verified resend flow.

### L-1 — `consume_token` re-SELECTs by `token_hash, kind` without the `used_at` filter — LOW
**Location:** `backend/auth/tokens.py` `consume_token` L49. The atomic claim (UPDATE WHERE unused & not expired, L40-45) is correct and race-safe. The follow-up `filter_by(token_hash=h, kind=kind).first()` to recover `user_id` is fine in practice (sha256 collision negligible, tokens invalidated per-user on create), but reads a row it just mutated by hash equality only. Cosmetic; consider returning `user_id` from the same query or filtering on `used_at == now`.

### L-2 — `valid_password` enforces only length >= 8 — LOW
**Location:** `backend/auth/passwords.py` L22. No check against common/breached passwords. Argon2 hashing is correct. Consider a minimal denylist or a higher minimum for launch.

### L-3 — `EmailToken` rows never pruned; `LoginAttempt` rows never pruned — LOW
**Location:** `backend/models.py` / `tokens.py` / `rate_limit.py`. Used/expired tokens and login-attempt rows accumulate unbounded (storage growth, minor). Add a periodic cleanup or TTL job.

### L-4 — `init_db()` can DROP auth/personalization tables on schema drift — LOW (operational)
**Location:** `backend/db.py` `init_db` L59-78. If `_auth_schema_is_stale()` ever returns true in production it `DROP TABLE ... CASCADE` on users/watchlist/holdings/etc. Guarded and documented as launch-only-safe, but this is a foot-gun once real user data exists — a single stale-detection misfire = data loss. Recommend replacing with Alembic migrations (already present in `migrations/`) and removing the drop path before/at GA.

---

## Verified FIXED / not vulnerable (white-box + live confirmed)

1. **Account enumeration — signup/login/forgot all generic.** Live: signup → `400 invalid email or password (min 8 chars)`; login (unknown user) → `401 invalid email or password`; forgot → `200 If that email exists...`. Source confirms signup hides existing accounts (routes.py L43-44), forgot is generic (L115).
2. **Constant-time login.** `_DUMMY_HASH` argon2 verify runs for missing users (routes.py L79-82). Good.
3. **Reset token security.** Tokens are `secrets.token_urlsafe(32)`, **stored sha256-hashed** (tokens.py `_hash`), single-use via **atomic UPDATE...WHERE unused & not expired** (L40-45), 1h TTL for reset / 24h verify, prior tokens invalidated on new issue (`invalidate_tokens`). Solid.
4. **Password-reset poisoning — uses `APP_BASE_URL`, not Host header.** `_base()` reads `APP_BASE_URL` and raises if unset (routes.py L22-26); reset/verify links built from it (L47, L114). Not Host-header-derived. Fixed.
5. **SECRET_KEY — no insecure fallback in prod.** `init_login` raises if `SECRET_KEY` unset while `APP_BASE_URL` is https (auth/__init__.py L9-18). Dev-only default otherwise. Fixed.
6. **Session cookie flags.** `SESSION_COOKIE_HTTPONLY=True`, `SAMESITE=Lax`, `SECURE` tied to https base URL, `REMEMBER_COOKIE_HTTPONLY=True` (auth/__init__.py L21-26). Good.
7. **OAuth.** `email_verified` claim is checked before login (`google_callback` L156); authlib provides state/CSRF + nonce via session; google not enabled unless client id/secret set; identity keyed on `(provider, subject)` unique constraint. Good. (Note: account linking by email in `upsert_google_user` auto-links an existing email account to Google and sets `email_verified=True` — acceptable since Google asserts the verified email, but be aware it links to any pre-existing local account with that email.)
8. **Authorization / IDOR — clean.** All personalization routes call `_require_user()` → 401 if anon (live: `GET /api/watchlist` no cookie = **401**). Every `services/store.py` query is filtered by `current_user_id()`; route `<sym>` params are scoped to the user's own rows (no raw numeric IDs exposed, no cross-user reachability).
9. **Injection.** All DB access is SQLAlchemy ORM with bound parameters — no raw string SQL with user data anywhere. Symbols validated by `^[A-Z0-9.\-]{1,12}$`, timeframes by whitelist, count capped at 60 (app.py L32-34). Live: bad tf → 400; injection-y `syms` filtered out.
10. **Frontend news XSS guard present.** `NewsCard.tsx` `safeHref()` (L18-25) parses the URL and allows only `http:`/`https:` — blocks `javascript:`/`data:`; anchors use `rel="noopener noreferrer"`. React auto-escapes headline/source text. Good.
11. **No verbose errors / debug off.** `app.run(debug=False)`; malformed JSON → clean Flask `400` HTML, no stack trace (live-confirmed). `/api/health` returns only `{status: ok}`.
12. **Login lockout keyed on email, IP-rotation-proof.** `rate_limit.is_locked` counts failures by **email only**, ignoring IP/XFF (rate_limit.py L16-29). 5 failures / 15 min. Fixed as intended.

---

## Recommended pre-launch action list
1. **(High)** Add security headers / CSP (H-1) — fast win.
2. **(Medium)** Rate-limit the unauthenticated `/api/*` market endpoints (M-1).
3. **(Medium)** Explicit field allowlists on settings/watchlist PATCH (M-2).
4. **(Low/ops)** Remove the `init_db` drop-on-drift path in favor of Alembic before real users exist (L-4).
