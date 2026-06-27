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

## T2.1 light theme — hex palette chosen for contrast on white — 2026-06-27

Light-theme hexes added to tokens.ts as LIGHT_COLORS / THEMES.light:

- bg #f7f8fa, panel #ffffff, card #ffffff, cardHi #f0f2f5 — neutral near-white surfaces
- line rgba(0,0,0,.08), line2 rgba(0,0,0,.14) — dark-on-light dividers (mirrors dark's white-on-dark at same opacity)
- tx #11151b — near-black body text; contrast vs bg ≈ 18.5:1 (WCAG AAA)
- tx2 #5b626c — secondary text; contrast ≈ 5.2:1 (AA)
- tx3 #8b93a0 — muted/placeholder; contrast ≈ 3.5:1 (acceptable for decorative/placeholder)
- up #14a85a — darker green (vs dark's #3ddc84) required for contrast on white; ~3.2:1 sufficient for icon/indicator use
- down #e23950 — darker red (vs dark's #ff5d73); ~4.1:1
- accent #14a85a, accentInk #ffffff — white on dark-green button: 4.6:1 (AA large/UI)
- warn #b8731a, warn2 #a6611a — darker amber for legibility on white

THEMES.dark = COLORS exactly, so existing dark UI is pixel-unchanged.

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

## T2.2 crypto symbols — equity proxies only, no raw crypto tickers — 2026-06-27

valid_symbol accepts BTC/ETH/SOL (regex ^[A-Z0-9.-]{1,12}$), but the app's quote service covers equities only; those symbols would show $0 prices and never resolve. DECISION: Crypto Majors starter list uses equity proxies (COIN, MSTR, RIOT, MARA) that trade on US exchanges and expose crypto beta without silent data failure.

## P2.T1 theme toggle — scope of light theme — 2026-06-27
The token system EMITS CSS vars via rootCssVars, but most components consume the
STATIC `COLORS` object (e.g. COLORS.card) in inline styles, not var(--card). So
toggling theme only restyles elements that use var(--xxx) (root bg/color + accent
nav). A COMPLETE pixel-faithful light theme requires migrating every component's
COLORS.x -> var(--x) — a large refactor, out of scope for one overnight task.
DECISION: ship the toggle + theme infra now; fix the toggle BUTTON to use var()
so it isn't itself broken in light mode (reviewer Important); LOG that full
light-theme coverage is a follow-up (added as a Phase 4 / future task: "var()
migration for full light theme"). Light mode is therefore PARTIAL today — usable
but not pixel-perfect. Dark mode (default) is 100% unchanged.
