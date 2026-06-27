# Overnight Autonomous Development Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. The controller runs continuously through the night, dispatching a fresh implementer subagent per task + a task reviewer after each, with no human in the loop. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Run unattended overnight, shipping as much of the Ticker Tracker roadmap as time allows — launch-readiness first, then growth quick-wins, then engagement, then polish — making sensible default decisions and auto-deploying each phase only when fully green.

**Architecture:** Phases run in priority order. Each phase is a sequence of TDD tasks. Phase 1 (Launch Readiness) is fully specified in the sibling plan `2026-06-26-launch-readiness.md` — execute that file's 11 tasks first, then continue with Phases 2–4 specified below. Backend = Flask + SQLAlchemy 2 + psycopg v3; frontend = React 18 + Vite + TS + Zustand with inline styles + CSS-custom-property tokens.

**Tech Stack:** Python/pytest, TypeScript/vitest, Resend, Railway (cron + web), Railway GraphQL/CLI for deploys.

## Global Constraints

- **Autonomy policy = DECIDE & DOCUMENT.** When a task is ambiguous or needs a design/tradeoff choice, pick the most reasonable, lowest-risk default, append a dated entry to `docs/ops/DECISIONS.md` (`## <phase/task> — <decision> — <why>`), and continue. NEVER stall waiting for the human.
- **Deploy policy = AUTO-DEPLOY WHEN GREEN, per phase.** After a phase's last task, run the FULL backend suite + frontend build + frontend tests. Only if ALL pass, deploy the web service to Railway (`railway up --detach --service Ticker-Tracker`), poll to SUCCESS, then curl `https://tickertracker.info/api/health` and one changed endpoint. If the deploy or health check fails: do NOT attempt further deploys; keep coding subsequent phases on the branch and write the failure to `docs/ops/DECISIONS.md`. The morning review handles undeployed phases.
- **Branch discipline:** create one branch per phase: `night/phase-N-<name>`. Commit per task (small/modular). Merge the phase branch to `main` only after the phase's green gate passes. Roll `VERSION` + `frontend/package.json` once per phase.
- No `Co-Authored-By:` trailers. Keep `CHANGELOG.md` current (one entry per phase, semver bump).
- Backend envelope is `{data, meta:{source, stale}}` via `envelope(...)`. Frontend uses inline styles + tokens from `frontend/src/theme/tokens.ts` (COLORS, FONT_SANS, FONT_MONO, `rootCssVars`). NO CSS framework.
- DB access via `with db.get_session() as s:`. Email via `providers.email._send(to, subject, html)`. Quotes via `services.quotes.get_quotes(syms)`.
- Schema changes go through an Alembic migration in `backend/migrations/versions/`.
- Every task is TDD: failing test → minimal impl → green → commit. New backend tests in `backend/tests/`, new frontend tests beside the component (`*.test.tsx`).
- **Never deploy a red build.** If a phase can't go green after a fix subagent, leave it on its branch un-merged, log it, and move to the next phase.
- Test baselines: backend `cd backend && ./.venv/Scripts/python.exe -m pytest -q`; frontend `cd frontend && npm run build && npm run test`.

---

## Controller Runbook (the overnight loop)

- [ ] **Bootstrap:** create `docs/ops/DECISIONS.md` with a header `# Overnight run decisions (2026-06-26)`. Create the progress ledger per subagent-driven-development. Confirm the working tree is clean and on `main`.
- [ ] **Per phase:** create `night/phase-N-<name>` branch → run its tasks via implementer+reviewer subagents → run the green gate → if green: merge to main, roll version, deploy (auto-deploy policy), verify live → if red: log + leave branch.
- [ ] **Between tasks:** never pause for human confirmation (continuous execution). Decisions go to DECISIONS.md.
- [ ] **Run order:** Phase 1 (launch-readiness.md) → Phase 2 → Phase 3 → Phase 4 → Phase 5 (only if time remains). Stop when out of tasks; write a final summary to `docs/ops/DECISIONS.md`.

---

## PHASE 1 — Launch Readiness

Execute every task in `docs/superpowers/plans/2026-06-26-launch-readiness.md` (Tasks 1–11), in order, under this plan's autonomy + deploy policy. That file is self-contained (alert columns/migration, alert API, alert service, weekly digest, cron entrypoint, alert-arming UI, news-link fix, as-of timestamps, Compare polish, cron docs, launch-gate docs). On completion, green-gate + deploy as v1.5.0.

---

## PHASE 2 — Growth Quick-Wins

Branch: `night/phase-2-growth`. Version bump to v1.6.0 on phase completion.

### Task 2.1: Light/dark theme toggle

**Files:**
- Modify: `frontend/src/theme/tokens.ts` (add a `THEMES` map + make `rootCssVars` theme-aware)
- Modify: `frontend/src/App.tsx` (apply theme vars from store)
- Modify: `frontend/src/state/store.ts` (add `theme: 'dark'|'light'`, `setTheme`, persist to localStorage)
- Modify: `frontend/src/components/Header.tsx` (add a theme toggle button)
- Test: `frontend/src/theme/theme.test.ts`

**Interfaces:**
- Consumes: existing `COLORS` + `rootCssVars(accent, density)`.
- Produces: `THEMES: Record<'dark'|'light', typeof COLORS>`; `rootCssVars(accent, density, theme)`; store `theme` + `setTheme(t)` persisted under `tt_theme`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/src/theme/theme.test.ts
import { describe, it, expect } from 'vitest'
import { THEMES, rootCssVars } from './tokens'

it('exposes dark and light themes with the same keys', () => {
  expect(Object.keys(THEMES.dark).sort()).toEqual(Object.keys(THEMES.light).sort())
})
it('rootCssVars emits different bg per theme', () => {
  const dark = rootCssVars(undefined, 'balanced', 'dark') as Record<string,string>
  const light = rootCssVars(undefined, 'balanced', 'light') as Record<string,string>
  expect(dark['--bg']).not.toEqual(light['--bg'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- theme`
Expected: FAIL — `THEMES` undefined.

- [ ] **Step 3: Implement themes**

In `tokens.ts`: keep `COLORS` as the dark default; add a `light` variant (light bg `#f7f8fa`, panel `#ffffff`, card `#ffffff`, lines dark-on-light, `tx` `#11151b`, `tx2`/`tx3` mid greys, keep `up`/`down`/`accent` brand colors). Export `THEMES = { dark: COLORS, light: {...} }`. Change `rootCssVars` signature to `(accent = COLORS.accent, density: Density = 'balanced', theme: 'dark'|'light' = 'dark')` and source each `--xxx` from `THEMES[theme]`. Decision to log: exact light-theme greys are a judgment call — log the chosen hexes in DECISIONS.md.

- [ ] **Step 4: Wire store + persistence**

In `store.ts`: add `theme: (localStorage.getItem('tt_theme') as 'dark'|'light') || 'dark'`, and `setTheme: (t) => { localStorage.setItem('tt_theme', t); set({ theme: t }) }`. In `App.tsx`, read `theme` and pass to `rootCssVars(...)` in the root style. In `Header.tsx`, add a small ☾/☀ button calling `setTheme(theme === 'dark' ? 'light' : 'dark')`.

- [ ] **Step 5: Run tests + build**

Run: `cd frontend && npm run test -- theme && npm run build`
Expected: PASS + clean build.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/theme/tokens.ts frontend/src/state/store.ts frontend/src/App.tsx frontend/src/components/Header.tsx frontend/src/theme/theme.test.ts
git commit -m "feat(theme): light/dark toggle via theme-aware token vars (persisted)"
```

### Task 2.2: Onboarding starter watchlists

**Files:**
- Create: `frontend/src/data/starterLists.ts`
- Create: `frontend/src/components/StarterPicker.tsx`
- Modify: `frontend/src/views/ManageWatchlist.tsx` (show picker when watchlist empty)
- Test: `frontend/src/components/StarterPicker.test.tsx`

**Interfaces:**
- Consumes: existing `addWatch(sym)` store action.
- Produces: `STARTER_LISTS: { id: string; label: string; symbols: string[] }[]` (Big Tech, AI, Crypto Majors, Dividend); `<StarterPicker />` bulk-adds a list's symbols.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/StarterPicker.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { StarterPicker } from './StarterPicker'
it('renders starter list options', () => {
  render(<StarterPicker />)
  expect(screen.getByText(/Big Tech/i)).toBeTruthy()
  expect(screen.getByText(/Crypto Majors/i)).toBeTruthy()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test -- StarterPicker`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement data + component**

`starterLists.ts`:
```ts
export const STARTER_LISTS = [
  { id: 'bigtech', label: 'Big Tech', symbols: ['AAPL','MSFT','GOOGL','AMZN','META','NVDA'] },
  { id: 'ai', label: 'AI', symbols: ['NVDA','AMD','PLTR','SMCI','TSM','MSFT'] },
  { id: 'crypto', label: 'Crypto Majors', symbols: ['BTC','ETH','SOL','COIN'] },
  { id: 'dividend', label: 'Dividend', symbols: ['JPM','XOM','KO','PG','JNJ'] },
] as const
```
`StarterPicker.tsx`: render each list as a card with its symbols; clicking calls `addWatch` for each symbol (await sequentially, like the existing bulk-add in ManageWatchlist). Match the card styling already in ManageWatchlist. In `ManageWatchlist.tsx`, when `items.length === 0` and authed, render `<StarterPicker />` above the empty-state message.

- [ ] **Step 4: Run tests + build**

Run: `cd frontend && npm run test -- StarterPicker && npm run build`
Expected: PASS + clean.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/data/starterLists.ts frontend/src/components/StarterPicker.tsx frontend/src/views/ManageWatchlist.tsx frontend/src/components/StarterPicker.test.tsx
git commit -m "feat(onboarding): starter watchlists to solve cold-start"
```

### Task 2.3: Shareable read-only watchlist links

**Files:**
- Modify: `backend/models.py` (add `share_token` to a new lightweight share, OR reuse settings) — see step 3
- Create: `backend/services/share.py`
- Modify: `backend/app.py` (routes: `POST /api/watchlist/share` → token; `GET /api/shared/<token>` → public read-only list)
- Create: `backend/migrations/versions/bb01_share_token.py`
- Modify: `frontend/src/views/ManageWatchlist.tsx` (a "Share" button → copyable link)
- Create: `frontend/src/views/SharedWatchlist.tsx` (renders `/s/<token>` read-only) + route handling in `App.tsx`
- Test: `backend/tests/test_share.py`

**Interfaces:**
- Produces: `create_share(user_id) -> token:str`; `resolve_share(token) -> {owner_name, items:[{symbol}]} | None`. Public GET requires NO auth and returns only symbols (no targets/alerts — privacy).

- [ ] **Step 1: Write the failing test**

```python
# backend/tests/test_share.py
import services.share as sh
def test_create_and_resolve_share():
    sh._seed_user_with_watchlist(email="o@e.com", name="Owner", symbols=["AAPL","NVDA"])
    token = sh.create_share(user_id=1)
    assert token and len(token) >= 16
    res = sh.resolve_share(token)
    assert res["owner_name"] == "Owner"
    assert sorted(i["symbol"] for i in res["items"]) == ["AAPL","NVDA"]
def test_resolve_unknown_token_is_none():
    assert sh.resolve_share("nope") is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_share.py -v`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement share (token on Settings)**

Add `share_token = Column(String, nullable=True, index=True)` to `Settings` in `models.py` + migration `bb01_share_token` (down_revision = `aa01_alert_state` from Phase 1; verify with `alembic heads`). `share.py`:
```python
import secrets, db, models
def create_share(user_id):
    with db.get_session() as s:
        st = s.query(models.Settings).get(user_id)
        if st is None:
            st = models.Settings(user_id=user_id); s.add(st)
        if not st.share_token:
            st.share_token = secrets.token_urlsafe(12)
        s.commit(); return st.share_token
def resolve_share(token):
    with db.get_session() as s:
        st = s.query(models.Settings).filter_by(share_token=token).first()
        if not st: return None
        user = s.query(models.User).get(st.user_id)
        items = (s.query(models.WatchlistItem).filter_by(user_id=st.user_id)
                 .order_by(models.WatchlistItem.position).all())
        return {"owner_name": (user.name if user else "") or "A Ticker Tracker user",
                "items": [{"symbol": w.symbol} for w in items]}
def _seed_user_with_watchlist(email, name, symbols):
    with db.get_session() as s:
        u = models.User(email=email, name=name, email_verified=True); s.add(u); s.flush()
        s.add(models.Settings(user_id=u.id))
        for i, sym in enumerate(symbols):
            s.add(models.WatchlistItem(user_id=u.id, symbol=sym, position=i))
        s.commit()
```
Routes in `app.py`: `POST /api/watchlist/share` (auth required) → `{token}`; `GET /api/shared/<token>` (NO auth, exempt from rate-limit prefix if needed) → envelope of `resolve_share` or 404. Frontend: a "Share" button in ManageWatchlist that POSTs then copies `${location.origin}/s/${token}`; a `SharedWatchlist` view reached when `location.pathname.startsWith('/s/')` rendering the read-only list (logos + symbols + live quotes via existing `api.quotes`).

- [ ] **Step 4: Run tests + build**

Run: `cd backend && ./.venv/Scripts/python.exe -m pytest tests/test_share.py -v` then `cd frontend && npm run build`
Expected: PASS + clean.

- [ ] **Step 5: Commit**

```bash
git add backend/models.py backend/services/share.py backend/app.py backend/migrations/versions/bb01_share_token.py frontend/src/views/ManageWatchlist.tsx frontend/src/views/SharedWatchlist.tsx frontend/src/App.tsx backend/tests/test_share.py
git commit -m "feat(share): read-only shareable watchlist links"
```

### Task 2.4: CSV / paste import polish

**Files:**
- Modify: `frontend/src/views/ManageWatchlist.tsx` (the bulk-add box already parses comma/space/newline; add a small ".csv" file input that reads text and feeds the same parser)
- Test: extend `frontend/src/views/ManageWatchlist.test.tsx`

**Interfaces:** reuses the existing `submitBulk` parser.

- [ ] **Step 1: Write failing test** — assert a file input with accept=".csv,.txt" exists (`screen.getByTitle(/import/i)`).
- [ ] **Step 2: Run → fail.** `cd frontend && npm run test -- ManageWatchlist`
- [ ] **Step 3: Implement** — add `<input type="file" accept=".csv,.txt" title="Import tickers from file">`; on change, `await file.text()`, set the bulk textarea value to the text, call the existing parse/add path.
- [ ] **Step 4: Run tests + build** → PASS.
- [ ] **Step 5: Commit** — `feat(import): CSV/txt file import reuses bulk-add parser`.

**Phase-2 green gate + deploy (v1.6.0)** per the deploy policy.

---

## PHASE 3 — Engagement

> **Granularity note:** Phases 3–5 are specified as task briefs (files + interfaces + TDD step sequence + commit message), not full code, because (a) much would drift before the run reaches them and (b) the run may not get this far. Before dispatching each Phase 3–5 task, the controller expands its brief into concrete failing-test + implementation code following the patterns already established in Phases 1–2 and the existing codebase, logging any non-obvious choice to DECISIONS.md. Phases 1–2 contain full code and are the source-of-truth patterns to copy.

Branch: `night/phase-3-engagement`. Version v1.7.0.

### Task 3.1: Earnings calendar endpoint + view

**Files:**
- Modify: `backend/providers/finnhub.py` (add `fetch_earnings(frm, to)` using Finnhub `/calendar/earnings`)
- Create: `backend/services/earnings.py` (cache 6h)
- Modify: `backend/app.py` (`GET /api/earnings` for the user's watchlist symbols, or `?syms=`)
- Create: `frontend/src/views/Earnings.tsx` + nav entry + `View` type `'earnings'`
- Test: `backend/tests/test_earnings.py`

**Interfaces:** `fetch_earnings(frm, to) -> list[{symbol, date, hour, epsEstimate}]`; service caches + filters to requested symbols.

- [ ] **Step 1: Write failing test** — monkeypatch `requests.get` to return a fake earnings payload; assert `services.earnings.get_earnings(["AAPL"])` filters to AAPL and is cached (second call doesn't re-fetch).
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** provider + service (mirror existing `fetch_news`/`get_news` cache pattern with `cache.cached(key, 21600, producer)`) + route (envelope) + `Earnings.tsx` table (date, symbol, time, EPS est) + add `'earnings'` to the `View` union and a nav button.
- [ ] **Step 4: Run tests + build** → PASS.
- [ ] **Step 5: Commit** — `feat(earnings): earnings calendar (Finnhub) endpoint + view`.

### Task 3.2: Saved screener filters

**Files:**
- Create: `backend/models.py` `SavedScreen(user_id, name, filters_json)` + migration `cc01_saved_screens.py`
- Modify: `backend/app.py` (CRUD: `GET/POST /api/screens`, `DELETE /api/screens/<id>`)
- Create: `backend/services/screens.py`
- Modify: `frontend/src/views/Screener.tsx` (Save current filters / load saved)
- Test: `backend/tests/test_screens.py`

**Interfaces:** `list_screens(user_id)`, `save_screen(user_id, name, filters: dict)`, `delete_screen(user_id, id)`. Filters stored as JSON string.

- [ ] **Step 1: Write failing test** — save a screen, list it back, delete it; assert scoping to user_id.
- [ ] **Step 2: Run → fail.**
- [ ] **Step 3: Implement** model + migration (down_revision = `bb01_share_token`; verify) + service (JSON-encode filters) + routes (auth required, allowlist `{name, filters}`) + Screener UI (a "Save screen" button capturing `{grp, perf, cap}`, a dropdown to load).
- [ ] **Step 4: Run tests + build** → PASS.
- [ ] **Step 5: Commit** — `feat(screener): saved screener filters`.

### Task 3.3: Per-watchlist sentiment summary

**Files:**
- Modify: `backend/services/news.py` (add `watchlist_sentiment(syms) -> {bullish,bearish,neutral, mood}`)
- Modify: `backend/app.py` (`GET /api/sentiment?syms=`)
- Modify: `frontend/src/views/AtAGlance.tsx` or Dashboard (a small "watchlist mood today" chip)
- Test: `backend/tests/test_sentiment.py`

**Interfaces:** aggregates `_sentiment` over recent news for the symbols; `mood` = majority label.

- [ ] **Step 1–5:** TDD as above — failing test asserting counts + mood from a fake news set; implement aggregation (reuse `fetch_news` per symbol, cap symbols to ~10 for rate limits); route; small UI chip. Commit `feat(sentiment): per-watchlist sentiment summary`.

**Phase-3 green gate + deploy (v1.7.0)** per policy.

---

## PHASE 4 — Polish, Coverage & Accessibility

Branch: `night/phase-4-polish`. Version v1.8.0. These are independent, low-risk; do as many as time allows, each its own commit.

- [ ] **Task 4.1 — Loading & error states audit.** For each view that fetches (`Dashboard`, `AtAGlance`, `Crypto`, `MarketViews`, `Earnings`), ensure a skeleton/spinner while loading and a friendly error message on fetch failure (not a blank panel). TDD where a component test can assert the loading text; otherwise verify via build + a Playwright smoke. Commit per view.
- [ ] **Task 4.2 — Backend test coverage push.** Add tests for untested branches in `services/quotes.py` (mock fallback path), `services/search.py` (cache hit), `providers/finnhub.py` (`fetch_ratings` consensus thresholds). Target: raise count meaningfully. Commit `test: cover quotes fallback, search cache, ratings consensus`.
- [ ] **Task 4.3 — Accessibility pass.** Add `aria-label`s to icon-only buttons (search, theme toggle, hamburger, remove), ensure inputs have associated labels, check color-contrast of `tx3` on `card` (log any token tweak in DECISIONS.md). Commit `a11y: labels on icon buttons + input associations`.
- [ ] **Task 4.4 — Empty-state coverage.** Holdings (anon + empty), Alerts (none set), Screener (no matches), Earnings (none upcoming) all show a helpful message, never a blank. Commit `fix: friendly empty states across views`.
- [ ] **Task 4.5 — README + screenshots.** Update `README.md` with current feature set, the deployed URL, the tech stack, and local-dev instructions. Commit `docs: refresh README`.

**Phase-4 green gate + deploy (v1.8.0)** per policy.

---

## PHASE 5 — Stretch (only if time remains)

Branch: `night/phase-5-stretch`. Pick from, in order, each fully TDD + its own commit; STOP at sunrise / when out of work:

- [ ] **5.1** Weekly-digest unsubscribe link (token route that flips `Settings.news_digest=False`).
- [ ] **5.2** Keyboard shortcuts (`/` focuses search, `g d` → dashboard) with a help overlay.
- [ ] **5.3** Per-symbol price-history sparkline on watchlist cards (reuse `api.history`, tiny SVG).
- [ ] **5.4** `robots.txt` + `sitemap.xml` + OpenGraph meta tags for shareable links (uses the brand icon from v1.4.2).

---

## Final Summary (controller, end of run)

- [ ] Append to `docs/ops/DECISIONS.md`: phases completed, phases left un-merged (with reason), every default decision made, every deploy + its result, and the morning review checklist (what to eyeball, what to manually QA, the launch gates still owed).
- [ ] Ensure `main` is in a known-good state (last merged phase was green). Leave any red phase on its branch, clearly noted.
