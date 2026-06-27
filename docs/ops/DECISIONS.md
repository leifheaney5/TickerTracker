# Overnight run decisions (2026-06-26)

Autonomy policy: when a task is ambiguous or needs a design/tradeoff choice,
the controller picks the most reasonable low-risk default, logs it here, and
continues. Deploy policy: auto-deploy a phase only when its full green gate
passes; otherwise leave on branch and log.

## Decisions

## P1.T6 (and component-test tasks) — test at store/logic layer, not DOM — 2026-06-26
The repo has NO @testing-library/react or jsdom; the existing 8 vitest tests are
pure store/logic tests (store.test.ts). The launch-readiness plan's component
tests (T6 alert UI; later T2.1 theme, T2.2 starter picker, T9 compare) were
written assuming render()/screen(). DECISION: do NOT add @testing-library/react +
jsdom mid-overnight-run (new dep, setup, config risk). Instead, test these tasks
at the store/logic layer (the meaningful behavior — e.g. updateWatch round-trips
alert_active; theme setter persists) and rely on `npm run build` (tsc) + the
phase deploy smoke-test to validate the JSX renders. This matches the existing
test style and keeps the run unblocked. Revisit adding RTL as a dedicated Phase-4
task if component-level DOM tests are wanted.

## P1 deploy — add alert columns via init_db (not Alembic-at-runtime) — 2026-06-27
BLOCKER found at green-gate: prod boot runs ONLY init_db() (create_all), never
`alembic upgrade`. create_all does not ALTER existing tables, so the new
alert_active / alert_last_fired_at columns (added by migration aa01) would be
ABSENT on the existing prod watchlist_items table → /api/watchlist + alert cron
would 500 in prod. The Dockerfile CMD is just gunicorn; no migration step.
DECISION: extend init_db() to additively ensure the two alert columns exist
(idempotent ADD COLUMN guarded by an information_schema/PRAGMA check, dialect-safe
for both Postgres and SQLite), matching this codebase's existing self-healing
init_db pattern. This is lower-risk for an unattended deploy than rewiring the
container start command to run alembic. The Alembic migration stays as the
source-of-truth for fresh/standard environments. Logged; implementing before
the v1.5.0 deploy.
