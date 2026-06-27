# Cron jobs (Railway)

Two scheduled jobs run the alert + digest engine. They share the web service's
Docker image and DATABASE_URL/FINNHUB_API_KEY/RESEND_API_KEY/MAIL_FROM env.

## Create in Railway (per job)
1. New service → "Empty service" in the SAME project (so it inherits the shared
   Postgres + variables via reference variables).
2. Set the service's **Start Command**:
   - Alerts (every 5 min):   `python backend/jobs.py check-alerts`
   - Weekly digest (Mon 13:00 UTC): `python backend/jobs.py weekly-digest`
3. Set the service's **Cron Schedule** (Railway → service → Settings → Cron):
   - Alerts:   `*/5 * * * *`
   - Digest:   `0 13 * * 1`
4. Ensure the service references the same variables as the web service
   (DATABASE_URL, FINNHUB_API_KEY, RESEND_API_KEY, MAIL_FROM).

## Verify
- Trigger once manually (Railway → service → Deploy / Run) and check logs for
  `alerts fired: N` / `digests sent: N`.
- Locally: `cd backend && python jobs.py check-alerts` (uses local DATABASE_URL).
- IMPORTANT: Deploy/activate the web service FIRST so its boot runs migrations; only then activate the cron services, otherwise the alert columns may not yet exist on the shared database.
