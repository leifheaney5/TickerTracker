# Ticker Tracker

A sleek, dark-themed stock & crypto tracking app: a pixel-faithful React
front-end backed by a real-data Flask API, deployable to Railway with Postgres.

The hero experience is a split-view **Dashboard** (curated watchlist + a large
interactive chart, stats, news, and due-diligence), surrounded by market-wide
tooling: At-a-Glance & Deep Dive tables, a Market overview / treemap Map /
Sectors matrix, a Crypto world, a Screener, a Strategy cockpit, Portfolio
holdings, price Alerts, and Settings.

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

| Data | Source | Key required |
|---|---|---|
| Quotes, OHLC history, fundamentals, 52w/ATH | yfinance / yahooquery | no |
| Crypto quotes, market cap, BTC dominance | CoinGecko | no |
| Crypto Fear & Greed | alternative.me | no |
| News + sentiment, analyst ratings & price targets | **Finnhub** (free tier) | **yes** |

Every provider call falls back to a deterministic seeded mock on failure, so the
app is always usable — it never shows a broken page.

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

## Tests

```bash
cd backend && . .venv/Scripts/activate && pytest -q     # 47 tests
```

## Deploy (Railway)

1. Create a Railway project from this repo. Nixpacks (`nixpacks.toml`) installs
   Node + Python, runs `npm ci && npm run build`, installs Python deps, and
   starts gunicorn (`Procfile`).
2. Add the **Postgres** plugin — `DATABASE_URL` is injected automatically; tables
   are created on first boot.
3. Set `FINNHUB_API_KEY` as a service variable for real news + ratings.
4. Healthcheck is `/api/health` (configured in `railway.json`).

## Project docs

- [`docs/superpowers/specs/`](docs/superpowers/specs/) — the design spec.
- [`docs/superpowers/plans/`](docs/superpowers/plans/) — implementation plans.
- [`docs/PROTOTYPE_HANDOFF.md`](docs/PROTOTYPE_HANDOFF.md) — the original
  high-fidelity prototype handoff (the UI this app recreates).
- [`CHANGELOG.md`](CHANGELOG.md) — version history.

## Credits

Original concept & prototype design by Leif Heaney
([leifheaney.com](https://leifheaney.com/)).
