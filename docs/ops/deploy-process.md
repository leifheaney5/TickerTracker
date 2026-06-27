# Deploy process

## TL;DR
1. Open a PR → **CI** runs (backend pytest, frontend build+unit, Playwright E2E).
2. Merge to `main` only when CI is green.
3. On `main`, after CI passes, the **Deploy** workflow auto-deploys to Railway.
4. Railway builds the Dockerfile and runs the web service; `init_db()` ensures
   the schema (incl. additive columns) at boot.

## The pipeline

```
PR ──▶ CI (.github/workflows/ci.yml)          required to merge
            ├─ backend:  pytest (sqlite in-memory)
            ├─ frontend: npm install → build → vitest (unit + RTL component)
            └─ e2e:      playwright (chromium) against a local preview build

main push ──▶ CI ──(success)──▶ Deploy (.github/workflows/deploy.yml)
                                    └─ railway up --service Ticker-Tracker
```

Deploy is gated on CI via `workflow_run` + `if: conclusion == 'success'`, so a
red build never ships.

## One-time setup (required for auto-deploy)
Add a Railway token as a GitHub Actions secret so the Deploy workflow can push:

1. Railway → Account Settings → **Tokens** → create a token (project- or
   account-scoped). Prefer a **project token** scoped to this project.
2. GitHub repo → Settings → Secrets and variables → Actions → **New repository
   secret**: name `RAILWAY_TOKEN`, value = the token.

(The assistant can set this for you via `gh secret set RAILWAY_TOKEN` if you
hand it the value — then rotate if it was shared in chat.)

Until that secret exists, the Deploy workflow no-ops on the token step; deploys
can still be done manually (below).

## Manual deploy (fallback / hotfix)
From a machine logged in to Railway (or with `RAILWAY_API_TOKEN` set):

```bash
railway up --detach --service Ticker-Tracker -m "describe the change"
```

Then verify:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://tickertracker.info/api/health   # expect 200
```

## Branch protection (recommended)
On GitHub → Settings → Branches → add a rule for `main`:
- Require status checks to pass before merging → select the **CI** checks
  (Backend tests, Frontend build + unit tests, E2E tests).
- Require branches to be up to date before merging.

This makes "green CI" a hard gate on `main`, which the deploy then keys off.

## Database / migrations on deploy
- Prod runs `init_db()` at boot (not `alembic upgrade`). `create_all` builds
  missing tables; `db.py::_ensure_columns()` additively adds new columns to
  EXISTING tables (alert columns, `settings.share_token`, `settings.unsub_token`).
- **Any future column added to an existing table MUST also be added to
  `_ensure_columns()`** or it won't exist in prod and the route will 500.
- Alembic migrations remain the source of truth for fresh/local databases.

## Versioning
- Bump `VERSION` and `frontend/package.json` version together per release.
- Keep `CHANGELOG.md` updated. Tag releases (`git tag -a vX.Y.Z`).
