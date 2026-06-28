# Earnings: merge into the per-stock card, remove the standalone page

**Date:** 2026-06-27
**Status:** Approved (design)

## Problem

The app has two earnings surfaces, inverted from where the value is:

- **Standalone Earnings page** (`views/Earnings.tsx`) — uses **real** Finnhub data
  but is a rarely-visited, watchlist-wide list. It looks "spotty" because most
  watchlist symbols have no report scheduled in the 30-day window (expected), and
  crypto / most non-US tickers have no earnings events at all.
- **Per-stock Due Diligence "Earnings & Events" card** (`components/DueDiligence.tsx`)
  — sits in the high-intent place (you're researching that ticker) but shows
  **fake data**: a deterministic RNG seeded on the symbol produces an invented
  earnings date, EPS estimate, "surprise" %, ex-dividend date, and investor day.
  This is a quiet correctness bug — confidently-rendered invented data.

## Goal

Put the **real** earnings data where intent is highest (the per-stock card),
remove the fabricated data, and retire the thin standalone page. Honest data
everywhere; one fewer nav slot.

## Decisions (locked with user)

- **Standalone page:** remove fully (nav item, `/earnings` route, `g e` shortcut,
  view, `Earnings.tsx`). Backend `/api/earnings` + service stay (now consumed
  per-stock).
- **Card content:** real earnings only — next earnings date, time
  (Before open / After close / —), forward EPS estimate. Drop the fake
  ex-dividend, investor day rows and the EPS "surprise" %.
- **Empty state:** when no upcoming report in the window, show "No upcoming
  report" (muted) — consistent with the backend coverage diagnostic.

## Design

### Part A — Real earnings on the Due Diligence card

**Store (`state/store.ts`):**
- Add state `earnings: Record<string, EarningsRow | null>` (initial `{}`).
- Add action `loadEarnings(sym)` mirroring `loadRatings`:
  - If `get().earnings[sym] !== undefined`, return (already fetched — note `null`
    is a valid cached "no report" result, so guard on `undefined`, not falsiness).
  - `const { data } = await api.earnings([sym])`; store `data[0] ?? null`.
  - On error, leave unset (card shows loading/empty).
- Extend the `View` union: remove `'earnings'`.

**`components/DueDiligence.tsx`:**
- Delete the RNG block (the `makeRng`/`hashStr` earnings date, `epsEst`,
  `surprise`, `ev2`/`ev3`, and the `events` array — current lines ~51-64).
- In the existing effect, also call `loadEarnings(selected)`.
- Read `const e = useStore((s) => s.earnings[selected])`.
- Rename the card heading "Earnings & Events" → "Next Earnings".
- Render real fields:
  - Date: format the ISO `e.date` (`YYYY-MM-DD`) as `Mon D, YYYY` using the
    existing `MONTHS` array — matching the card's prior visual style, not the
    raw ISO the old list page showed.
  - Time: `hourLabel(e.hour)` → `Before open` (`bmo`) / `After close` (`amc`) / `—`.
  - EPS estimate: `e.epsEstimate != null ? $X.XX : —`.
  - When `e === null`: muted "No upcoming report". When `e === undefined`
    (loading): a `…` placeholder consistent with the ratings card.
- Keep the `MONTHS` import (still used for date formatting); remove the now-unused
  `makeRng` and `hashStr` imports.

### Part B — Remove the standalone page

Delete / clean (enumerated):
- `views/Earnings.tsx` — delete file.
- `App.tsx` — remove the `import { Earnings }` (line 17) and the
  `{view === 'earnings' && <Earnings />}` render (line 123).
- `components/Header.tsx` — remove the `{ label: 'Earnings', view: 'earnings' }`
  nav item (line 18).
- `components/ShortcutsHelp.tsx` — remove the `g e` help entry (line 19).
- `hooks/useKeyboardShortcuts.ts` — remove `e: 'earnings'` (line 16).
- `routes.ts` (untracked, in-progress router work) — remove
  `earnings: '/earnings'` (line 19).
- `state/store.ts` — remove `'earnings'` from the `View` union (line 31).
- `components/Footer.tsx` — update the marketing description (line 49) to drop
  "an earnings calendar" so copy doesn't promise a removed feature.

**Kept:** `api.earnings` (`api/client.ts`), `EarningsRow` (`api/types.ts`), and the
entire backend (`/api/earnings` route, `services/earnings.py` incl. the coverage
diagnostic) — all now consumed per-stock.

## Testing

- `hooks/useKeyboardShortcuts.test.ts` — remove the `e → earnings` expectation
  (and confirm `viewForKey('e')` no longer maps to a view).
- Add a store test for `loadEarnings`: (a) fetch returns a row → stored at
  `earnings[sym]`; (b) fetch returns `[]` → stored as `null` (not left undefined),
  proving the "no upcoming report" path and the `undefined`-guard cache.
- Backend: unchanged (already green — 148 passing).

## Out of scope

- No ex-dividend / investor-day rows, no EPS surprise.
- No at-a-glance earnings chip on watchlist cards.
- No changes to the in-progress URL-router migration beyond removing the single
  earnings entry from `routes.ts`.

## Coordination note

The working tree has an unrelated, uncommitted URL-router migration
(`routes.ts`, `RouterBridge.tsx`, modified `App.tsx`/`main.tsx`/`store.ts`). This
change edits `routes.ts`, `store.ts`, and `App.tsx` in place; the edits are small
and scoped to removing the earnings view, so they should not conflict with that
work.
