# Mobile Responsiveness Report

## Approach

**Hook:** `frontend/src/hooks/useIsMobile.ts` — uses `window.matchMedia('(max-width: 768px)')` with event-listener reactivity. Components branch on this boolean to switch between mobile and desktop layouts. No CSS framework introduced; all styles remain inline `style={{...}}` objects matching the existing pattern.

**Global CSS (index.css):** Added `overflow-x: hidden` to `html`, `body`, and `#root` to prevent full-page horizontal scroll on any view. This is the minimal global CSS addition.

**Tokens (tokens.ts):** `rootCssVars()` now accepts an `isMobile` boolean to tighten `--mpad` (12px 12px vs 22px 26px), `--gap`, and `--lgap` on small screens. App.tsx passes `isMobile` to this.

---

## Changes Per View / Component

### Header.tsx
- **Mobile:** Replaces 3-column grid with a flex row: logo mark + hamburger/dropdown button (shows active view name) + search icon + avatar/sign-in.
- The hamburger opens a full-width dropdown overlay listing all 6 nav items, with an active indicator bar and a "Connect account" / "Portfolio" link at the bottom.
- Search popover on mobile uses `position: fixed` spanning full width instead of a 332px absolute popup.
- Desktop header unchanged.

### Dashboard.tsx
- **Mobile:** Vertical stack: collapsible watchlist toggle bar (▲/▼) → optional watchlist panel (max 40vh, scrollable) → full-width main content column.
- Watchlist starts collapsed so the chart/stock content is immediately visible.
- Main column padding reduced to 12px 12px.
- Desktop (sidebar + main) unchanged.

### Watchlist.tsx
- `aside` style branches on `isMobile`: on mobile uses `width: 100%` with no right border (the Dashboard collapse wrapper provides the separation). On desktop the 336px sidebar is unchanged.

### Strategy.tsx (Active Positions table)
- Wrapped positions list in `overflowX: 'auto'` + `minWidth: 580` inner div. Previously had no overflow wrapper; the grid would push past viewport on mobile.

### MarketViews.tsx (Sector bars)
- Sector name labels changed from fixed `width: 148px` to `width: clamp(80px, 30%, 148px)` so they shrink on narrow screens while still taking reasonable space on desktop.

### AtAGlance.tsx
- Already had `overflowX: 'auto'` wrappers around tables with `minWidth: 1180` / `minWidth: 980`. No change needed — inner-container horizontal scroll works correctly.

### Crypto.tsx
- Already had `overflowX: 'auto'` + `minWidth: 640`. No change needed.

### Holdings.tsx
- Already had `overflowX: 'auto'` + `minWidth: 640`. Summary cards use `flexWrap: 'wrap'`. No change needed.

### Screener.tsx
- Already had `overflowX: 'auto'` + `minWidth: 820`. No change needed.

### Settings.tsx, Alerts.tsx
- Use `maxWidth` containers with `flexWrap: 'wrap'` — naturally responsive. No change needed.

### ChartControls.tsx, MoversRibbon.tsx, StockHeader.tsx, DueDiligence.tsx, KeyStats.tsx
- All already use `flexWrap: 'wrap'` and/or flex-based reflow. Unchanged.

### StockChart.tsx (and other charts)
- Already use ResizeObserver — untouched.

---

## Build & Test Results

- `npm run build` (tsc + vite): **PASS** — 56 modules, no TypeScript errors.
- `npm run test` (vitest): **PASS** — 8/8 tests.

---

## Known Limitations / Not Fully Handled

- **AtAGlance / Screener / Crypto / Holdings tables on mobile:** Handled via inner horizontal scroll (standard pattern). Users swipe horizontally within the table container. A richer card-stacked layout per row was considered but would require significant restructuring and risk desktop regression.
- **Strategy equity curve:** The chart already uses ResizeObserver. On mobile the `flex: '2 1 460px'` chart card wraps below the risk sidebar, which may feel tall but is functional.
- **No Playwright screenshot testing** was performed (browser not available in this environment), but overflow analysis was done by inspection: no component sets a fixed width wider than its container without an `overflowX: 'auto'` ancestor.
