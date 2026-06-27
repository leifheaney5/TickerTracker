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
