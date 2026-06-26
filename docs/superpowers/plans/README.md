# Ticker Tracker — Production App: Plan Index

Spec: `docs/superpowers/specs/2026-06-25-ticker-tracker-production-design.md`

The build is decomposed into sequential plans. Each plan ends with a runnable,
testable milestone.

| # | Plan | Milestone |
|---|------|-----------|
| 1 | [Backend foundation & real-data API](2026-06-25-plan-1-backend-api.md) | Flask app with `/api/quotes`, `/api/history`, `/api/fundamentals`, `/api/crypto`, `/api/fng`, per-source cache + mock fallback. `curl`-testable real data. |
| 2 | [Postgres persistence & watchlist/settings API](2026-06-25-plan-2-persistence.md) | SQLAlchemy models, Alembic migrations, `/api/watchlist`, `/api/settings`, `/api/holdings` CRUD against Postgres. |
| 3 | [Finnhub: real news, sentiment & analyst ratings](2026-06-25-plan-3-finnhub.md) | `/api/news`, `/api/ratings` backed by Finnhub free tier with mock fallback. |
| 4 | [Frontend scaffold, store & API client](2026-06-25-plan-4-frontend-scaffold.md) | React+Vite+TS app boots, Zustand store + seeded-mock engine ported, typed API client, Header shell renders pixel-faithfully. |
| 5 | [View & chart ports](2026-06-25-plan-5-views-charts.md) | All views + SVG charts ported verbatim, wired to store, pixel-identical to prototype. |
| 6 | [Wire frontend to live API + persistence](2026-06-25-plan-6-integration.md) | Polling, real data into the view-model contract, server persistence, stale indicators. |
| 7 | [Build, Railway deploy & hardening](2026-06-25-plan-7-deploy.md) | Flask serves Vite build, single Railway service + Postgres, env vars, health checks. |

**Execution:** plans run in order. Each is executed via
superpowers:subagent-driven-development or executing-plans, task-by-task.
