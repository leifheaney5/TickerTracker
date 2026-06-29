# Market Map drill-down & market picker — design

**Date:** 2026-06-29
**Status:** Approved (design)
**Area:** `frontend/src/views/MarketViews.tsx`, `frontend/src/charts/Treemap.tsx`, `frontend/src/data/market.ts`

## Problem

The Market Map (`/map`) renders a single squarified treemap of ~120 large-cap
tickers crammed into one "All sectors" blob. It looks good but is not usable for
exploration:

- **Tiles are inert.** `Treemap` already accepts an `onTileClick` prop, but the
  map renders it without one — clicking a tile does nothing.
- **No way to focus a market.** All sectors are mixed together, so smaller-cap
  tickers are unreadably tiny and there is no way to drill into one sector.
- **No affordance.** Nothing signals the map is interactive (no hover state, no
  pointer cursor on the map usage).

The user wants to (a) click a tile to drill into that ticker, and (b) scroll
through and pick their preferred market.

## Goals

1. Clicking a tile drills into that ticker's full detail page.
2. Hovering a tile reveals a tooltip (name · price · % change · market cap) so
   users can explore without committing to a click.
3. A two-level, scrollable "pick your market" picker above the map:
   - **Universe toggle:** `Stocks` · `Crypto`.
   - **Sector chips** (Stocks only): `All` + the 11 real sectors, horizontally
     scrollable. Selecting a sector redraws the treemap to just that sector,
     making its tiles large and legible.

## Non-goals / honest constraints

- **No fabricated index membership.** We do not have S&P 500 / Nasdaq 100 / Dow
  constituent data for the HM tickers, and the app is "Informational only." The
  universe picker is therefore the two real datasets we already render
  (`Stocks` = `HM`, `Crypto` = existing CoinGecko treemap), NOT named indices.
- No backend changes. All stock map data stays the existing synthetic `HM`;
  crypto stays the existing real `/api/crypto` feed.
- No new ticker-detail UI — drill-down reuses the existing `/ticker/<sym>` route.

## Architecture

### Drill-down (reuse, don't rebuild)

`store.setSelected(sym)` already:
- sets `selected`, clears `hover`/`compare`,
- switches `view` to `dashboard`,
- navigates to `/ticker/<encoded sym>`.

So tile click = `onTileClick={(sym) => setSelected(sym)}`. The Dashboard's
existing effect loads history, fundamentals, and a fresh quote for the new
symbol. Nothing else to build for the detail experience.

### `Treemap` component changes (`charts/Treemap.tsx`)

The component is shared by the Crypto map, so changes must be additive and
opt-in:

- **Hover tooltip.** Add an optional `tipFor?: (sym: string) => string` (or a
  richer `renderTip`) prop. Track hovered tile in local state; render an
  absolutely-positioned tooltip following the cursor. When `tipFor` is omitted
  (crypto's current call), behavior is unchanged.
- **Hover highlight.** On the hovered tile, draw a 1.5px light stroke
  (`rgba(255,255,255,.5)`) so the active tile reads as selectable. Pure visual,
  no prop needed.
- Keep the existing `onTileClick` + pointer-cursor logic.

Tooltip is rendered by the Treemap as an SVG/HTML overlay inside a wrapping
`<div style={{position:'relative'}}>`, so callers don't have to manage it.

### Market picker (`views/MarketViews.tsx`)

Replace the static `All sectors` header row in the `map` sub-view with picker
state and controls:

```
type Universe = 'stocks' | 'crypto'
const [universe, setUniverse] = useState<Universe>('stocks')
const [sector, setSector] = useState<string>('All')   // 'All' | HM key
```

Layout above the treemap:

```
[ Stocks | Crypto ]   ← universe toggle (segmented, like existing sub-tabs)
[ All · Technology · Healthcare · Financial · … ]  ← scrollable sector chips
                                          (rendered only when universe==='stocks')
[ −3% ▭▭▭ +3% legend ]  ← existing legend, kept
```

- Sector chips: `['All', ...Object.keys(HM)]`. Reuse the existing `subStyle`
  active/inactive button styling. Container is `overflow-x: auto` with
  `flex-wrap: nowrap` so it scrolls horizontally on narrow screens.
- `mapItems` becomes derived:
  - `universe === 'crypto'` → render the existing crypto treemap items (lift the
    crypto map's item-building, or for v1 simply route the user: see below).
  - `universe === 'stocks' && sector === 'All'` → current behavior
    (`Object.values(HM).flat()`).
  - `universe === 'stocks' && sector !== 'All'` →
    `HM[sector].map(([sym, cap]) => ({ sym, value: cap, chg: hmChange(sym) }))`.

**Crypto universe — v1 scope decision.** The crypto treemap already lives in the
Crypto view with its own data loading. Two options for the `Crypto` tab here:
1. **Lift** the crypto item-building into a shared helper and render it inline in
   the map (true unified map). Preferred if the crypto data hook is cheap to reuse.
2. **Defer to v1.1:** the `Crypto` tab is present but, on select, routes to the
   existing Crypto map view (`setView('crypto')`-equivalent). Honest, zero data
   risk, ship faster.

Decide during planning based on how coupled the crypto data loading is. Default
to option 1 if the crypto items are derivable from store state already loaded.

### Tooltip data source

For stocks, `tipFor(sym)` pulls display name from `UNIVERSE[sym]?.name` (falls
back to the symbol), market cap from the HM tuple, % change from `hmChange(sym)`,
and live price from `store.price(sym)` when available. Keep it a pure string for
v1 (`AAPL · Apple · $214.10 · +0.8% · $3.28T`); upgrade to a styled card later
if needed.

## Error / edge handling

- Empty sector (shouldn't happen — every HM key has tickers) → render nothing
  gracefully (squarify already guards divide-by-zero).
- Tooltip near right/bottom edge → clamp position so it stays in the map box.
- Tooltip is `pointer-events: none` so it never intercepts the tile click.
- Mobile: tap = click (drill-down). Tooltip on touch is non-essential; hover
  simply won't fire — acceptable.

## Testing

- **Treemap unit:** `onTileClick` fires with the right symbol; hovered tile gets
  the highlight stroke; tooltip text renders from `tipFor`; with no `tipFor`/
  `onTileClick` the crypto call path is unchanged (snapshot/behavior).
- **MarketViews:** selecting a sector chip changes the rendered tile set
  (Technology shows AAPL/MSFT/NVDA, not XOM); universe toggle switches datasets;
  clicking a tile calls `setSelected` (mock store) and the dashboard route.
- **E2E (e2e-engineer, after merge):** navigate to `/map`, click a sector chip,
  click a tile, assert URL is `/ticker/<SYM>` and the Dashboard renders. Market
  data mocked at the network boundary per project rule.

## Rollout

- Branch in an isolated git worktree (repo has heavy concurrent branch churn —
  always isolate). Small modular commits: (1) Treemap hover/tooltip, (2) market
  picker state + sector chips, (3) wire drill-down + crypto tab, (4) tests.
- Update CHANGELOG; roll a minor version (new user-facing feature).
