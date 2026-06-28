# Implementation Plan — Signal Intelligence Layer (Pulse)

Branch: `experimental/signal-intelligence` (worktree). No auto-merge to main. PRs only.
Strategy: `docs/strategy/2026-06-28-moat-signal-intelligence.md`. Baseline: backend 180 tests green.

Guardrails (standing, every task): honesty (each signal maps to real data; label heuristics as
heuristics; never imply ML/advice); `BILLING_ENABLED` untouched; tests + CI green per commit;
small modular commits; CHANGELOG + semver per workflow prefs.

## Build track (sequential TDD — shared files, must be ordered)

### F1 — Technical indicators service  [foundation]
- New `backend/services/indicators.py`: pure functions `rsi(closes,14)`, `macd(closes,12,26,9)`,
  `bollinger(closes,20,2)`, `sma(closes,n)`, `sma_cross(closes)`, `range_position(price,lo,hi)`,
  `volume_ratio(vols,20)`. Operate on close/volume arrays from existing history shape.
- Tests first: `backend/tests/test_indicators.py` against known fixtures (hand-computed RSI/MACD).
- Acceptance: deterministic, no network, handles short series gracefully (None, not crash).

### F2 — Pulse composite score + Why breakdown  [the named moat]
- New `backend/services/pulse.py`: `compute_pulse(sym)` pulls history+fundamentals+ratings+news
  (reusing existing services), runs F1, returns `{score:0-100, band, components:[{key,label,
  raw,state,weight,contribution}], asOf}`. Crypto variant uses F&G+dominance.
- Published weights as a module constant. Band thresholds named (Cooling/Neutral/Building/Hot).
- Route `GET /api/pulse/<SYM>` in `app.py` (+ rate-limit list). Tests: service (mocked providers)
  + route. Honesty: components carry their real raw value + source label.
- Frontend: types + api client `getPulse`, store action, `PulseDial` + `PulseWhy` components,
  mount on stock card. Vitest for the score→band + dial math.

### F3 — Signal history  [durable first-party moat]
- Model `SignalSnapshot(user-agnostic by symbol: symbol, date, pulse, sentiment, price)` +
  `_ensure_columns`/migration. Daily job `jobs.py snapshot-signals` snapshots distinct actively-
  watched symbols. Endpoint `GET /api/pulse/<SYM>/history`. Frontend Pulse sparkline + "shifted
  N days ago" annotation. Tests: snapshot job idempotent per day; history endpoint shape.

### F4 — Smart/divergence alerts
- Extend `services/alerts.py` with named conditions (price/sentiment divergence, overbought+
  bearish, near-target, pulse-band-change, F&G extreme). New WatchlistItem fields or a small
  `signal_alerts` table. Email states which condition fired + components. Tests for each rule.

### F5 — Watchlist Intelligence digest + "What changed"
- Upgrade `services/digest.py` to include Pulse movers, sentiment flips, upcoming earnings,
  nearest-target. New `/api/watchlist/changed` for the in-app strip. Frontend strip component.

### F6 — Cold-start "Interesting right now"
- `/api/pulse/interesting` over a default universe (top movers, F&G regime, reporting this week).
  Frontend empty-state surface. Tests for selection logic.

Priority for the night: F1 → F2 (backend+frontend) → F3 → F4 → (F5, F6 if time).

## Design/marketing track (parallel background subagents — disjoint new files only)
- M1 Brand & visual identity → `docs/brand/` + new OG/social assets in `frontend/public/`.
- M2 Honest copy & positioning → `docs/marketing/positioning-and-copy.md`.
- M3 SEO program → `docs/marketing/seo-program.md` (+ page/meta/sitemap spec).
- M4 HCI/UX spec for the signal layer → `docs/design/hci-signal-layer.md`.
Constraint: these tracks DO NOT edit existing backend/frontend source or config (no conflicts
with build track). Integration of their specs into live UI happens deliberately after build settles.
