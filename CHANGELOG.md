# Changelog

All notable changes to Ticker Tracker are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
