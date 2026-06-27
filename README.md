# Ticker Tracker

A sleek, dark-themed stock & crypto tracking app: a pixel-faithful React
front-end backed by a real-data Flask API, deployable to Railway with Postgres.

**Live at: https://tickertracker.info**

The hero experience is a split-view **Dashboard** (curated watchlist + a large
interactive chart, stats, news, and due-diligence), surrounded by market-wide
tooling: At-a-Glance & Deep Dive tables, a Market overview / treemap Map /
Sectors matrix, a Crypto world, a Screener, a Strategy cockpit, Portfolio
holdings, price Alerts, and Settings.

## Features

- **Multi-user accounts:** Email + password signup with email verification, Google OAuth, and password reset (freemium: browse free; account required to save watchlist, targets, alerts, and portfolio).
- **Price Alerts & Digest:** Automated email alerts when stocks hit your targets, plus a weekly watchlist digest delivered via Resend (powered by Railway cron service).
- **Manage Watchlist:** Bulk add (comma/space/newline-delimited, CSV/txt import), per-row price-alert arming, and easy removal.
- **Shareable Watchlists:** Generate read-only watchlist links (`/s/<token>`) to share your curated lists.
- **Light/Dark Theme:** Toggle between themes (dark is the default).
- **Onboarding Starter Watchlists:** Quick-start templates (Big Tech, AI, Crypto Majors, Dividend).
- **Earnings Calendar, Screeners, & News Sentiment:** Saved filter results, per-watchlist "mood" chips showing sentiment.
- **Mobile-Responsive:** Layout adapts to all screen sizes; web manifest and favicons for iOS/Android home-screen install.
- **Keyboard shortcuts:** `/` to search, `g` + a letter to navigate, `?` for a help overlay.
- **Security & Rate Limiting:** HTTP security headers, IP-based rate limiting on the public market API, argon2 password hashing, per-user data scoping.

## Architecture

```
frontend/   React 18 + Vite + TypeScript. Zustand store, typed API client,
            hand-rolled SVG charts (candles/treemap/donut/sparkline/equity),
            design tokens transcribed from the original prototype.
backend/    Flask. Provider-abstracted real-data API (yfinance/yahooquery,
            CoinGecko, alternative.me, Finnhub) with per-source TTL cache and
            per-field fallback to a deterministic seeded mock. SQLAlchemy +
            Alembic over Postgres (SQLite locally). Serves the built frontend.
docs/       Design spec, implementation plans, and the original prototype handoff.
```

A single Flask service hosts both the SPA (`frontend/dist`) and the `/api/*`
endpoints, so production is one process.

### Data sources

| Data | Source | Fallback | Key required |
|---|---|---|---|
| Quotes, OHLC history | **Finnhub** (primary, fast/accurate) | yfinance / Yahoo / seeded mock | optional |
| Fundamentals (P/E, div yield, etc.) | Yahoo | seeded mock | no |
| News + sentiment, analyst ratings & targets | Finnhub | — | no (free tier works) |
| Crypto quotes, market cap, BTC dominance | CoinGecko | seeded mock | no |
| Crypto Fear & Greed | alternative.me | seeded mock | no |

Every provider call falls back to a deterministic seeded mock on failure, so the
app is always usable — it never shows a broken page. Set `FINNHUB_API_KEY` for
optimal speed and coverage; the app works fully keyless.

## Local development

**Backend** (Python 3.11):

```bash
cd backend
python -m venv .venv
. .venv/Scripts/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py                # serves http://localhost:5000
```

**Frontend** (Node 20+), in a second terminal:

```bash
cd frontend
npm install
npm run dev                  # http://localhost:5173, proxies /api to :5000
```

Open http://localhost:5173 for hot-reload dev, or build and let Flask serve it:

```bash
cd frontend && npm run build   # emits frontend/dist
# then http://localhost:5000 serves the built app + API
```

### Environment

Copy `.env.example` to `.env`. The only key needed for full real data is
`FINNHUB_API_KEY` (news + analyst ratings); everything else works keyless.
`DATABASE_URL` selects Postgres (production) or defaults to SQLite locally.

For auth, set the variables in the [Auth env vars](#authentication) section below.

## Authentication

Ticker Tracker uses a freemium auth model: **anonymous users can browse the
demo watchlist freely**; an account is required for personalization (saved
watchlist, holdings, settings, price alerts).

### Auth features

- **Email + password** signup with email verification via [Resend](https://resend.com).
- **Google OAuth** (openid / email / profile scopes) via Authlib.
- **Password reset** via a single-use, time-limited token emailed with Resend.
- Passwords hashed with argon2. Sessions via HTTP-only cookies (Flask-Login).
- Login rate limiting: 5 failed attempts triggers a 15-minute lockout.
- Per-user data scoping — watchlist (including price targets and alerts),
  holdings, and settings are isolated per account. IDOR-safe: every DB query
  is filtered by the authenticated user's id.

### Auth env vars

| Variable | Required | Description |
| --- | --- | --- |
| `SECRET_KEY` | yes | Signs sessions and tokens. Generate with `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `GOOGLE_CLIENT_ID` | for Google login | OAuth client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | for Google login | OAuth client secret from Google Cloud Console |
| `RESEND_API_KEY` | for email | API key from resend.com |
| `MAIL_FROM` | for email | Verified sender address, e.g. `noreply@yourdomain.com` |
| `APP_BASE_URL` | yes | Public base URL, e.g. `https://tickertracker.info` — used for OAuth redirect URIs, email links, and the Secure cookie flag |

### Setting up auth

#### (a) Generate `SECRET_KEY`

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

#### (b) Register a Google OAuth app

Full click-by-click steps are in
[`docs/ops/google-oauth-setup.md`](docs/ops/google-oauth-setup.md). In short:
create a Web OAuth client in Google Cloud Console, set the redirect URI to
`<APP_BASE_URL>/api/auth/google/callback`, and put the client ID/secret into
`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

#### (c) Set up Resend

1. Create an account at [resend.com](https://resend.com) and get an API key.
2. Verify your sender domain and set `MAIL_FROM` to an address on that domain.

#### (d) Set Railway variables

In the Railway dashboard, add all six auth variables as service variables.
`DATABASE_URL` is injected automatically by the Postgres plugin; run the
Alembic migration (`alembic upgrade head`) to create the `users` table and
auth columns on first deploy.

## Billing (Stripe Pro subscriptions)

Ticker Tracker is freemium. Public market browsing stays free; paid value is
saved-personalization scale plus automation. Statuses `active`/`trialing` = Pro.

| Feature | Free | Pro |
| --- | --- | --- |
| Watchlist tickers | 15 | 250 |
| Active price alerts | 3 | 100 |
| Saved screeners | 1 | 25 |
| Compare stocks at once | 2 | 10 |
| Price-hit alert emails | — | ✓ |
| Weekly market digest | — | ✓ |

Pricing: **$7/mo** or **$59/yr** (annual is the primary upgrade CTA).

Env vars: `BILLING_ENABLED`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`. Full setup (product,
prices, Customer Portal, webhook, local testing) is in
[`docs/ops/stripe-billing-setup.md`](docs/ops/stripe-billing-setup.md).

> **Launch gate:** keep `BILLING_ENABLED=false` in production until market-data
> provider commercial-use rights are confirmed. While false, plan limits are not
> enforced and the app behaves exactly as it does today.

## Tests & CI

```bash
cd backend && python -m pytest -q          # backend: 144 tests (pytest, in-memory sqlite)
cd frontend && npm run test                # frontend: unit + React Testing Library component tests
cd frontend && npm run e2e                 # end-to-end: Playwright (chromium)
```

Every push and PR runs **GitHub Actions CI** (`.github/workflows/ci.yml`):
backend pytest, frontend build + vitest, and Playwright E2E. See
[`docs/ops/deploy-process.md`](docs/ops/deploy-process.md) for the full
CI-gated deploy pipeline.

## Deploy (Railway)

Production builds from the **Dockerfile** (multi-stage: Node builds the SPA,
Python runs gunicorn). Deploys are gated on green CI — see
[`docs/ops/deploy-process.md`](docs/ops/deploy-process.md).

1. Railway project + **Postgres** plugin — `DATABASE_URL` is injected automatically.
2. At boot, `init_db()` creates missing tables and `_ensure_columns()` additively
   adds new columns to existing tables (no manual migration step in prod; Alembic
   migrations are the source of truth for fresh/local DBs).
3. Set service variables: `FINNHUB_API_KEY`, `SECRET_KEY`, `APP_BASE_URL`, and the
   auth/email vars below.
4. Healthcheck is `/api/health` (configured in `railway.json`).
5. Two **cron services** run the alert + digest engine — see
   [`docs/ops/cron-setup.md`](docs/ops/cron-setup.md).

## Project docs

- [`docs/superpowers/specs/`](docs/superpowers/specs/) — the design spec.
- [`docs/superpowers/plans/`](docs/superpowers/plans/) — implementation plans.
- [`docs/PROTOTYPE_HANDOFF.md`](docs/PROTOTYPE_HANDOFF.md) — the original
  high-fidelity prototype handoff (the UI this app recreates).
- [`docs/ops/`](docs/ops/) — operations guides: [deploy process](docs/ops/deploy-process.md), [cron setup](docs/ops/cron-setup.md), [Google OAuth setup](docs/ops/google-oauth-setup.md), [launch gates](docs/ops/launch-gates.md), and [decisions log](docs/ops/DECISIONS.md).
- [`docs/reports/`](docs/reports/) — QA and security review reports.
- [`CHANGELOG.md`](CHANGELOG.md) — version history.

## Credits

Original concept & prototype design by Leif Heaney
([leifheaney.com](https://leifheaney.com/)).
