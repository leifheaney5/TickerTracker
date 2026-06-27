# Cron jobs (Railway) — LIVE

Two scheduled services run the alert + digest engine in the `tickertracker-website`
project (env `production`). **Both are created and running** as of 2026-06-27.

| Service | Schedule | Start command | Purpose |
|---|---|---|---|
| `cron-alerts` | `*/5 * * * *` (every 5 min) | `sh -c 'cd backend && python jobs.py check-alerts'` | Fire price alerts |
| `cron-digest` | `0 13 * * 1` (Mon 13:00 UTC) | `sh -c 'cd backend && python jobs.py weekly-digest'` | Weekly watchlist digest |

Both build from the same GitHub repo (`leifheaney5/TickerTracker`) as the web
service, and have these variables set: `DATABASE_URL` (the internal
`postgres.railway.internal` URL), `FINNHUB_API_KEY`, `RESEND_API_KEY`,
`MAIL_FROM`, `APP_BASE_URL`.

> **Start-command nuance:** the start command must `cd backend` first, because
> `jobs.py` imports `services.*` / `db` which resolve relative to `backend/`
> (the same reason the web service runs gunicorn with `--chdir backend`). A bare
> `python backend/jobs.py` from `/app` would fail on imports.

## Verified working
`cron-alerts` logged `INFO:jobs:alerts fired: 0` on its first scheduled run
(0 because no alerts are armed yet — no error). Check logs anytime:
```bash
railway logs --service cron-alerts     # (with RAILWAY_API_TOKEN set)
railway logs --service cron-digest
```

## To recreate (if ever needed)
A cron service = a normal service from the repo with a **Cron Schedule** + a
custom **Start Command** (Railway → service → Settings). It builds the Dockerfile
but the start command overrides the gunicorn CMD so it runs the job once per tick.

## Email deliverability caveat
`MAIL_FROM` is currently `onboarding@resend.dev` (Resend **sandbox**), which only
delivers to the account owner's verified address. Alerts/digests will only reach
**you** until a real sending domain is verified in Resend — see
[`launch-gates.md`](launch-gates.md).

## Database backups (manual — dashboard only)
Railway backups can't be set via CLI/API. Enable them once in the dashboard:
**Postgres service → Backups tab → enable Daily** (kept 6 days; optionally add
Weekly/Monthly). Recommended before real signups grow.
