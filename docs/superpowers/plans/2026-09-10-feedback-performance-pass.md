# Feedback and Performance Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver explicit buy/sell targets, a unified ticker finder, clearer high-value actions and publisher identity, and a materially quieter Dashboard/Market load.

**Architecture:** Preserve the existing `target` database column as the sell-target storage and add one additive `buy_target` column. Centralize pure target/Pulse calculations and ticker discovery in focused frontend modules. Remove duplicate request owners and add in-flight/single-flight coalescing at the frontend store and backend cache boundaries.

**Tech Stack:** Flask 3.1, SQLAlchemy 2, Alembic, pytest, React 19, TypeScript 6, Zustand 5, Vitest/Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-10-feedback-performance-pass-design.md`

## Global Constraints

- Existing `target` values become sell targets without data loss.
- Both buy and sell targets may coexist.
- Keep the legacy `target` API alias for compatibility during this release.
- Do not add or upgrade dependencies.
- Do not edit secrets, deploy, commit, push, merge, or publish.
- Preserve the pre-existing untracked `AGENTS.md`.
- Write each behavioral test first and observe its expected failure before implementation.

---

### Task 1: Explicit target domain and persistence

**Files:**
- Create: `backend/migrations/versions/gg01_buy_target.py`
- Modify: `backend/models.py`
- Modify: `backend/db.py`
- Modify: `backend/services/watchlists.py`
- Modify: `backend/services/store.py`
- Modify: `backend/app.py`
- Modify: `backend/services/alerts.py`
- Test: `backend/tests/test_models.py`
- Test: `backend/tests/test_init_db_columns.py`
- Test: `backend/tests/test_store.py`
- Test: `backend/tests/test_store_routes.py`
- Test: `backend/tests/test_watchlists_api.py`
- Test: `backend/tests/test_alerts_service.py`

**Interfaces:**
- API produces `buy_target: number`, `sell_target: number`, and legacy `target: number`.
- API accepts `buy_target`, `sell_target`, and legacy `target`; explicit `sell_target` wins when both sell names are present.
- `WatchlistItem.buy_target` is a new float column; `WatchlistItem.target` remains sell storage.

- [ ] Add failing model/service/route tests proving target round-trip, compatibility aliasing, zero-to-clear, invalid-value rejection, and user scoping.
- [ ] Run the focused tests and confirm failures are caused by missing `buy_target`/`sell_target` behavior.
- [ ] Add `buy_target` to the SQLAlchemy model and `_ensure_columns()` for SQLite/Postgres.
- [ ] Add migration `gg01_buy_target` with `down_revision = ('cc01_multi_watchlist', 'ff01_signal_snapshots')`, an additive `buy_target` column, and a downgrade that drops only that column.
- [ ] Shape item dictionaries with explicit targets plus legacy sell alias; normalize accepted write fields without changing ownership checks.
- [ ] Add finite non-negative target validation at both watchlist route families.
- [ ] Add failing alert tests for buy-below and sell-above target hits and non-hits.
- [ ] Update alert eligibility/evaluation/email labels to distinguish buy and sell targets while preserving explicit-alert priority.
- [ ] Run all focused backend tests until green.

### Task 2: Target calculations, types, editing, and sorting

**Files:**
- Create: `frontend/src/lib/targets.ts`
- Create: `frontend/src/lib/targets.test.ts`
- Create: `frontend/src/components/TargetEditor.tsx`
- Create: `frontend/src/components/__tests__/TargetEditor.test.tsx`
- Modify: `frontend/src/api/types.ts`
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/state/store.ts`
- Modify: `frontend/src/components/StockHeader.tsx`
- Modify: `frontend/src/components/Watchlist.tsx`
- Modify: `frontend/src/views/ManageWatchlist.tsx`
- Modify: `frontend/src/views/AtAGlance.tsx`
- Modify: `frontend/src/components/ShareCard.tsx`
- Modify: `frontend/src/views/SharedWatchlist.tsx`

**Interfaces:**
- `targetDistancePct(price, target, side) -> number | null`.
- `targetReached(price, target, side) -> boolean`.
- `compareTargetDistance(a, b, quotes, side) -> number` with missing data last and position tie-break.
- `TargetEditor` saves `{ buy_target, sell_target }` or cancels without mutation.

- [ ] Write literal-value unit tests for buy/sell reached states, distance percentages, missing/zero inputs, missing-target ordering, reached-first ordering, and stable ties.
- [ ] Run `npm run test -- src/lib/targets.test.ts` and confirm expected failures.
- [ ] Implement the pure target helpers and make their tests green.
- [ ] Write interaction tests proving persistent Buy/Sell labels, save, clear, invalid input, and cancel.
- [ ] Implement `TargetEditor` and make its tests green.
- [ ] Replace frontend `target` usage with explicit fields while retaining compatibility normalization when old payloads omit them.
- [ ] Replace the sort cycle with a labelled select/menu and add `gainers`, `losers`, `closest-buy`, and `closest-sell` sort modes.
- [ ] Render compact buy/sell status rows in watchlist and read-only surfaces; show the editor only for tracked symbols.
- [ ] Run the focused target and affected component/store tests until green.

### Task 3: Unified ticker finder and prominent Compare

**Files:**
- Create: `frontend/src/components/TickerFinder.tsx`
- Create: `frontend/src/components/__tests__/TickerFinder.test.tsx`
- Modify: `frontend/src/state/store.ts`
- Modify: `frontend/src/components/Header.tsx`
- Modify: `frontend/src/components/Watchlist.tsx`
- Modify: `frontend/src/views/ManageWatchlist.tsx`
- Modify: `frontend/src/components/ChartControls.tsx`
- Modify: `frontend/src/hooks/useKeyboardShortcuts.ts`
- Modify: `frontend/src/hooks/useKeyboardShortcuts.test.ts`

**Interfaces:**
- `FinderIntent` discriminates browse, track, list add, and compare.
- `openTickerFinder(intent)` and `closeTickerFinder()` own one global dialog.
- Browse rows open details and expose Track/Tracking; other intents execute their scoped action.

- [ ] Write failing finder tests for debounced results, local fallback, browse-open, track, duplicate Tracking state, list add, compare toggle, Escape, and focus restoration.
- [ ] Run the finder test and confirm the missing component/intents fail.
- [ ] Implement the global finder state and accessible modal/combobox.
- [ ] Replace Header’s private search effect/popover with the shared finder.
- [ ] Change sidebar/list Add ticker and chart Compare to open the corresponding intent.
- [ ] Style Compare stocks as an always-prominent action and render active removable chips.
- [ ] Update `/` shortcut tests to expect the shared finder input.
- [ ] Run focused finder, header, keyboard, billing, and chart tests until green.

### Task 4: Honest, visible Pulse and dashboard layout

**Files:**
- Modify: `frontend/src/lib/pulse.ts`
- Modify: `frontend/src/lib/pulse.test.ts`
- Modify: `frontend/src/components/PulseDial.tsx`
- Modify: `frontend/src/components/StockHeader.tsx`
- Modify: `frontend/src/components/MoversRibbon.tsx`
- Modify: `frontend/src/components/Watchlist.tsx`
- Modify: `frontend/src/views/Dashboard.tsx`
- Create: `frontend/src/components/__tests__/MoversRibbon.test.tsx`

**Interfaces:**
- `pulseTrend(points) -> { direction, delta, days } | null`.
- “Signals rising” requires `direction === 'up'` from at least two dated real points.
- Movers remain watchlist-scoped and filter/label their universe honestly.

- [ ] Add failing literal-data tests for rising, cooling, steady, and insufficient Pulse history.
- [ ] Implement the pure trend helper and change Building’s static caption to `signals positive`.
- [ ] Add a prominent measured trend badge and increase the selected-header dial size.
- [ ] Add mover behavior tests proving gainers exclude negative rows when positive rows exist, losers exclude positive rows when negative rows exist, and unloaded quotes are not ranked as zero-valued movers.
- [ ] Convert MoversRibbon to a compact Watchlist movers panel and move it from Dashboard main content into Watchlist.
- [ ] Run focused Pulse/mover tests until green.

### Task 5: Dark-only chrome, canonical marks, and contact

**Files:**
- Create: `frontend/public/brand/google-g.svg`
- Modify: `frontend/src/components/AuthScreen.tsx`
- Modify: `frontend/src/components/Header.tsx`
- Modify: `frontend/src/components/Footer.tsx`
- Modify: `frontend/src/state/store.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/__tests__/Header.test.tsx`
- Create: `frontend/src/components/__tests__/AuthScreen.test.tsx`
- Create: `frontend/src/components/__tests__/Footer.test.tsx`
- Modify: `README.md`

**Interfaces:**
- App always calls `rootCssVars(..., 'dark')`.
- Header uses `/favicon.svg`; auth uses `/brand/google-g.svg`.
- Contact us is a visible native button at desktop and 320px mobile widths.

- [ ] Change Header tests to fail while a theme-toggle button exists and while the canonical larger logo is absent.
- [ ] Add auth test requiring the Google button to contain an image with accessible/hidden decorative treatment and the existing Continue with Google text.
- [ ] Add footer test requiring a visible Contact us button and dialog semantics after activation.
- [ ] Implement dark-only state removal, canonical header mark, official Google mark, and responsive Contact us affordance.
- [ ] Add common `:focus-visible` and reduced-motion styles without changing the established palette/type system.
- [ ] Update README’s theme statement.
- [ ] Run focused header/auth/footer/theme tests until green.

### Task 6: News diversity and publisher logos

**Files:**
- Modify: `backend/providers/finnhub.py`
- Modify: `backend/services/news.py`
- Modify: `backend/mock.py`
- Modify: `backend/tests/test_news_ratings_service.py`
- Modify: `backend/tests/test_news_routes.py`
- Create: `backend/tests/test_news_diversity.py`
- Create: `frontend/src/components/NewsSourceLogo.tsx`
- Create: `frontend/src/components/__tests__/NewsSourceLogo.test.tsx`
- Modify: `frontend/src/components/NewsCard.tsx`
- Modify: `frontend/src/components/__tests__/NewsCard.test.tsx`

**Interfaces:**
- `diversify_news(items, limit=12, per_source=2) -> list[dict]` deduplicates and round-robins real articles.
- `NewsSourceLogo({ source, url })` derives only HTTP(S) hostnames and falls back to initials.

- [ ] Write failing backend tests using hand-authored mixed-source fixtures for URL/headline dedupe, per-source cap, recency retention, and honest low-diversity output.
- [ ] Increase the provider pool and implement service-level diversity selection.
- [ ] Run focused backend news tests until green.
- [ ] Write failing publisher-logo tests for valid hostname, invalid URL, image failure, and retained visible source text.
- [ ] Implement the source-logo component and integrate it into NewsCard.
- [ ] Run focused frontend news tests until green.

### Task 7: Frontend request coalescing and correct initial route

**Files:**
- Modify: `frontend/src/routes.ts`
- Modify: `frontend/src/state/store.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/views/Dashboard.tsx`
- Modify: `frontend/src/views/MarketViews.tsx`
- Modify: `frontend/src/charts/Sparkline.tsx`
- Modify: `frontend/src/components/Watchlist.tsx`
- Modify: `frontend/src/routes.test.ts`
- Modify: `frontend/src/state/store.test.ts`
- Create: `frontend/src/state/requestCoalescing.test.ts`
- Modify: `frontend/src/views/__tests__/MarketViews.test.tsx`

**Interfaces:**
- `initialViewForLocation(pathname)` returns Dashboard for ticker/unknown paths and the mapped view for known paths.
- Each keyed loader reuses one pending Promise and removes it in `finally`.
- `fngFetchedAt` lives in store state.

- [ ] Add failing route test proving `/market` initializes Market before render.
- [ ] Add deferred-fetch tests proving duplicate pending history, fundamentals, news, Pulse, ratings, logos, quotes, and F&G loads make one request per key.
- [ ] Add Market test proving a mount calls `/api/fng` once.
- [ ] Implement synchronous initial view selection and remove Dashboard quote polling.
- [ ] Implement loader in-flight maps and store F&G metadata.
- [ ] Remove the second Market F&G request and the duplicate authenticated legacy-watchlist bootstrap call.
- [ ] Make Watchlist the only sparkline-history owner and begin its bounded/deferred loads after critical selected data.
- [ ] Run focused route/store/Market/Sparkline tests until green.

### Task 8: Backend cache and Pulse performance

**Files:**
- Modify: `backend/cache.py`
- Modify: `backend/services/pulse.py`
- Modify: `backend/services/signal_alerts.py`
- Modify: `backend/services/ratings.py`
- Modify: `backend/services/crypto.py`
- Modify: `backend/tests/test_cache.py`
- Modify: `backend/tests/test_pulse.py`
- Modify: `backend/tests/test_signal_alerts.py`
- Modify: `backend/tests/test_crypto_fng.py`

**Interfaces:**
- `cache.cached()` preserves its `(value, stale)` return contract and coalesces same-key concurrent misses.
- `compute_pulse()` returns the existing payload shape while independent reads overlap.
- Ratings TTL is 86,400 seconds; F&G uses a daily-aware cache duration.

- [ ] Write a barrier-based failing cache test proving eight concurrent misses currently invoke one producer eight times.
- [ ] Implement bounded per-key locks with a second cache check and lock cleanup that preserves LRU/stale behavior.
- [ ] Run cache tests until green.
- [ ] Add delayed-fake Pulse test proving four dependency reads overlap and each is called once.
- [ ] Parallelize Pulse dependencies with bounded concurrency and briefly cache the composed result for signal reuse.
- [ ] Raise ratings/F&G cache durations and update their literal-behavior tests.
- [ ] Run focused backend cache/Pulse/signal/F&G tests until green.

### Task 9: End-to-end regression and canonical verification

**Files:**
- Modify: `frontend/e2e/app.spec.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Mocked E2E routes record unique API URLs and remain independent of market hours/live prices.

- [ ] Add E2E coverage for search-to-track, dual target save/status/sorts, Compare stocks, publisher marks, dark-only header, and mobile Contact us.
- [ ] Add request recording that proves hard `/market` emits no Dashboard-only data requests and one F&G request.
- [ ] Run focused Playwright tests and fix product code rather than weakening assertions.
- [ ] Update CHANGELOG with user-visible behavior and performance corrections.
- [ ] Run backend `python -m pytest -q` with plugin autoload disabled if required.
- [ ] Run frontend `npm run test`, `npm run lint`, and `npm run build`.
- [ ] Run `npm run e2e` with mocked providers.
- [ ] Review `git diff --check`, the complete diff, and fresh `git status`; verify only intended files plus the pre-existing untracked `AGENTS.md` remain.

## Self-review

- **Spec coverage:** All approved target, finder, Pulse, Compare, movers, dark-only, branding, contact, news, and performance requirements map to Tasks 1–9.
- **Placeholder scan:** No deferred implementation placeholders are present. Operationally optional deployment and shared-cache work is intentionally excluded.
- **Type consistency:** `buy_target` and `sell_target` are the frontend/API names; physical `target` is only the legacy backend sell alias. `FinderIntent`, `targetDistancePct`, `targetReached`, and `pulseTrend` are defined before their consumers.

