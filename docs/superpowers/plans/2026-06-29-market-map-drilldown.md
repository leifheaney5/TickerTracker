# Market Map drill-down & market picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Market Map interactive — click a stock tile to drill into its ticker page, hover any tile for a tooltip, and use a Stocks/Crypto universe toggle plus scrollable sector chips to focus the map on one market at a time.

**Architecture:** Extend the shared `Treemap` SVG component with an opt-in hover tooltip + highlight (additive props so the Crypto view is unaffected). Add universe/sector picker state to `MarketViews` and derive the treemap items from it. Drill-down reuses the existing `store.setSelected(sym)` which already routes to `/ticker/<sym>` and opens the Dashboard.

**Tech Stack:** React 18 + TypeScript + Vite, Zustand store, Vitest + React Testing Library, inline-style design tokens.

## Global Constraints

- No backend changes — stock map uses existing synthetic `HM` (`frontend/src/data/market.ts`); crypto uses already-loaded `store.crypto`.
- No fabricated index membership — universe picker is only `Stocks` (HM) and `Crypto` (CoinGecko). No S&P/Nasdaq/Dow tags.
- `Treemap` is shared with `frontend/src/views/Crypto.tsx` — all changes must be additive/opt-in; the existing `<Treemap items width height />` call must render identically.
- Crypto tiles are NOT clickable (no `/ticker` route for coins); only stock tiles drill down.
- Follow existing inline-style + design-token conventions (`var(--card)`, `FONT_SANS`, `FONT_MONO`, etc.). No CSS files.
- Small modular commits; update `CHANGELOG.md`; roll a minor version.

---

### Task 1: Treemap hover tooltip + highlight (opt-in)

**Files:**
- Modify: `frontend/src/charts/Treemap.tsx`
- Test: `frontend/src/charts/__tests__/Treemap.test.tsx` (create)

**Interfaces:**
- Consumes: existing `TreemapItem { sym; value; chg }`, `squarify`, `heatColor`.
- Produces: extended `TreemapProps` with optional `tipFor?: (sym: string) => string`. When provided, hovering a tile shows a tooltip with that string and outlines the hovered tile. `onTileClick` and the no-prop call path stay unchanged.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/charts/__tests__/Treemap.test.tsx
import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Treemap } from '../Treemap'

const items = [
  { sym: 'AAPL', value: 100, chg: 1.2 },
  { sym: 'MSFT', value: 80, chg: -0.5 },
]

describe('Treemap', () => {
  it('fires onTileClick with the tile symbol', () => {
    const onTileClick = vi.fn()
    const { getByText } = render(<Treemap items={items} width={400} height={300} onTileClick={onTileClick} />)
    fireEvent.click(getByText('AAPL'))
    expect(onTileClick).toHaveBeenCalledWith('AAPL')
  })

  it('shows a tooltip from tipFor on hover and hides on leave', () => {
    const tipFor = (s: string) => `${s} tooltip`
    const { getByText, queryByText, container } = render(
      <Treemap items={items} width={400} height={300} tipFor={tipFor} />,
    )
    expect(queryByText('AAPL tooltip')).toBeNull()
    const tile = getByText('AAPL').closest('g') as SVGGElement
    fireEvent.mouseEnter(tile)
    expect(getByText('AAPL tooltip')).toBeTruthy()
    fireEvent.mouseLeave(container.querySelector('svg') as SVGSVGElement)
    expect(queryByText('AAPL tooltip')).toBeNull()
  })

  it('renders no tooltip when tipFor is omitted (crypto path)', () => {
    const { getByText, container } = render(<Treemap items={items} width={400} height={300} />)
    const tile = getByText('AAPL').closest('g') as SVGGElement
    fireEvent.mouseEnter(tile)
    // No tooltip div is rendered at all.
    expect(container.querySelectorAll('[data-treemap-tip]').length).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/charts/__tests__/Treemap.test.tsx`
Expected: FAIL — tooltip assertions fail (no hover behavior / no `tipFor` support yet).

- [ ] **Step 3: Implement the tooltip + highlight**

Replace the `Treemap` function (and `TreemapProps`) in `frontend/src/charts/Treemap.tsx` with:

```tsx
interface TreemapProps {
  items: TreemapItem[]
  width: number
  height: number
  onTileClick?: (sym: string) => void
  tipFor?: (sym: string) => string
}

export function Treemap({ items, width, height, onTileClick, tipFor }: TreemapProps) {
  const tiles = squarify(items, 1, 1, width - 2, height - 2)
  const [tip, setTip] = useState<{ sym: string; x: number; y: number } | null>(null)
  return (
    <div style={{ position: 'relative', width, height }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ display: 'block' }}
        onMouseLeave={() => setTip(null)}
      >
        {tiles.map((t) => {
          const showLabel = t.w > 34 && t.h > 22
          const active = tip?.sym === t.sym
          return (
            <g
              key={t.sym}
              onClick={() => onTileClick?.(t.sym)}
              onMouseEnter={tipFor ? () => setTip({ sym: t.sym, x: t.x + t.w / 2, y: t.y }) : undefined}
              style={{ cursor: onTileClick ? 'pointer' : 'default' }}
            >
              <rect
                x={t.x}
                y={t.y}
                width={Math.max(0, t.w - 1)}
                height={Math.max(0, t.h - 1)}
                fill={heatColor(t.chg)}
                stroke={active ? 'rgba(255,255,255,.55)' : 'none'}
                strokeWidth={active ? 1.5 : 0}
              />
              {showLabel && (
                <>
                  <text x={t.x + t.w / 2} y={t.y + t.h / 2 - 2} fill="#fff" fontSize={Math.min(13, t.w / 4)} fontWeight={700} fontFamily={FONT_SANS} textAnchor="middle">{t.sym}</text>
                  <text x={t.x + t.w / 2} y={t.y + t.h / 2 + 12} fill="rgba(255,255,255,.85)" fontSize={Math.min(11, t.w / 5)} fontFamily="'JetBrains Mono',monospace" textAnchor="middle">{(t.chg >= 0 ? '+' : '') + t.chg.toFixed(1) + '%'}</text>
                </>
              )}
            </g>
          )
        })}
      </svg>
      {tip && tipFor && (
        <div
          data-treemap-tip
          style={{
            position: 'absolute',
            left: Math.min(Math.max(tip.x, 4), width - 4),
            top: tip.y,
            transform: `translate(-50%, calc(-100% - 6px))`,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            background: 'var(--panel,#1a1d24)',
            color: 'var(--tx,#fff)',
            border: '1px solid var(--line,#2a2e36)',
            borderRadius: 8,
            padding: '6px 9px',
            fontSize: 11.5,
            fontFamily: FONT_SANS,
            boxShadow: '0 6px 20px rgba(0,0,0,.4)',
            zIndex: 5,
          }}
        >
          {tipFor(tip.sym)}
        </div>
      )}
    </div>
  )
}
```

Add the React import at the top of the file:

```tsx
import { useState } from 'react'
import { FONT_SANS } from '../theme/tokens'
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/charts/__tests__/Treemap.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify the Crypto view still renders unchanged**

Run: `cd frontend && npx vitest run` (full suite — Crypto-related tests stay green).
Expected: PASS, no regressions.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/charts/Treemap.tsx frontend/src/charts/__tests__/Treemap.test.tsx
git commit -m "feat(treemap): opt-in hover tooltip + active-tile highlight"
```

---

### Task 2: Market picker state + sector chips + drill-down wiring

**Files:**
- Modify: `frontend/src/views/MarketViews.tsx`
- Test: `frontend/src/views/__tests__/MarketViews.test.tsx` (create)

**Interfaces:**
- Consumes: `Treemap` (with `onTileClick`, `tipFor` from Task 1), `HM` and `hmChange` from `../data/market`, `UNIVERSE` from `../data/universe`, store `setSelected`, `crypto`, `loadCrypto`, `price`.
- Produces: the `map` sub-view renders a `Stocks | Crypto` universe toggle, a scrollable sector-chip row (Stocks only), and a treemap whose items derive from `(universe, sector)`. Stock tiles call `setSelected`; crypto tiles do not.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/views/__tests__/MarketViews.test.tsx
import { render, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MarketViews } from '../MarketViews'
import { useStore } from '../../state/store'

beforeEach(() => {
  useStore.setState({ crypto: null })
})

describe('MarketViews · map', () => {
  it('filters tiles to a sector when its chip is selected', () => {
    const { getByText, queryByText } = render(<MarketViews sub="map" />)
    // 'All sectors' default shows an Energy name (XOM) and a Tech name (AAPL).
    expect(getByText('AAPL')).toBeTruthy()
    fireEvent.click(getByText('Technology'))
    expect(getByText('AAPL')).toBeTruthy()      // tech ticker still present
    expect(queryByText('XOM')).toBeNull()        // energy ticker filtered out
  })

  it('clicking a stock tile selects that symbol', () => {
    const setSelected = vi.fn()
    useStore.setState({ setSelected })
    const { getByText } = render(<MarketViews sub="map" />)
    fireEvent.click(getByText('AAPL'))
    expect(setSelected).toHaveBeenCalledWith('AAPL')
  })

  it('switching to the Crypto universe hides the sector chips', () => {
    const { getByText, queryByText } = render(<MarketViews sub="map" />)
    expect(getByText('Technology')).toBeTruthy()
    fireEvent.click(getByText('Crypto'))
    expect(queryByText('Technology')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/views/__tests__/MarketViews.test.tsx`
Expected: FAIL — no `Technology` chip / no `Crypto` toggle / tiles inert.

- [ ] **Step 3: Add picker imports + state**

In `frontend/src/views/MarketViews.tsx`, update the imports to add `UNIVERSE` and the store selectors:

```tsx
import { UNIVERSE } from '../data/universe'
```

Add these selectors alongside the existing `useStore` calls inside `MarketViews`:

```tsx
const setSelected = useStore((s) => s.setSelected)
const crypto = useStore((s) => s.crypto)
const loadCrypto = useStore((s) => s.loadCrypto)
const price = useStore((s) => s.price)
```

Add picker state next to the existing `useState` hooks:

```tsx
type Universe = 'stocks' | 'crypto'
const [universe, setUniverse] = useState<Universe>('stocks')
const [sector, setSector] = useState<string>('All')
```

Load crypto lazily when the crypto universe is chosen — add an effect:

```tsx
useEffect(() => { if (universe === 'crypto' && crypto == null) loadCrypto() }, [universe, crypto, loadCrypto])
```

- [ ] **Step 4: Derive items + tooltip, replace the map sub-view body**

Replace the `mapItems` definition (currently `const mapItems: TreemapItem[] = Object.values(HM).flat()...`) with derived helpers:

```tsx
const SECTOR_KEYS = ['All', ...Object.keys(HM)]

const stockItems = (sec: string): TreemapItem[] => {
  const rows = sec === 'All' ? Object.values(HM).flat() : (HM[sec] || [])
  return rows.map(([sym, cap]) => ({ sym, value: cap, chg: hmChange(sym) }))
}
const cryptoItems: TreemapItem[] = (crypto?.coins || []).map((c) => ({ sym: c.symbol, value: c.market_cap || 1, chg: c.change_pct }))
const mapItems = universe === 'stocks' ? stockItems(sector) : cryptoItems

const stockTip = (sym: string) => {
  const name = UNIVERSE[sym]?.name || sym
  const p = price(sym)
  const chg = hmChange(sym)
  const priceStr = p ? ` · $${p.toFixed(2)}` : ''
  return `${sym} · ${name}${priceStr} · ${(chg >= 0 ? '+' : '') + chg.toFixed(1)}%`
}
const cryptoTip = (sym: string) => {
  const c = crypto?.coins.find((x) => x.symbol === sym)
  if (!c) return sym
  return `${sym} · ${c.name} · $${c.price.toLocaleString('en-US')} · ${(c.change_pct >= 0 ? '+' : '') + c.change_pct.toFixed(1)}%`
}
```

Now replace the `sub === 'map'` block's card contents. The new header row gets the universe toggle; below it, the scrollable sector chips (stocks only); the treemap gets `onTileClick`/`tipFor`:

```tsx
{sub === 'map' && (
  <>
    {header('Market Map', 'The whole market at a glance — sized by market cap, colored by daily move')}
    <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12, flex: '0 0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: 'var(--bg)' }}>
          <button onClick={() => setUniverse('stocks')} style={subStyle(universe === 'stocks')}>Stocks</button>
          <button onClick={() => setUniverse('crypto')} style={subStyle(universe === 'crypto')}>Crypto</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '10.5px', color: 'var(--tx3)', fontFamily: FONT_MONO }}>−3%</span>
          <div style={{ width: 124, height: 8, borderRadius: 4, background: 'linear-gradient(90deg,#d63a3a,#3a3e46,#22ac60)' }} />
          <span style={{ fontSize: '10.5px', color: 'var(--tx3)', fontFamily: FONT_MONO }}>+3%</span>
        </div>
      </div>
      {universe === 'stocks' && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 2 }}>
          {SECTOR_KEYS.map((s) => (
            <button key={s} onClick={() => setSector(s)} style={{ ...subStyle(s === sector), flex: '0 0 auto', whiteSpace: 'nowrap' }}>{s === 'All' ? 'All sectors' : s}</button>
          ))}
        </div>
      )}
      <div ref={mapRef} style={{ position: 'relative', width: '100%', height: 460, background: 'var(--bg)', borderRadius: 6, overflow: 'hidden' }}>
        {mapItems.length > 0 ? (
          <Treemap
            items={mapItems}
            width={mapW}
            height={460}
            onTileClick={universe === 'stocks' ? (sym) => setSelected(sym) : undefined}
            tipFor={universe === 'stocks' ? stockTip : cryptoTip}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--tx3)', fontSize: '13px' }}>
            {universe === 'crypto' && crypto == null ? 'Loading…' : 'No data available.'}
          </div>
        )}
      </div>
      <span style={{ fontSize: '11px', color: 'var(--tx3)' }}>Tile size = market cap · color = daily change{universe === 'stocks' ? ' · click a tile to open it' : ''}</span>
    </div>
  </>
)}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd frontend && npx vitest run src/views/__tests__/MarketViews.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Typecheck + full suite**

Run: `cd frontend && npx tsc --noEmit && npx vitest run`
Expected: no type errors; full suite green.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/views/MarketViews.tsx frontend/src/views/__tests__/MarketViews.test.tsx
git commit -m "feat(market-map): Stocks/Crypto picker, sector chips, tile drill-down"
```

---

### Task 3: Changelog + version bump

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `frontend/src/version.ts` or `VERSION` (whichever the repo uses — match existing convention)

**Interfaces:**
- Consumes: nothing. Produces: a released minor version documenting the feature.

- [ ] **Step 1: Find the version source**

Run: `git log --oneline -5 -- CHANGELOG.md && cat CHANGELOG.md | head -20`
Identify current version and the file(s) that hold it (search for the current version string).

- [ ] **Step 2: Add a CHANGELOG entry**

Add a new top section under the latest, e.g.:

```markdown
## [1.17.0] - 2026-06-29
### Added
- Interactive Market Map: click any stock tile to open its ticker page, hover for a tooltip (name · price · % change), and use the new Stocks/Crypto universe toggle with scrollable sector chips to focus the map on one market at a time.
```

(Use the actual next minor version relative to what `CHANGELOG.md` currently shows.)

- [ ] **Step 3: Bump the version string**

Update the version constant/file to match the new version. Run the repo's existing check if any (e.g. `npx vitest run` if a test asserts the version).

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md frontend/src/version.ts VERSION 2>/dev/null
git commit -m "chore(release): v1.17.0 — interactive market map"
```

---

### Task 4: Browser verification

**Files:** none (manual/playwright verification).

- [ ] **Step 1: Build + run**

Run: `cd frontend && npm run build` (must succeed) then start the dev server / app per repo convention.

- [ ] **Step 2: Verify behaviors**

On `/map`:
- Hovering a tile shows the tooltip and outlines the tile.
- Clicking a stock tile navigates to `/ticker/<SYM>` and opens the Dashboard for it.
- The sector chips scroll horizontally; picking `Technology` redraws to only tech tickers (larger/legible); `All sectors` restores the full map.
- The `Crypto` toggle hides the sector chips and renders the crypto map (tooltips, no drill-down).

- [ ] **Step 3: Note results** in the PR description (screenshots optional).
