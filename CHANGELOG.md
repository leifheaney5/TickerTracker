# Changelog

All notable changes to Ticker Tracker are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Dashboard (in progress)**: pixel-identical header chrome (logo, view nav,
  LIVE wordmark, search, connect/portfolio chip, avatar) and the watchlist
  sidebar (group tabs, sort cycle, draggable cards with live price/%/sparkline
  and target-progress bars, add-ticker form), wired to live backend data.
- Reusable `Logo` (monogram + CDN) and `Sparkline` chart components.

### Fixed

- Guard first-run watchlist seeding against React StrictMode double-invocation
  (no more duplicate watchlist rows).

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
