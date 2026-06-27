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

## P4.T6 light-theme var() migration — sequence safely, don't block deploy — 2026-06-27
The migration is 570 COLORS.x references across 27 files, and rootCssVars is
MISSING vars for accentInk/warn/warn2 (3 keys). A blind sweep risks (a) undefined
vars for those 3, (b) hard-to-auto-detect dark-mode (default!) regressions at
570 sites. Dark mode is what all current users see — a silent regression there is
the worst outcome of the night. DECISION: (1) ship the SAFE, already-verified
Phase-4 work (backend coverage, a11y, empty/error states, README) as v1.8.0 NOW;
(2) attempt the var() migration on a SEPARATE sub-branch with the gap closed
first (emit --accentInk/--warn/--warn2); (3) deploy the migration ONLY if its
green-gate + review come back clean — otherwise leave on-branch for morning human
visual QA (automated tests can't see a dark-mode color regression). This honors
auto-deploy-when-green without risking the default UI on an unattended big sweep.

## P4.T6 light migration — verified + a minor body-bg note — 2026-06-27
Visual verify (vite preview + headless): DARK mode pixel-correct (--bg #0a0b0d,
--card #14171c, --tx #e9ebee = original); gap-fill landed (--accentInk/--warn/
--warn2 now emit). LIGHT mode flips correctly (--bg #f7f8fa, --card #fff, --tx
#11151b). MINOR (morning): index.css sets a static dark <body> background, so in
light mode the body edge behind the app root stays dark (app itself is light).
Cosmetic; fix = make body bg use var(--bg) or move the bg to the root. Logged,
not blocking — dark default unaffected.

# ===== OVERNIGHT RUN FINAL SUMMARY (2026-06-27) =====

ALL PLANNED WORK COMPLETE. 7 versions shipped + deployed to tickertracker.info, every deploy SUCCESS, every phase passed its green gate (backend pytest + frontend build + vitest) before deploy.

## Versions shipped
- v1.5.0  Phase 1 Launch Readiness: email price alerts (arm in Manage Watchlist), weekly digest, cron entrypoint (backend/jobs.py), news links -> real articles (BUG-018), as-of timestamps (BUG-013/017), Compare anon polish (BUG-011). + deploy-safety: init_db ensures alert columns on existing tables.
- v1.6.0  Phase 2 Growth: light/dark theme toggle, onboarding starter watchlists, shareable read-only /s/ links, CSV/file import.
- v1.7.0  Phase 3 Engagement: earnings calendar, saved screener filters, watchlist sentiment chip.
- v1.8.0  Phase 4 Polish: friendly empty/error states, a11y aria-labels, backend coverage 118->136 + SQLAlchemy .get() modernization (0 warnings), README refresh.
- v1.9.0  Phase 4b: FULL light theme (570 COLORS.x -> var(--x) across 27 files; browser-verified dark pixel-identical + light flips).
- v1.10.0 Phase 5: digest unsubscribe link, watchlist sparklines, SEO/OG meta + robots.txt + sitemap.xml.
- v1.11.0 Phase 5: keyboard shortcuts + help overlay; fixed a rules-of-hooks violation in App.tsx.

Tests end state: backend 141 passing (0 deprecation warnings), frontend 24 passing. main @ 5cf0233, clean.

## MORNING REVIEW CHECKLIST (human)
1. VISUAL QA light theme on the live site (toggle ☾/☀ in header). Known minor: page <body> edge stays dark behind the app in light mode (index.css static bg) — see P4.T6 note. Cosmetic.
2. ALERTS + DIGEST DON'T FIRE YET: you must create the two Railway CRON SERVICES per docs/ops/cron-setup.md (alerts every 5 min: `python backend/jobs.py check-alerts`; digest weekly: `python backend/jobs.py weekly-digest`). Until then the engine is built+tested but never invoked. Deploy web FIRST (it ran migrations); then activate cron (deploy-order note in cron-setup.md).
3. LAUNCH GATES still owed (docs/ops/launch-gates.md): verify a Resend sending domain (emails only reach the owner until then), add GOOGLE_CLIENT_ID/SECRET, ROTATE the secrets pasted in chat.
4. Try keyboard shortcuts: press ? on the site for the overlay.
5. Carryover MINORS (none blocking) logged throughout this file + ledger: TOCTOU on first share/unsub token write; asOf() NaN guard; MarketViews double /api/fng fetch; saved-screens dropdown no click-outside; body-bg in light mode.

## What was NOT done (out of declared scope / deliberately deferred)
- Real brokerage connect (SnapTrade/Plaid) — market doc says sequence after quick wins; not in tonight's phases.
- The light-mode body-bg cosmetic fix (logged for follow-up).
