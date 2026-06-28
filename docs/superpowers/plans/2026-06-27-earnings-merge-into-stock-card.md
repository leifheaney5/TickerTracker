# Earnings Merge Into Per-Stock Card — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show real Finnhub earnings on the per-stock Due Diligence card and remove the standalone Earnings page.

**Architecture:** Add an `earnings` slice + `loadEarnings(sym)` action to the Zustand store (mirroring `loadRatings`), backed by the existing `/api/earnings?syms=` endpoint. The Due Diligence "Earnings & Events" card swaps its deterministic-RNG mock data for the real next report (date, time, forward EPS), with an honest empty state. The standalone Earnings page and its nav/route/shortcut wiring are deleted.

**Tech Stack:** React + TypeScript + Vite, Zustand store, Vitest. Backend Flask (unchanged — already serves `/api/earnings`).

## Global Constraints

- Frontend test runner: `npm test` (= `vitest run`) from `frontend/`.
- Type check / build: `npm run build` from `frontend/` (runs `tsc` then Vite).
- Backend is already complete (coverage diagnostic committed `e6d9376`); do NOT modify backend code in this plan.
- The working tree has an in-progress URL-router migration (`routes.ts`, `RouterBridge.tsx`, modified `App.tsx`/`main.tsx`/`store.ts`). Touch ONLY the `earnings` entries in shared files; leave `screener` and all other entries alone.
- `EarningsRow` shape (already defined in `api/types.ts`): `{ symbol: string; date: string; hour: string; epsEstimate: number | null }`. `date` is ISO `YYYY-MM-DD`. `hour` is `bmo` | `amc` | other.
- No `Co-Authored-By` trailers in commits (user global rule).

---

### Task 1: Store — `earnings` state + `loadEarnings` action

**Files:**
- Modify: `frontend/src/state/store.ts` (state interface ~line 60, initial state ~line 140, actions ~line 356 near `loadRatings`)
- Test: `frontend/src/state/store.test.ts`

**Interfaces:**
- Consumes: `api.earnings(syms: string[]) => Promise<{ data: EarningsRow[] }>` (exists, `api/client.ts:69`).
- Produces:
  - State: `earnings: Record<string, EarningsRow | null>`
  - Action: `loadEarnings(sym: string) => Promise<void>` — stores the soonest upcoming row at `earnings[sym]`, or `null` when none. Guards re-fetch on `=== undefined` (so a cached `null` is not re-fetched).

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/state/store.test.ts` (new `describe` block at end of file):

```ts
import type { EarningsRow } from '../api/types'

describe('loadEarnings', () => {
  beforeEach(() => {
    useStore.setState({ earnings: {} })
  })

  it('stores the first upcoming row at earnings[sym]', async () => {
    const row: EarningsRow = { symbol: 'AAPL', date: '2026-07-10', hour: 'amc', epsEstimate: 1.55 }
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [row], meta: { source: 'finnhub', stale: false } }),
    }) as never
    await useStore.getState().loadEarnings('AAPL')
    expect(useStore.getState().earnings['AAPL']).toEqual(row)
  })

  it('stores null (not undefined) when there is no upcoming report', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: [], meta: { source: 'finnhub', stale: false } }),
    }) as never
    await useStore.getState().loadEarnings('TSLA')
    expect(useStore.getState().earnings['TSLA']).toBeNull()
  })

  it('does not re-fetch when the symbol is already cached (incl. null)', async () => {
    useStore.setState({ earnings: { TSLA: null } })
    const spy = vi.fn()
    global.fetch = spy as never
    await useStore.getState().loadEarnings('TSLA')
    expect(spy).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- src/state/store.test.ts`
Expected: FAIL — `loadEarnings is not a function` / `earnings` undefined.

- [ ] **Step 3: Add the state field to the interface**

In `frontend/src/state/store.ts`, in the `StoreState` interface near the other record slices (next to `ratings: Record<string, Ratings>`, ~line 60), add:

```ts
  earnings: Record<string, EarningsRow | null>
```

And in the action declarations near `loadRatings: (sym: string) => Promise<void>` (~line 91), add:

```ts
  loadEarnings: (sym: string) => Promise<void>
```

Ensure `EarningsRow` is imported at the top of the file. If the existing type import line is e.g. `import type { Ratings, ... } from '../api/types'`, add `EarningsRow` to it. (Check whether `api/client` re-exports types; import from `../api/types` to match `EarningsRow`'s definition site.)

- [ ] **Step 4: Add the initial state**

In the `create<StoreState>(...)` initial object, next to `ratings: {},` (~line 140), add:

```ts
  earnings: {},
```

- [ ] **Step 5: Add the action**

Immediately after the `loadRatings` action (~line 362), add:

```ts
  loadEarnings: async (sym) => {
    if (get().earnings[sym] !== undefined) return
    try {
      const { data } = await api.earnings([sym])
      set((st) => ({ earnings: { ...st.earnings, [sym]: data[0] ?? null } }))
    } catch { /* leave unset → card shows loading/empty */ }
  },
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd frontend && npm test -- src/state/store.test.ts`
Expected: PASS (all three new tests + existing auth-store tests).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/state/store.ts frontend/src/state/store.test.ts
git commit -m "feat(store): loadEarnings action + earnings slice (real per-stock earnings)"
```

---

### Task 2: Due Diligence card — real earnings, drop the RNG

**Files:**
- Modify: `frontend/src/components/DueDiligence.tsx` (imports ~1-9, derivation ~51-65, JSX ~117-144)

**Interfaces:**
- Consumes: `earnings: Record<string, EarningsRow | null>` and `loadEarnings(sym)` from Task 1; existing `useStore`, `FONT_MONO`, `MONTHS`.

- [ ] **Step 1: Remove the RNG-derived earnings/events block**

In `frontend/src/components/DueDiligence.tsx`, delete the deterministic block (currently ~lines 51-64):

```ts
  // earnings/events derived deterministically (parity with prototype _dd)
  const rng = makeRng(hashStr(selected) + 57)
  const today = new Date(2026, 5, 25)
  const ed = new Date(today); ed.setDate(ed.getDate() + Math.floor(9 + rng() * 68))
  const earnDate = `${MONTHS[ed.getMonth()]} ${ed.getDate()}, ${ed.getFullYear()}`
  const epsEst = (0.3 + rng() * 3.4).toFixed(2)
  const surprise = (rng() - 0.32) * 13
  const ev2 = new Date(today); ev2.setDate(ev2.getDate() + Math.floor(4 + rng() * 18))
  const ev3 = new Date(today); ev3.setDate(ev3.getDate() + Math.floor(24 + rng() * 40))
  const events = [
    { label: 'Earnings call', date: earnDate },
    { label: 'Ex-dividend date', date: `${MONTHS[ev2.getMonth()]} ${ev2.getDate()}` },
    { label: 'Investor day', date: `${MONTHS[ev3.getMonth()]} ${ev3.getDate()}` },
  ]
```

- [ ] **Step 2: Add real earnings selection + a date/time/eps formatter**

Replace the deleted block with:

```ts
  // Real upcoming earnings (Finnhub via store). undefined = loading, null = none.
  const e = useStore((s) => s.earnings[selected])

  // Format ISO 'YYYY-MM-DD' as 'Mon D, YYYY' to match the card's style.
  function fmtEarnDate(iso: string): string {
    const [y, m, d] = iso.split('-').map(Number)
    if (!y || !m || !d) return iso
    return `${MONTHS[m - 1]} ${d}, ${y}`
  }
  function hourLabel(hour: string): string {
    if (hour === 'bmo') return 'Before open'
    if (hour === 'amc') return 'After close'
    return '—'
  }
```

- [ ] **Step 3: Load earnings in the existing effect**

The component already has `useEffect(() => { loadRatings(selected) }, [selected, loadRatings])` (~line 26). Add the store action selector near the other selectors (~line 23):

```ts
  const loadEarnings = useStore((s) => s.loadEarnings)
```

And extend the effect:

```ts
  useEffect(() => { loadRatings(selected); loadEarnings(selected) }, [selected, loadRatings, loadEarnings])
```

- [ ] **Step 4: Replace the "Earnings & Events" card JSX**

Replace the card block (currently ~lines 119-144, the `<div style={card}>` containing "Earnings &amp; Events" through its closing `</div>` before the About card) with:

```tsx
        <div style={card}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>Next Earnings</span>
          {e === undefined && (
            <span style={{ fontSize: '12.5px', color: 'var(--tx3)' }}>…</span>
          )}
          {e === null && (
            <span style={{ fontSize: '12.5px', color: 'var(--tx3)' }}>No upcoming report in the next 30 days</span>
          )}
          {e && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: '10px', letterSpacing: '.04em', color: 'var(--tx3)' }}>DATE</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx)' }}>{fmtEarnDate(e.date)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: '10px', letterSpacing: '.04em', color: 'var(--tx3)' }}>TIME</span>
                <span style={{ fontSize: '13px', color: 'var(--tx)' }}>{hourLabel(e.hour)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <span style={{ fontSize: '10px', letterSpacing: '.04em', color: 'var(--tx3)' }}>EPS EST.</span>
                <span style={{ fontFamily: FONT_MONO, fontSize: '13px', color: 'var(--tx)' }}>
                  {e.epsEstimate != null ? `$${e.epsEstimate.toFixed(2)}` : '—'}
                </span>
              </div>
            </div>
          )}
        </div>
```

- [ ] **Step 5: Remove now-unused imports**

At the top of the file, remove the two imports only used by the deleted RNG block:

```ts
import { hashStr } from '../lib/hash'
import { makeRng } from '../data/series'
```

Note: `fallbackSpark` is imported from `../data/series` on a separate line and is referenced via `void fallbackSpark` — leave that import and the `void` line alone. Keep `MONTHS` (used by `fmtEarnDate`) and `FONT_MONO`.

- [ ] **Step 6: Type-check / build**

Run: `cd frontend && npm run build`
Expected: PASS — no `tsc` errors. (If `tsc` flags `MONTHS` or `FONT_MONO` as unused, they are still used; re-check the edits. If it flags the removed `surprise`/`events`/`earnDate`/`epsEst` as undefined, a JSX reference was missed — search the file for those identifiers and remove the stragglers.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/DueDiligence.tsx
git commit -m "feat(dd): show real Finnhub earnings on the stock card (drop RNG mock)"
```

---

### Task 3: Remove the standalone Earnings page

**Files:**
- Delete: `frontend/src/views/Earnings.tsx`
- Modify: `frontend/src/App.tsx` (import line 17, render line 123)
- Modify: `frontend/src/components/Header.tsx` (nav item line 18)
- Modify: `frontend/src/components/ShortcutsHelp.tsx` (entry line 19)
- Modify: `frontend/src/hooks/useKeyboardShortcuts.ts` (map entry line 16)
- Modify: `frontend/src/routes.ts` (VIEW_TO_PATH entry line 19)
- Modify: `frontend/src/state/store.ts` (View union line 31)
- Test: `frontend/src/hooks/useKeyboardShortcuts.test.ts`

**Interfaces:**
- Produces: removal of the `'earnings'` member from the `View` union — every consumer of `'earnings'` must be gone after this task or `tsc` fails (this is the safety net).

- [ ] **Step 1: Update the failing shortcut test first**

In `frontend/src/hooks/useKeyboardShortcuts.test.ts`, remove the `e → earnings` test (lines 17-19):

```ts
  it('maps e → earnings', () => {
    expect(viewForKey('e')).toBe('earnings')
  })
```

And add an assertion that `e` is now unmapped — append inside the `describe`:

```ts
  it('returns null for e (earnings page removed)', () => {
    expect(viewForKey('e')).toBeNull()
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npm test -- src/hooks/useKeyboardShortcuts.test.ts`
Expected: FAIL — `viewForKey('e')` still returns `'earnings'`.

- [ ] **Step 3: Remove the `e` mapping**

In `frontend/src/hooks/useKeyboardShortcuts.ts`, delete the line in the `viewForKey` map (line 16):

```ts
    e: 'earnings',
```

(Leave `s: 'screener'` and the rest untouched.)

- [ ] **Step 4: Remove the View union member**

In `frontend/src/state/store.ts`, on the `View` union (line 31), remove `| 'earnings'`:

```ts
  | 'managewatch' | 'earnings'
```

becomes

```ts
  | 'managewatch'
```

- [ ] **Step 5: Remove the route mapping**

In `frontend/src/routes.ts`, delete the `VIEW_TO_PATH` entry (line 19):

```ts
  earnings: '/earnings',
```

- [ ] **Step 6: Remove the nav item**

In `frontend/src/components/Header.tsx`, delete the nav entry (line 18):

```ts
  { label: 'Earnings', view: 'earnings' },
```

- [ ] **Step 7: Remove the shortcut-help entry**

In `frontend/src/components/ShortcutsHelp.tsx`, delete the entry (line 19):

```ts
  { keys: ['g', 'e'], desc: 'Go to Earnings' },
```

- [ ] **Step 8: Remove the App render + import**

In `frontend/src/App.tsx`, delete the import (line 17):

```ts
import { Earnings } from './views/Earnings'
```

and the conditional render (line 123):

```tsx
      {view === 'earnings' && <Earnings />}
```

- [ ] **Step 9: Delete the view file**

```bash
git rm frontend/src/views/Earnings.tsx
```

- [ ] **Step 10: Type-check / build + full test run**

Run: `cd frontend && npm run build && npm test`
Expected: PASS — `tsc` confirms no dangling `'earnings'` references; all vitest suites green. (If `tsc` reports `'earnings'` is not assignable / referenced somewhere, search `frontend/src` for `'earnings'` and remove the straggler.)

- [ ] **Step 11: Commit**

```bash
git add -A frontend/src
git commit -m "refactor(ui): remove standalone Earnings page (now per-stock on the DD card)"
```

---

### Task 4: Marketing copy + changelog

**Files:**
- Modify: `frontend/src/components/Footer.tsx` (description line ~49)
- Modify: `CHANGELOG.md` (`[Unreleased]` section)

- [ ] **Step 1: Update the Footer description**

In `frontend/src/components/Footer.tsx`, the long description string (line ~49) lists "an earnings calendar" among features. Remove that clause so copy doesn't promise a removed page. Change:

```
... analyst ratings, an earnings calendar, a market map, and a crypto Fear & Greed index.
```

to:

```
... analyst ratings, a market map, and a crypto Fear & Greed index.
```

(Match the exact surrounding text; only drop the "an earnings calendar, " fragment.)

- [ ] **Step 2: Add a changelog entry**

In `CHANGELOG.md`, under `## [Unreleased]`, add to the existing `### Changed` block (or create one if the concurrent edits moved it):

```markdown
- **Earnings moved onto the stock card** — the per-stock Due Diligence panel now
  shows the *real* next earnings date, time (before open / after close), and
  forward EPS estimate from Finnhub, replacing the previous placeholder values.
  The standalone Earnings calendar page (and its `g e` shortcut) was removed —
  earnings now live where you research a ticker, with an honest "no upcoming
  report" state when nothing is scheduled in the next 30 days.
```

- [ ] **Step 3: Final verification**

Run: `cd frontend && npm run build && npm test`
Expected: PASS — build clean, all suites green.

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md frontend/src/components/Footer.tsx
git commit -m "docs(changelog): earnings merged into stock card; drop calendar from footer copy"
```

---

## Notes on concurrent work

`CHANGELOG.md`, `App.tsx`, `store.ts`, and `routes.ts` are being edited in a parallel router-migration effort. Before each commit that touches them, re-read the exact lines (they may have shifted). Only remove the `earnings`-specific fragments; never touch `screener` or router-migration lines.
