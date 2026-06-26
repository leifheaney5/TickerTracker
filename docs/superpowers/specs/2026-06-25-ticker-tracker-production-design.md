# Ticker Tracker — Production App Design Spec

**Date:** 2026-06-25
**Status:** Approved
**Goal:** Turn the high-fidelity prototype into a production app: React + Vite + TypeScript frontend (pixel-identical to the prototype), Flask + Postgres backend with maximum real market data, deployed on Railway.

---

## 1. Context & Inputs

Two existing artifacts are being merged:

- **Prototype** — `TickerTracker/Ticker Tracker.dc.html` + `support.js`. A high-fidelity design reference: a single `Component` class running on a bundled React-based template runtime (`support.js`). 9+ views, hand-rolled SVG charts, exact dark-theme styling. **All market data is synthetic** (seeded PRNG), except crypto Fear & Greed (live from alternative.me) and logos (DuckDuckGo / cryptocurrency-icons CDN). The README states the runtime is reference-only and the design should be recreated in the target stack.

- **Master** — `s:\Bandcamp Downloasd\Ticker-Tracker-master`. A working lightweight Flask app: `yfinance`/`yahooquery` concurrent fetching, `/data` + `/api/favorites` endpoints, `favorites.json` persistence, market-status detection, 30-day history, 52-week / all-time highs. Its Bootstrap + Chart.js frontend is being replaced by the prototype.

**The integration insight:** the prototype is the front-end; the master is the back-end engine. The job is to make the prototype's UI consume real data instead of synthetic, preserving its exact look.

---

## 2. Architecture & Stack

```
ticker-tracker/
├── frontend/                 React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── components/        ported 1:1 from prototype (exact styles)
│   │   ├── charts/            hand-rolled SVG charts ported as-is
│   │   ├── views/             Dashboard, AtAGlance, DeepDive, Market, Map,
│   │   │                      Sectors, Crypto, Screener, Strategy, Holdings,
│   │   │                      Alerts, Settings
│   │   ├── hooks/             useTickerData, useWatchlist, useSettings, …
│   │   ├── state/             Zustand store (replaces the Component class)
│   │   ├── api/               typed client for the backend
│   │   └── mock/              seeded-PRNG generators (ported as fallback)
│   └── dist/                  Vite build output (served by Flask)
├── backend/                  Flask (evolves the master's app.py)
│   ├── app.py                routes + SPA serving
│   ├── providers/            yfinance, yahooquery, finnhub, coingecko, fng
│   ├── services/             quote, history, fundamentals, news, ratings, crypto
│   ├── models.py             SQLAlchemy models (Postgres)
│   ├── cache.py              per-source TTL cache
│   └── db.py                 engine/session + Alembic config
├── migrations/               Alembic
├── .env.example              FINNHUB_API_KEY, DATABASE_URL
├── requirements.txt
├── Procfile / railway.json   deploy
└── docs/superpowers/specs/   this spec
```

- **Frontend:** React 18 + Vite + TS. The prototype's `Component` class becomes a Zustand store + hooks; its inline styles, SVG charts, and copy are reused **verbatim** so it renders pixel-identical. Live ticking, persistence, keyboard shortcuts, and help modals all preserved.
- **Backend:** evolves the master's Flask app into a provider-abstracted API. Postgres via SQLAlchemy replaces `favorites.json`.
- **Deploy:** single Railway service — Flask serves the built React bundle *and* the `/api/*` endpoints. Postgres as a Railway plugin.
- **Provider strategy:** yfinance/yahooquery (quotes, candles, fundamentals, history) · **Finnhub free tier** (real news+sentiment, analyst ratings/targets — the one required API key) · CoinGecko + alternative.me (crypto + Fear & Greed, keyless). yfinance is the universal fallback; any source failure degrades to the prototype's seeded mock for that field only, never a broken page.

---

## 3. Backend API & Data Layer

The backend serves the prototype's **view-model contract** with real data. Each field maps to a source with graceful per-field fallback to seeded mock.

### Endpoints

```
GET  /                      → built React app (SPA, catch-all fallback)
GET  /api/quotes?syms=...   → live price, %chg, day OHLC, volume, market status
GET  /api/history/<sym>?tf= → OHLC candles per timeframe (1D/1W/1M/3M/1Y/5Y)
GET  /api/fundamentals/<sym>→ P/E, mkt cap, sector, industry, 52w/ATH, beta, div, EPS…
GET  /api/news?sym=|market  → Finnhub headlines: source, ts, sentiment, headline, url
GET  /api/ratings/<sym>     → Finnhub: consensus, buy→sell dist, 12mo target range
GET  /api/crypto            → CoinGecko: coin quotes, mkt cap, BTC dominance
GET  /api/fng               → crypto Fear & Greed (alternative.me)
GET  /api/watchlist         → user's watchlist (Postgres)
POST /api/watchlist         → add {sym, target?, alertPrice?, alertDir?}
PATCH /api/watchlist/<sym>  → update target/alert/position
DELETE /api/watchlist/<sym> → remove
GET/PATCH /api/settings     → profile + toggles (Postgres)
GET/POST/PATCH/DELETE /api/holdings  → portfolio positions
GET  /api/health
```

All data endpoints return `{ data, meta: { source, stale } }` so the frontend can optionally surface a "delayed / mock" hint. By default it renders identically regardless of source.

### Data-source map (per view-model field group)

| Field group | Primary | Fallback |
|---|---|---|
| Price, %chg, day OHLC, volume, market status | yfinance/yahooquery | seeded mock |
| Candles (timeframes) | yahooquery history | yfinance → mock |
| Fundamentals (P/E, cap, sector, 52w/ATH, beta, div) | yahooquery | yfinance → mock |
| News + sentiment | **Finnhub** | mock |
| Analyst ratings + targets | **Finnhub** (yahooquery partial) | mock |
| Crypto quotes / dominance | CoinGecko | yfinance BTC-USD → mock |
| Crypto Fear & Greed | alternative.me | last-known → mock |

### Caching (per-source TTL)

quotes 60s · fundamentals 1h · news 15m · ratings 6h · crypto 60s · F&G 5min.
Concurrent multi-symbol fetching via `ThreadPoolExecutor` (carried from the master).

### Resilience

Every provider call wrapped: failure → log + per-field seeded-PRNG fallback. The page never breaks; mock is always the floor. This reuses the deterministic mock the prototype already ships.

### Required API key

`FINNHUB_API_KEY` (free tier) — real news + analyst ratings. Everything else is keyless. Documented in `.env.example` and Railway env vars.

---

## 4. Frontend Port & State

Goal: **pixel-identical** to the prototype. Strategy: *restructure, don't redesign* — literal styles, SVG chart code, and copy move over unchanged; only the plumbing (`Component` class → React) changes.

### State (Zustand store) — replacing Component fields

```
view, selected, timeframe, chartType, group, compare[],
search/searchFocus, hover/zoom/brush, newsTab, moversTab,
sortBy, ovSort, secTf, marketLayers[], mktTf, cryptoCoin,
scr (screener), compareSet[], helpOpen, brokerModal/brokerPending, settings
```

Non-reactive caches (`_master`, `_scache`, `_live`, `_ncache`, …) become module-level maps — the **same deterministic seeded PRNG, kept as the mock fallback engine**, not the primary source.

### Data flow (the key change)

- Prototype: `price(sym)` reads from seeded `_live`/`U`.
- Production: a `useTickerData` hook fetches `/api/quotes`, `/api/history`, etc. into the store. View-model selectors (the `renderVals()` equivalent) read real data, falling back to the seeded value when a field is missing. **Components never know whether a number is real or mock — same contract.**

### Live ticking

The prototype's 2.6s random-walk becomes a **60s poll** of `/api/quotes` (matching backend cache) for real prices, preserving the flash-on-change animation. Optional micro-jitter between polls keeps the "live" feel, gated by the Settings "Live updates" toggle exactly as now.

### Component mapping (each a faithful port)

- `views/` — Dashboard, AtAGlance, DeepDive, Market, Map, Sectors, Crypto, Screener, Strategy, Holdings, Alerts, Settings
- `charts/` — Chart (candles/line/area + crosshair + drag-zoom + compare-normalize), Treemap, Donut, Sparkline, EquityCurve, FngGauge — **SVG ported verbatim**
- shared — Header (search, view nav, portfolio chip, help, refresh, avatar), HelpModal (`HELP` map), Toasts, BrokerModal

### Persistence

`localStorage('tt_state_v1')` → server. UI-only state (current view, sort, compare set) may stay in localStorage; data state (watchlist, targets, alerts, settings, holdings) moves to Postgres via the API. Schema is multi-user-ready so per-user scoping slots in later.

Keyboard shortcuts, help modals, brokerage connect flow (remains simulated), and toasts are all preserved as-is.

---

## 5. Database, Error Handling & Testing

### Postgres schema (SQLAlchemy) — multi-user-ready, single-user now

```
users            id, email, name, phone, created_at        (one seed row for now)
watchlist_items  id, user_id→users, symbol, position, target,
                 alert_price, alert_dir, created_at
holdings         id, user_id, symbol, shares, avg_cost
alert_log        id, user_id, symbol, price, triggered_at
settings         user_id→users (1:1), broker_connected, broker_name,
                 live_updates, alert_notifs, news_digest,
                 hide_balances, currency
custom_symbols   id, user_id, symbol, name, sector, group, exch
                 (user-added tickers not in the default universe;
                  mirrors prototype's `custom` snapshot)
```

Every user-owned table carries `user_id` from day one (defaulting to a single seed user), so adding auth later is a login + scoping change, not a per-table migration. Alembic manages migrations.

### Error handling

- **Backend:** every provider call wrapped → log + per-field seeded-mock fallback (never a 500 to the UI). Endpoints carry `meta.source` / `meta.stale`.
- **Frontend:** API errors fall back to the store's seeded mock; a subtle stale indicator on the refresh button. App stays fully usable degraded/offline because mock is always the floor.
- **Rate limits:** backend cache + concurrent batching keep us under Finnhub free-tier limits; CoinGecko/yfinance throttled with backoff.

### Testing

- **Backend (pytest):** provider adapters (mocked HTTP), fallback-to-mock paths, view-model shape matches the contract, watchlist/settings/holdings CRUD against a test Postgres.
- **Frontend (Vitest + RTL):** store logic, selectors (real-vs-mock fallback), key interactions (sort, compare, drag-reorder, alerts, target edit).
- **Visual (Playwright):** Dashboard smoke test guarding the pixel-identical goal.
- **Integration:** one happy-path test hitting real `/api/quotes` for a known symbol (skippable without network in CI).

### Build & deploy

Vite builds to `frontend/dist`; Flask serves it as static + SPA catch-all fallback. Single Railway service + Postgres plugin. Env vars: `FINNHUB_API_KEY`, `DATABASE_URL`. `Procfile` / `railway.json` updated from the master's.

---

## 6. View-Model Contract (the integration seam)

The prototype's `renderVals()` builds a per-render view-model from `this.U[sym]` (the universe), `price()/chg()/flash()` (live values), and per-view state. Production preserves these field names and feeds real data into them. Representative per-symbol fields the UI depends on:

```
U[sym]: { name, sector, industry, group, exch, price, dchg (day %),
          shares, cost, target, alertPrice, alertDir,
          cap (mkt cap str), pe, div, vol }
live:   price(sym), chg(sym), flash(sym)  ← from /api/quotes poll
series: _series(sym, tf) → OHLC bars      ← from /api/history
fund:   _fund(sym) → [[label, value], …]  ← from /api/fundamentals
news:   per-sym / market items            ← from /api/news
ratings/earnings/about                    ← from /api/ratings + fundamentals
```

The production rule: a selector returns the real value when present, else the seeded mock for that exact field. The component layer is unchanged.

---

## 7. Out of Scope (v1)

- Real brokerage aggregation (Plaid/SnapTrade) — connect flow stays simulated.
- Real multi-user auth — schema is ready, login deferred.
- Push/email notifications (master's Pushbullet hook) — alerts are in-app toasts.
- Real Strategy/algo backtests — Strategy view keeps synthetic equity curve.
