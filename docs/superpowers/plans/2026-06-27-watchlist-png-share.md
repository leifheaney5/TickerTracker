# Watchlist PNG Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Manage Watchlist "Share" button generate a clean branded PNG of the user's watchlist and either open the native share sheet or download the file, instead of copying a link.

**Architecture:** Build a presentational `ShareCard` JSX component with fixed (theme-independent) colors, render it off-screen in `ManageWatchlist`, rasterize that DOM node with `html-to-image`, then share-or-download the resulting PNG blob. The existing `/s/:token` link backend is left intact but no longer wired to the button.

**Tech Stack:** React + TypeScript (Vite), Zustand store, Vitest + jsdom + @testing-library/react, `html-to-image` for DOM→PNG.

## Global Constraints

- All work is under `frontend/`. Run commands from `frontend/`.
- Test runner: `npm test` (Vitest, jsdom). Single file: `npm test -- src/path/file.test.ts`.
- Styling convention: inline `style={{…}}` objects (no CSS modules).
- The ShareCard MUST use fixed explicit hex/rgb colors, NOT `var(--…)` tokens — the PNG must look identical regardless of the user's active theme.
- Fonts: `FONT_SANS` and `FONT_MONO` from `src/theme/tokens.ts`.
- Formatting helpers: `money(v)` and `pct(v)` from `src/lib/format.ts` (`pct` already prefixes `+`/`-` and appends `%`).
- `WatchlistItem` type (`src/api/types.ts:84`): `{ symbol, position, target, alert_price, alert_dir, alert_active }`.
- Store selectors (`src/state/store.ts`): `price: (sym: string) => number`, `chg: (sym: string) => number`.
- `UNIVERSE[sym]?.name` gives the company name (`src/data/universe.ts`).
- `Logo` component: `<Logo symbol={string} size={number} />` (`src/components/Logo.tsx`).
- Do NOT add `Co-Authored-By` trailers to commits (user global rule).

---

### Task 1: Add the html-to-image dependency

**Files:**
- Modify: `frontend/package.json` (dependencies), `frontend/package-lock.json`

**Interfaces:**
- Consumes: nothing.
- Produces: the `html-to-image` module, exposing `toBlob(node: HTMLElement, options?: { pixelRatio?: number; backgroundColor?: string }): Promise<Blob | null>`.

- [ ] **Step 1: Install the dependency**

Run from `frontend/`:

```bash
npm install html-to-image@^1.11.13
```

- [ ] **Step 2: Verify it resolves**

Run from `frontend/`:

```bash
node -e "require('html-to-image'); console.log('ok')"
```

Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "build(deps): add html-to-image for PNG export"
```

---

### Task 2: Build the ShareCard presentational component

**Files:**
- Create: `frontend/src/components/ShareCard.tsx`
- Test: `frontend/src/components/ShareCard.test.tsx`

**Interfaces:**
- Consumes: `WatchlistItem` (`src/api/types.ts`), `money`/`pct` (`src/lib/format.ts`), `UNIVERSE` (`src/data/universe.ts`), `Logo` (`src/components/Logo.tsx`), `FONT_SANS`/`FONT_MONO` (`src/theme/tokens.ts`).
- Produces: `export function ShareCard(props: ShareCardProps)` where
  `ShareCardProps = { items: WatchlistItem[]; price: (sym: string) => number; chg: (sym: string) => number; date?: Date }`.
  Renders a fixed-width (640px) branded card with deterministic colors.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/ShareCard.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ShareCard } from './ShareCard'
import type { WatchlistItem } from '../api/types'

const item = (symbol: string): WatchlistItem => ({
  symbol, position: 0, target: 0, alert_price: 0, alert_dir: 'above', alert_active: false,
})

describe('ShareCard', () => {
  const items = [item('NVDA'), item('AAPL')]
  const price = (s: string) => (s === 'NVDA' ? 124.3 : 201.1)
  const chg = (s: string) => (s === 'NVDA' ? 2.1 : -0.4)

  it('renders one row per ticker with formatted price and signed change', () => {
    render(<ShareCard items={items} price={price} chg={chg} date={new Date('2026-06-27T12:00:00Z')} />)
    expect(screen.getByText('NVDA')).toBeTruthy()
    expect(screen.getByText('AAPL')).toBeTruthy()
    expect(screen.getByText('$124.30')).toBeTruthy()
    expect(screen.getByText('+2.10%')).toBeTruthy()
    expect(screen.getByText('-0.40%')).toBeTruthy()
  })

  it('shows the ticker count in the footer', () => {
    render(<ShareCard items={items} price={price} chg={chg} />)
    expect(screen.getByText(/2 tickers/)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from `frontend/`: `npm test -- src/components/ShareCard.test.tsx`
Expected: FAIL — cannot resolve `./ShareCard`.

- [ ] **Step 3: Write the component**

Create `frontend/src/components/ShareCard.tsx`:

```tsx
import type { WatchlistItem } from '../api/types'
import { UNIVERSE } from '../data/universe'
import { Logo } from './Logo'
import { money, pct } from '../lib/format'
import { FONT_SANS, FONT_MONO } from '../theme/tokens'

// Fixed palette — the shared PNG must look identical regardless of the user's
// active light/dark theme, so we do NOT use var(--…) tokens here.
const C = {
  bg: '#0b0e14',
  card: '#11151d',
  line: '#1f2630',
  tx: '#e8edf4',
  tx2: '#9aa6b6',
  tx3: '#6b7686',
  up: '#2ecc71',
  down: '#ff5e6c',
  accent: '#4f8cff',
}

export type ShareCardProps = {
  items: WatchlistItem[]
  price: (sym: string) => number
  chg: (sym: string) => number
  date?: Date
}

export function ShareCard({ items, price, chg, date = new Date() }: ShareCardProps) {
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return (
    <div style={{ width: 640, background: C.bg, padding: 28, fontFamily: FONT_SANS, color: C.tx, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 16 }}>T</div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-.02em' }}>Ticker Tracker</span>
          <span style={{ fontSize: 12, color: C.tx2 }}>My Watchlist · {dateStr}</span>
        </div>
      </div>

      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, overflow: 'hidden' }}>
        {items.map((w, i) => {
          const c = chg(w.symbol)
          const up = c >= 0
          const name = UNIVERSE[w.symbol]?.name ?? w.symbol
          return (
            <div key={w.symbol} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 90px', alignItems: 'center', padding: '12px 16px', borderTop: i === 0 ? 'none' : `1px solid ${C.line}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                <Logo symbol={w.symbol} size={28} />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{w.symbol}</span>
                  <span style={{ fontSize: 11, color: C.tx3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                </div>
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 13, textAlign: 'right', color: C.tx }}>{money(price(w.symbol))}</div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, fontWeight: 600, textAlign: 'right', color: up ? C.up : C.down }}>{pct(c)}</div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: C.tx3, textAlign: 'center' }}>
        {items.length} ticker{items.length === 1 ? '' : 's'} · tickertracker.info
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `frontend/`: `npm test -- src/components/ShareCard.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ShareCard.tsx frontend/src/components/ShareCard.test.tsx
git commit -m "feat(share): add ShareCard component for watchlist image"
```

---

### Task 3: Build the shareImage helper

**Files:**
- Create: `frontend/src/lib/shareImage.ts`
- Test: `frontend/src/lib/shareImage.test.ts`

**Interfaces:**
- Consumes: `toBlob` from `html-to-image` (Task 1).
- Produces: `export async function shareImage(node: HTMLElement, filename: string): Promise<void>`.
  Rasterizes `node` to a PNG blob (`pixelRatio: 2`). If `navigator.canShare` reports the
  file is shareable, calls `navigator.share({ files, title })`; otherwise downloads via an
  anchor. A user-cancelled share (`AbortError`) resolves silently; rasterization failure
  rejects.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/shareImage.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock html-to-image so no real canvas is needed.
const toBlob = vi.fn()
vi.mock('html-to-image', () => ({ toBlob: (...a: unknown[]) => toBlob(...a) }))

import { shareImage } from './shareImage'

const node = document.createElement('div')
const pngBlob = new Blob(['x'], { type: 'image/png' })

beforeEach(() => {
  toBlob.mockReset().mockResolvedValue(pngBlob)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('shareImage', () => {
  it('uses the native share sheet when files are shareable', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    const canShare = vi.fn().mockReturnValue(true)
    vi.stubGlobal('navigator', { canShare, share })

    await shareImage(node, 'my-watchlist.png')

    expect(share).toHaveBeenCalledTimes(1)
    const arg = share.mock.calls[0][0]
    expect(arg.files[0].name).toBe('my-watchlist.png')
  })

  it('falls back to downloading when sharing is unavailable', async () => {
    vi.stubGlobal('navigator', {}) // no canShare/share
    const createURL = vi.fn().mockReturnValue('blob:fake')
    const revokeURL = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: createURL, revokeObjectURL: revokeURL })
    const click = vi.fn()
    const realCreate = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = realCreate(tag)
      if (tag === 'a') el.click = click
      return el
    })

    await shareImage(node, 'my-watchlist.png')

    expect(createURL).toHaveBeenCalledWith(pngBlob)
    expect(click).toHaveBeenCalledTimes(1)
    expect(revokeURL).toHaveBeenCalledWith('blob:fake')
  })

  it('swallows a user-cancelled share (AbortError)', async () => {
    const err = new DOMException('cancelled', 'AbortError')
    const share = vi.fn().mockRejectedValue(err)
    vi.stubGlobal('navigator', { canShare: () => true, share })

    await expect(shareImage(node, 'my-watchlist.png')).resolves.toBeUndefined()
  })

  it('rejects when rasterization yields no blob', async () => {
    toBlob.mockResolvedValue(null)
    vi.stubGlobal('navigator', {})
    await expect(shareImage(node, 'my-watchlist.png')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run from `frontend/`: `npm test -- src/lib/shareImage.test.ts`
Expected: FAIL — cannot resolve `./shareImage`.

- [ ] **Step 3: Write the helper**

Create `frontend/src/lib/shareImage.ts`:

```ts
import { toBlob } from 'html-to-image'

// Rasterize a DOM node to a PNG and either open the OS share sheet (when the
// browser can share files) or download the file. A user-cancelled share is a
// silent no-op; a failed render rejects.
export async function shareImage(node: HTMLElement, filename: string): Promise<void> {
  const blob = await toBlob(node, { pixelRatio: 2 })
  if (!blob) throw new Error('Failed to render image')

  const file = new File([blob], filename, { type: 'image/png' })

  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
  if (typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'My Watchlist' })
    } catch (err) {
      // User dismissed the share sheet — not an error.
      if ((err as DOMException)?.name === 'AbortError') return
      throw err
    }
    return
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `frontend/`: `npm test -- src/lib/shareImage.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/shareImage.ts frontend/src/lib/shareImage.test.ts
git commit -m "feat(share): add shareImage helper (native share or download)"
```

---

### Task 4: Wire the Share button to image export

**Files:**
- Modify: `frontend/src/views/ManageWatchlist.tsx`

**Interfaces:**
- Consumes: `ShareCard` (Task 2), `shareImage` (Task 3).
- Produces: updated `handleShare` and an off-screen `ShareCard` render. Removes use of
  `api.createShare()` from this view.

- [ ] **Step 1: Add imports**

In `frontend/src/views/ManageWatchlist.tsx`, after the existing imports (the `import { api } from '../api/client'` line at the top), add:

```tsx
import { ShareCard } from '../components/ShareCard'
import { shareImage } from '../lib/shareImage'
```

Note: `useRef` is already imported on line 1 (`import { useState, useRef } from 'react'`). The `api` import may remain even though `createShare` is no longer used here.

- [ ] **Step 2: Replace the share label state**

Replace this line (currently `ManageWatchlist.tsx:31`):

```tsx
  const [shareLabel, setShareLabel] = useState<'Share' | 'Copying…' | 'Copied!'>('Share')
```

with:

```tsx
  const [shareLabel, setShareLabel] = useState<'Share' | 'Rendering…' | 'Done!'>('Share')
  const shareCardRef = useRef<HTMLDivElement>(null)
```

- [ ] **Step 3: Replace handleShare**

Replace the whole `handleShare` function (currently `ManageWatchlist.tsx:34-45`):

```tsx
  const handleShare = async () => {
    setShareLabel('Copying…')
    try {
      const res = await api.createShare()
      const url = `${location.origin}/s/${res.data.token}`
      await navigator.clipboard.writeText(url)
      setShareLabel('Copied!')
      setTimeout(() => setShareLabel('Share'), 2500)
    } catch {
      setShareLabel('Share')
    }
  }
```

with:

```tsx
  const handleShare = async () => {
    if (!shareCardRef.current) return
    setShareLabel('Rendering…')
    try {
      await shareImage(shareCardRef.current, 'my-watchlist.png')
      setShareLabel('Done!')
      setTimeout(() => setShareLabel('Share'), 2500)
    } catch {
      setShareLabel('Share')
    }
  }
```

- [ ] **Step 4: Update the button to the new label states**

In the Share `<button>` (currently `ManageWatchlist.tsx:98-110`), update the three places that reference the old labels:

- `disabled={shareLabel === 'Copying…'}` → `disabled={shareLabel === 'Rendering…'}`
- `background: shareLabel === 'Copied!' ? 'var(--up)' : 'var(--card)',` → `background: shareLabel === 'Done!' ? 'var(--up)' : 'var(--card)',`
- `color: shareLabel === 'Copied!' ? 'var(--accentInk)' : 'var(--tx2)',` → `color: shareLabel === 'Done!' ? 'var(--accentInk)' : 'var(--tx2)',`
- Button text `{shareLabel === 'Copied!' ? '✓ Copied!' : shareLabel}` → `{shareLabel === 'Done!' ? '✓ Done!' : shareLabel}`

- [ ] **Step 5: Render the off-screen ShareCard**

Inside the outermost wrapper `<div style={{ flex: 1, overflow: 'auto', … }}>` (the one opened at `ManageWatchlist.tsx:91`), add the off-screen card as the first child, immediately before `<div style={{ maxWidth: 860, … }}>`:

```tsx
      {/* Off-screen render target for the share PNG (never visible to the user). */}
      <div ref={shareCardRef} style={{ position: 'absolute', left: -99999, top: 0, pointerEvents: 'none' }} aria-hidden>
        <ShareCard items={items} price={price} chg={chg} />
      </div>
```

Note: `items`, `price`, and `chg` are already in scope in this component.

- [ ] **Step 6: Typecheck and run the full test suite**

Run from `frontend/`:

```bash
npm run build && npm test
```

Expected: build succeeds (no TS errors) and all tests pass, including the new `ShareCard` and `shareImage` suites.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/views/ManageWatchlist.tsx
git commit -m "feat(share): export watchlist as PNG instead of copying a link"
```

---

## Self-Review

**Spec coverage:**
- Clean purpose-built card → Task 2 (`ShareCard`, fixed colors, header/rows/footer). ✓
- Smart delivery (native share else download) → Task 3 (`shareImage`). ✓
- Image-only, link backend left dormant → Task 4 removes `createShare` wiring only; `/s/:token` and `SharedWatchlist` untouched. ✓
- Testing (mock toBlob; ShareCard rows + price/%; share-vs-download decision; cancel) → Tasks 2 & 3. ✓
- `pixelRatio: 2` retina output → Task 3 Step 3. ✓
- Fixed colors not theme tokens → Task 2 Global Constraint + `C` palette. ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete; exact paths and commands present.

**Type consistency:** `shareImage(node, filename)` signature identical across Task 3 definition and Task 4 call site. `ShareCardProps` (`items`/`price`/`chg`/`date?`) matches the Task 4 usage `<ShareCard items={items} price={price} chg={chg} />`. Label union `'Share' | 'Rendering…' | 'Done!'` is consistent across Steps 2–4 of Task 4.
