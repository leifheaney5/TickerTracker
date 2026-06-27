# Changelog

All notable changes to Ticker Tracker are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Removed

- **Screener page pulled from prod nav** — it filtered a hardcoded 18-ticker
  `UNIVERSE` rather than the real market, so it couldn't discover new stocks;
  the "+ Compare" control toggled state but rendered no comparison panel; and
  "diving deep" just navigated to the existing Dashboard. Same
  "promising functionality that isn't built" problem that pulled Strategy and
  the Connect-account button. Removed from the nav and view router; source kept
  at `frontend/src/views/Screener.tsx` and the feature is parked on `ROADMAP.md`
  with what a genuine market-wide screener would require.

### Changed

- **Earnings calendar diagnostics** — `get_earnings` now logs (INFO) how many of
  the requested watchlist symbols have an upcoming report in the 30-day window
  and names those that don't, so a sparse-looking calendar can be explained from
  the logs. A symbol with no scheduled report is informational, not an error —
  most "missing" tickers simply have nothing to report in the next 30 days
  (and crypto/most non-US tickers have no earnings events at all).

## [1.13.1] — 2026-06-27

### Changed

- **Removed the "⊕ Connect account" header button** (desktop and mobile menu) —
  broker/account connection is still prospective, so the entry point was pulled
  to avoid promising functionality that isn't built. The conditional "Portfolio"
  chip still renders for already-connected accounts. Idea tracked in `ROADMAP.md`.

### Added

- **`ROADMAP.md`** — a parking lot for prospective/deferred ideas so they aren't
  lost when pulled out of the shipping product.

## [1.13.0] — 2026-06-27

### Added

- **Branded, colorful HTML emails** — alerts, weekly digest, signup verification,
  and password reset now use a shared template with the Ticker Tracker logo mark,
  brand colors, a big price card (alerts) / per-ticker table (digest), and a
  footer with the © Ticker Tracker™ trademark and disclaimer. All wrapped in a
  proper UTF-8 document so characters render correctly in every mail client.
- **Price-target alerts** — you now get an email when a watchlist ticker reaches
  the **price target** you set on its card (previously only the separately-armed
  alert price triggered). Either a target or an armed alert will notify you.

## [1.12.0] — 2026-06-27

### Added

- **Site footer** with © Ticker Tracker™, a "not financial advice" note, and
  **Help** (FAQ) and **Contact** (support@tickertracker.info) modals.

## [1.11.1] — 2026-06-27

### Fixed (visual QA)

- **News panel** no longer stuck on "Loading news…": per-symbol news now falls
  back to market headlines when Finnhub returns none for a ticker, and an empty
  result shows "No recent news" instead of a perpetual spinner.
- **Header wordmark** no longer overlaps the nav on narrower desktop widths.
- **Light mode** page background now follows the theme (no dark edge).

## [1.11.0] — 2026-06-27

### Added

- **Keyboard shortcuts** — `/` to search, `g` then a letter to navigate
  (d/w/s/e/c/m), `?` for a shortcuts help overlay (Esc closes). Shortcuts are
  ignored while typing in inputs.

### Fixed

- Resolved a React rules-of-hooks ordering issue in the app root (shared-watchlist
  early return now runs after all hooks).

## [1.10.0] — 2026-06-27

### Added

- **One-click unsubscribe** in weekly digest emails (stable per-user link).
- **Per-card price sparklines** on the watchlist (1-month trend).
- **SEO / social sharing:** OpenGraph + Twitter Card meta, `robots.txt`, and
  `sitemap.xml` (share previews now show the brand icon + description).

## [1.9.0] — 2026-06-27

### Changed

- **Full light theme:** every component now reads theme-reactive CSS variables,
  so the light/dark toggle restyles the entire UI (previously only partial). Dark
  remains the default and is visually unchanged. (Known minor: the page body edge
  behind the app stays dark in light mode — tracked for a follow-up.)

## [1.8.0] — 2026-06-27

### Changed

- **Reliability & polish:** friendly empty/error states across all data views
  (Holdings, Alerts, Screener, Crypto, At-a-Glance) so panels never render blank;
  accessibility labels (aria-label) on icon-only buttons and alert/target inputs.

### Fixed

- Modernized deprecated SQLAlchemy `Query.get()` calls (0 deprecation warnings).

### Tests / Docs

- Backend test coverage raised to 136 (quotes mock-fallback, search cache,
  ratings consensus thresholds). README refreshed to document auth, alerts/
  digest, sharing, themes, earnings, and mobile.

## [1.7.0] — 2026-06-27

### Added

- **Earnings calendar** — a new Earnings view showing upcoming earnings dates
  (next 30 days) for your watchlist symbols, via Finnhub (cached 6h).
- **Saved screener filters** — name and save a Screener configuration, then
  re-apply or delete saved screens (per-account, requires sign-in).
- **Watchlist sentiment summary** — an aggregate "watchlist mood" chip
  (Bullish/Bearish/Neutral) derived from recent news sentiment across your list.

## [1.6.0] — 2026-06-27

### Added

- **Light/dark theme toggle** (persisted) via theme-aware design tokens; dark
  remains the default and is unchanged. (Light mode is currently partial — a
  full per-component var() migration is tracked as follow-up.)
- **Onboarding starter watchlists** (Big Tech / AI / Crypto Majors / Dividend)
  shown when a signed-in user's watchlist is empty — one click to seed it.
- **Shareable read-only watchlist links** — generate a `/s/<token>` URL that
  shows your list (symbols + live prices only; no targets/alerts/PII) to anyone.
- **CSV / text file import** in Manage Watchlist (reuses the bulk-add parser).

## [1.5.0] — 2026-06-27

### Added

- **Email price alerts** (arm in Manage Watchlist, delivery via Railway cron
  every 5 minutes via Resend) with HIT detection and last-fired tracking.
- **Weekly watchlist digest** (opt-in, Mondays at 13:00 UTC) summarizing active
  positions, price movements, and alert activity via Railway cron.

### Fixed

- **News links now open real articles** — external URLs are validated for
  http/https protocol, and the browser's view navigates to the article instead
  of remaining in the app (BUG-018).
- **"As of" timestamps on quotes and Fear & Greed** so users know how stale live
  data is (BUG-013, BUG-017).
- **Compare section empty-state sign-in prompt** so anonymous users are prompted
  to sign in instead of seeing a perpetual "No data" card (BUG-011).

## [1.4.2] — 2026-06-26

### Added

- **Brand "TT" app icon** — the two-T logo mark (green up-T / red down-T on the
  dark card) is now the browser favicon (SVG + 16/32 PNG), the iOS "Add to Home
  Screen" icon (180px apple-touch-icon), and the Android/PWA install icon
  (192/512 maskable) via a new web manifest. Replaces the default Vite favicon.

## [1.4.1] — 2026-06-26

### Security

- **Rate-limited the public market endpoints** (M-1): an in-process IP-keyed
  sliding window (120 req/60s) on `/api/quotes|history|fundamentals|news|ratings|
  crypto|fng|search` prevents anonymous callers from rotating symbols to burn the
  upstream provider quota. Returns 429 + Retry-After when exceeded.
- **Explicit field allowlists on settings/watchlist PATCH** (M-2): replaced
  `**body` mass-assignment with per-endpoint allowlists so only intended fields
  are client-writable.

## [1.4.0] — 2026-06-26

### Added

- **Mobile-responsive layout** (fixes QA blocker on phones). At ≤768px the header
  collapses to a compact bar with a hamburger nav + search; the Dashboard stacks
  (collapsible watchlist on top, full-width content below); wide tables scroll
  inside their card; global `overflow-x:hidden` prevents full-page horizontal
  scroll. Desktop layout is unchanged. New `useIsMobile()` hook + responsive
  padding tokens.

## [1.3.1] — 2026-06-26

### Fixed (QA report)

- **Prev Close was showing the day's Open** — the quote now carries a real
  `prev_close` (Finnhub `pc` / Yahoo previousClose) and Key Statistics uses it.
- **Key Statistics intraday rows** (Open/Prev Close/High/Low) and **Volume** now
  render real values (or "—" when a provider omits volume) instead of a stuck "…".
- **"Sign in" now opens the Login form** (was opening Sign Up). `openAuth` takes
  an explicit intent; auth CTAs pass login/signup deliberately.
- Page title is now "Ticker Tracker — …" (was the default "frontend") + meta
  description for SEO/sharing.
- Password fields have proper `autocomplete` attributes (current-password /
  new-password) for password managers; removes console warnings.

## [1.3.0] — 2026-06-26

### Added

- **Dedicated "Manage Watchlist" screen** (click ⤢ Manage in the sidebar): a
  full-screen editable list with inline target editing, remove, and a
  **comma/space/newline-separated bulk add** box to add many tickers at once.
  Requires an account (prompts sign-in for anonymous users).

### Changed

- **Decluttered watchlist cards:** removed the per-card target progress bars
  (the wall of green); targets now show as a compact one-line "Target $X · Y% to
  go" with a "✓ reached" highlight.

### Fixed

- **At-a-Glance volume** column showed market-cap mislabeled as volume; now shows
  real share volume (or — when unavailable).
- **Screener** showed stale seed market-cap/P/E; it now loads live quotes and
  real fundamentals for the visible rows.

## [1.2.1] — 2026-06-26

### Fixed

- **Anonymous watchlist now shows LIVE prices** (was stale seed values like PLTR
  $28 vs real $112). The demo watchlist, movers ribbon, and At-a-Glance now use
  the effective symbol list (demo list when logged out) and poll live quotes.
- **At-a-Glance no longer empty** for anonymous users ("0 tickers" → full table);
  movers ribbon no longer stuck on "No movers".
- **"Connect account" no longer freezes the app** — for anonymous users it opens
  the sign-in modal instead of routing to a Settings page that couldn't load.
- Settings shows a sign-in prompt for anonymous users instead of a perpetual
  "Loading…" spinner.

## [1.2.0] — 2026-06-26

### Fixed

- **Accurate, reliable quotes:** quote fetching switched to Finnhub (primary)
  with concurrent fetching and Yahoo/mock fallback. The full watchlist now loads
  in ~2.5s instead of failing on Yahoo rate-limits (429), which had caused the UI
  to silently show stale hardcoded seed prices (e.g. AAPL $214 vs real $283).
- **Search any ticker:** the header search now queries a live market-wide symbol
  search (`/api/search`, Finnhub) instead of filtering a hardcoded ~100-stock
  universe — so tickers like Kraken Robotics or RKLB are now findable.

### Security

- Added baseline HTTP security headers (CSP with `frame-ancestors 'none'`,
  X-Frame-Options, X-Content-Type-Options nosniff, Referrer-Policy, and HSTS on
  https) to mitigate clickjacking and MIME-sniffing.

## [1.1.2] — 2026-06-26

### Fixed

- **Production auth schema drift:** the pre-auth Postgres database was missing the
  `password_hash`/`email_verified` columns and auth tables (SQLAlchemy
  `create_all` never ALTERs existing tables), so auth endpoints returned 500.
  `init_db()` now detects a stale pre-auth `users` table and rebuilds the
  user/personalization tables to the current schema on boot (idempotent; safe at
  launch with no real data). Keeps schema in sync on future deploys.

## [1.1.1] — 2026-06-26

### Security

- **Prevent password-reset poisoning:** verification/reset email links and the
  OAuth redirect are now built only from the configured `APP_BASE_URL`; `_base()`
  raises if it's unset and never falls back to the request `Host` header (which an
  attacker could forge to redirect reset tokens to their own domain).
- **Close rate-limit bypass:** login lockout is now keyed on the account email
  alone, so an attacker rotating a spoofed `X-Forwarded-For` header can no longer
  multiply their attempt budget against a targeted account (the client IP is
  still recorded for forensics).

## [1.1.0] — 2026-06-26

### Added

- **Multi-user authentication**: email + password signup with email verification
  (via Resend), Google OAuth (Authlib), and password reset via single-use
  time-limited tokens.
- Passwords hashed with argon2; sessions via HTTP-only cookie (Flask-Login).
- Login rate limiting: 5 failed attempts per 15-minute window triggers a lockout.
- Per-user data scoping: watchlist (including price targets and alerts),
  holdings, and settings are now isolated per account and require login;
  every query is filtered by the authenticated user's id.
- Freemium moat: anonymous users get a read-only demo watchlist and are prompted
  to sign up when they attempt personalization actions.
- New required env vars: `SECRET_KEY`, `APP_BASE_URL`; optional (feature-gated):
  `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`.
  See `.env.example` and the Authentication section of `README.md` for setup
  instructions.

## [1.0.7] — 2026-06-26

### Fixed

- **Production startup crash (healthcheck failure):** SQLAlchemy was defaulting
  the `postgresql://` URL to the psycopg2 driver, which isn't installed (we use
  psycopg v3) — `create_engine` crashed at import, so gunicorn never bound the
  port and Railway's healthcheck failed. Normalize Railway's URL to
  `postgresql+psycopg://`.
- **Startup resilience:** `init_db()` is now wrapped so a transient DB issue at
  boot logs and continues instead of killing the web process; Postgres engine
  uses a 10s connect timeout, `pool_pre_ping`, and connection recycling.
- Verified locally: with an unreachable database the app still boots and
  `/api/health` returns 200.

## [1.0.5] — 2026-06-26

### Changed

- **Switch Railway build from Nixpacks to a multi-stage Dockerfile** for a
  robust, reproducible production build. Node 22 stage builds the frontend
  (installing from `package.json` to sidestep npm's optional-dependency bug
  npm/cli#4828 that skipped Vite 8 / rolldown's Linux native binary); Python
  3.11 stage installs deps and runs gunicorn serving the built SPA + API.
  Verified the lockfile-free frontend build locally before deploying. Removes
  `nixpacks.toml`; adds `Dockerfile` + `.dockerignore`.

## [1.0.3] — 2026-06-26

### Fixed

- Railway build: regenerate `package-lock.json` so it pins every platform's
  optional native binaries (rolldown / rollup `linux-x64-gnu`), then install via
  reproducible `npm ci --include=optional`. Fixes the
  `Cannot find module '../rolldown-binding.linux-x64-gnu.node'` build crash
  without sacrificing supply-chain reproducibility (no lockfile deletion).

## [1.0.2] — 2026-06-26

### Fixed

- Railway build: bump Nixpacks Node to 22 (vite@8 requires ^20.19 || >=22.12)
  and use `npm install` instead of `npm ci` so the Windows-generated lockfile —
  which omits Linux-only optional deps (`@rollup/rollup-linux-*`, `@emnapi/*`) —
  doesn't fail the strict clean-install on Railway's Linux builder.

## [1.0.1] — 2026-06-26

### Fixed

- Selecting a symbol now fetches its quote immediately instead of waiting for
  the next 60s poll, so Key Statistics (Open/Day High/Low, etc.) populate right
  away instead of briefly showing placeholders.
- Key Statistics shows a loading ellipsis (`…`) while quote/fundamentals are in
  flight, rather than a bare em-dash that read as "no data".
- Analyst Ratings no longer fabricates "1 analysts / Hold" before data loads — it
  shows a loading state, then the true analyst count and consensus.

## [1.0.0] — 2026-06-26

### Added

- **Single-service deploy**: Flask serves the built frontend (`frontend/dist`)
  plus the `/api/*` endpoints from one process, with an SPA catch-all so client
  navigation survives hard refresh.
- **Railway/Nixpacks config**: `nixpacks.toml` (Node + Python build → vite build
  → gunicorn), root `requirements.txt` (+ gunicorn), `Procfile`, `railway.json`
  with `/api/health` healthcheck, and `.env.example`.
- Production `README.md` documenting architecture, local dev, data sources, and
  Railway deployment. Original prototype handoff preserved in
  `docs/PROTOTYPE_HANDOFF.md`.

### Notes

- **1.0.0** marks the prototype fully operational: the high-fidelity UI recreated
  pixel-faithfully in React, backed by real market data (yfinance/yahooquery,
  CoinGecko, alternative.me, Finnhub) with deterministic mock fallback,
  Postgres-ready persistence, and one-command Railway deploy.

## [0.6.0] — 2026-06-26

### Added

- **All remaining views** ported pixel-faithfully and wired to the store/API:
  - Settings (profile, brokerage connect/disconnect, notification & privacy
    toggles) → `/api/settings`.
  - Alerts (active price alerts with HIT detection, remove).
  - Holdings (summary cards, allocation donut, positions table, balance masking)
    → `/api/holdings`.
  - At-a-Glance + Deep Dive (sortable watchlist table; fundamentals sub-toggle).
  - Crypto (real CoinGecko stats, live Fear & Greed, Crypto Map treemap, coins
    table) → `/api/crypto` + `/api/fng`.
  - Market / Map / Sectors (index cards, sector bars, full-market treemap,
    sector performance matrix + ranked bars) with sub-nav.
  - Screener (filter the universe by sector/performance/cap, + Compare).
  - Strategy (KPI banner, equity curve vs benchmark, risk panels, positions).
- Reusable `Treemap`, `Donut`, `EquityCurve`, `Toggle` components.

## [0.5.0] — 2026-06-26

### Added

- **Dashboard hero view (complete)**, pixel-identical to the prototype and wired
  to live backend data:
  - Header chrome: logo mark, view nav, LIVE wordmark, search popover,
    connect/portfolio chip, avatar.
  - Watchlist sidebar: group tabs, sort cycle, draggable cards with live
    price/%/sparkline and target-progress bars, add-ticker form.
  - Movers ribbon (gainers/losers) and stock header (track toggle, live price,
    editable price target).
  - Interactive SVG chart: candles/line/area + volume, axis labels, last-price
    tag, crosshair + OHLC tooltip, drag-to-zoom, and compare (normalized %).
  - Key Statistics grid, News card (per-symbol/market + sentiment), and
    Due-Diligence (analyst ratings, earnings & events, about).
- Reusable `Logo`, `Sparkline`, and `StockChart` chart components.

### Fixed

- Guard first-run watchlist seeding against React StrictMode double-invocation
  (no more duplicate watchlist rows).

### Security

- News links validate the URL protocol (http/https only) before use as an
  anchor href, blocking `javascript:`/`data:` XSS; external links use
  `rel="noopener noreferrer"`.

## [0.4.0] — 2026-06-26

### Added

- **Frontend foundation** (React 18 + Vite + TypeScript): design tokens transcribed
  verbatim from the prototype, typed API client mirroring the backend contract,
  default ticker universe + deterministic seeded-series fallback, and a Zustand
  store replacing the prototype's `Component` class. Dev server proxies `/api`
  to Flask; production build emits to `dist/`.

## [0.3.0] — 2026-06-26

### Added

- **Finnhub integration**: `/api/news` (per-symbol + market, with sentiment pills)
  and `/api/ratings/<sym>` (consensus, buy→sell distribution, 12-mo price-target
  range). Real data when `FINNHUB_API_KEY` is set; deterministic mock otherwise.

## [0.2.0] — 2026-06-25

### Added

- **Persistence layer**: SQLAlchemy models (users, watchlist, holdings, alert log,
  settings, custom symbols) with a singleton seed user, multi-user-ready schema.
- Watchlist / settings / holdings CRUD endpoints.
- Alembic migrations (Postgres in prod via `DATABASE_URL`, SQLite for dev/tests).

## [0.1.0] — 2026-06-25

### Added

- **Backend foundation** (Flask): provider-abstracted real-data API for quotes,
  OHLC history, fundamentals, crypto, and Fear & Greed via yfinance/yahooquery,
  CoinGecko, and alternative.me. Per-source TTL cache and per-field fallback to a
  deterministic seeded mock so the API never fails on provider outage.
- Market-status detection (ported from the original lightweight app).

### Security

- Bounded LRU cache (`MAX_ENTRIES`) and request input validation (symbol regex,
  timeframe whitelist, per-request symbol cap) to prevent unbounded-cache DoS.
