# HF-Engineer Platform Deepscan — 2026-06-30

Read-only human-factors deepscan of Ticker Tracker (tickertracker.info) by the
`hf-engineer` subagent. Findings grounded in code (`file:line`). This is the
durable backlog; tick items as they ship.

**Legend** — Priority: P0 (correctness/data-integrity) · P1 (high user value) · P2 (polish) · P3 (nice-to-have). Effort: S/M/L.

---

## Status snapshot

| ID | Finding | Priority | Status |
|----|---------|----------|--------|
| F1 | Deep Dive fabricated fundamentals | P0 | ✅ Shipped (PR #14, v1.18.1) |
| F2 | Alert direction (above/below) no UI | P0 | ✅ Shipped (PR #14, v1.18.1) |
| F3 | Strategy KPI cards hardcoded fiction | P1 | ✅ Content fixed (PR #14, v1.18.2) — view stays parked |
| F5 | Market Overview index/sector seed data | P1 | ✅ Shipped (PR #14, v1.18.2) |
| F4 | No price freshness / market-status on StockHeader | P1 | ✅ Shipped (PR #14, v1.18.3) — real backend market_status; +A7 aria-live |
| F13 | `quotesFetchedAt` is a single global timestamp | P2 | ✅ Shipped (PR #14, v1.18.3) — per-symbol fetchedAt stamp |
| F16 | Holdings "Synced from broker" has no timestamp | P2 | ✅ Shipped (PR #14, v1.18.3) — copy softened "synced from"→"via" (no sync-time source) |
| F6 | Mobile nav exposes only 4 of 9 views | P1 | ☐ Open |
| F7 | Alerts empty state has no CTA | P1 | ☐ Open |
| F8 | Alert price saves on blur (accidental triggers) | P1 | ☐ Open |
| F9 | Interactive `<div onClick>` w/o keyboard support | P2 | ☐ Open |
| F10 | Auth modal no focus trap | P2 | ☐ Open |
| F11 | Auth errors not announced (no role=alert) | P2 | ☐ Open |
| F12 | Desktop add-ticker input missing aria-label | P2 | ☐ Open |
| F14 | PulseDial returns null while loading (no skeleton) | P2 | ☐ Open |
| F15 | Screener sortable by 24H only | P2 | ☐ Open |
| F17 | News links open new tab w/o indication | P3 | ☐ Open |
| F18 | "Near target" indicator icon-only | P3 | ☐ Open |
| F19 | Pulse methodology buried in closed accordion | P3 | ☐ Open |
| F20 | Verification banner close button no aria-label | P3 | ☐ Open |

---

## Usability findings

| ID | Sev | Pri | Effort | File(s) | User problem | Proposed change |
|----|-----|-----|--------|---------|--------------|-----------------|
| F1 | Critical | P0 | M | `AtAGlance.tsx:188-198` | Deep Dive tab shows fabricated financial ratios | Disclose "illustrative" or replace with real data / hide until real source exists |
| F2 | Critical | P0 | L | `ManageWatchlist.tsx:196-217`, `Alerts.tsx` | Alert direction (above/below) in data model but never shown in UI | Display and allow editing `alert_dir` in the alert row |
| F3 | High | P1 | S | `Strategy.tsx:38-48` | KPI cards (Sharpe, Drawdown, Win Rate) hardcoded fiction below a live-price table | Disclose "Simulated"/"Demo", or dim+label clearly |
| F4 | High | P1 | M | `StockHeader.tsx`, `App.tsx:79` | Main price has no freshness timestamp; 60s poll invisible | Render `quotesFetchedAt` inline + show `marketStatus` pill |
| F5 | High | P1 | M | `MarketViews.tsx:98-122` | Index cards (SPX/NDX/DJI/RUT) + sector bars show static seed data as live | "Simulated data" banner, or remove index cards until real |
| F6 | High | P1 | M | `Header.tsx:13-18` | Mobile nav exposes only 4 of 9 views — Screener, Alerts, Holdings, Strategy invisible | Add Alerts + Screener to mobile hamburger |
| F7 | High | P1 | S | `Alerts.tsx:62` | Alerts empty state says "set a price target" but not how | Add CTA: "Open Manage Watchlist" or inline alert-creation |
| F8 | High | P1 | M | `ManageWatchlist.tsx:205` | Alert price saved on input `blur` — accidental trigger by clicking away | Explicit Save/confirm button; show current price vs threshold while editing |
| F9 | Medium | P2 | S | `Header.tsx:195-225`, `ChartControls.tsx:77-85`, `Watchlist.tsx:160-199` | Interactive elements are `<div onClick>` w/o role/tabIndex/keyboard | Convert to `<button>` or add `role="button" tabIndex={0} onKeyDown` |
| F10 | Medium | P2 | S | `AuthScreen.tsx` | Auth modal has no focus trap, no `role="dialog"`, no `aria-modal`/`aria-labelledby` | Add dialog roles + focus-trap hook |
| F11 | Medium | P2 | S | `AuthScreen.tsx:174,223` | Error messages plain `<span>` — not announced, not associated with inputs | `role="alert"`/`aria-live`; link via `aria-describedby` |
| F12 | Medium | P2 | S | `Watchlist.tsx:359-369` | Desktop add-ticker symbol input has no `aria-label` (mobile has one) | Add `aria-label="Ticker symbol"` (line 362) |
| F13 | Medium | P2 | M | `store.ts:471-490`, `KeyStats.tsx:44` | `quotesFetchedAt` is one global timestamp for all symbols; stale cached symbol gets wrong freshness | Track `fetchedAt` per symbol; show per-symbol staleness |
| F14 | Medium | P2 | S | `PulseDial.tsx:37` | Pulse dial returns `null` while loading — empty gap in StockHeader | Return a Skeleton at 56×56px |
| F15 | Medium | P2 | S | `Screener.tsx:92` | Rows sorted by 24H change only — no column sort | Column-header click sorting (mirror AtAGlance) |
| F16 | Medium | P2 | S | `Holdings.tsx:119` | "Synced from broker" with no timestamp | Show last sync time / "updated X min ago" |
| F17 | Low | P3 | S | `NewsCard.tsx:62` | External links open new tab with no indication | `aria-label="… (opens in new tab)"` |
| F18 | Low | P3 | S | `Watchlist.tsx:179` | "Near target" is a ◆ icon w/ tooltip only — no visible text | Add small text label / visible badge on small screens |
| F19 | Low | P3 | S | `PulseWhy.tsx:82-85` | Pulse methodology note correct but buried below closed accordion | Surface 1-line note above accordion (always visible) |
| F20 | Low | P3 | S | `App.tsx:113` | Verification banner `×` close button has no `aria-label` | Add `aria-label="Dismiss"` |

### Critical detail — F1 (fabricated ratios)
The "Fundamentals" sub-tab derived every column after P/E by ad-hoc arithmetic on `beta`/`dividend_yield`/`market_cap`:
```
market_cap / 1e11   → "P/S"
beta * 4            → "P/B"
pe / 20             → "PEG"
market_cap / 1e10   → "EBITDA"
dividend_yield + 1  → "FCF Yld"
beta * 12           → "ROIC"
40 + beta * 10      → "Gr. Margin"
beta                → "Net Debt/EBITDA"
```
NVDA showed "ROIC: 34.8%" = `beta * 12`. Highest-severity data-integrity issue. **Shipped fix:** all fabricated cells → `—`, P/E kept, disclosure footer added.

### Critical detail — F2 (alert direction)
`alert_dir: 'above' | 'below'` is in the model; `Alerts.tsx` reads it for "Rises to"/"Falls to", but ManageWatchlist (where alerts are set) had only a price input + ON/OFF toggle. Stop-loss/downside alerts were impossible. **Shipped fix:** accessible ↑Above/↓Below toggle wired to `updateListWatch`.

---

## Accessibility (WCAG 2.1 AA)

| ID | Criterion | File | Issue | Remediation |
|----|-----------|------|-------|-------------|
| A1 | 1.4.1 Use of Color | `MarketViews.tsx:181` | Sector heatmap + legend color-only (red↔green) | Pattern overlay / border on negative cells; colorblind mode |
| A2 | 2.1.2 No Keyboard Trap | `AuthScreen.tsx:311` | Modal: Tab escapes to background; focus not restored on close | Focus-trap hook; return focus to trigger |
| A3 | 4.1.2 Name/Role/Value | `AuthScreen.tsx:312` | Modal lacks `role="dialog"`, `aria-modal`, `aria-labelledby` | Add dialog roles + `id` on heading |
| A4 | 4.1.3 Status Messages | `AuthScreen.tsx:174,223,258,288` | Auth errors not announced | `role="alert" aria-live="assertive"` + `aria-describedby` |
| A5 | 4.1.2 / 2.1.1 | `Header.tsx:213-220`, `AtAGlance.tsx:153-172`, `MoversRibbon.tsx:40-54` | Interactive `<div onClick>` w/o keyboard | `<button>` or `role="button" tabIndex={0} onKeyDown` |
| A6 | 2.3.3 Animation | `store.ts:487-489`, `Crypto.tsx:100` | Price flash (650ms) + pulse anim ignore `prefers-reduced-motion` | Wrap anims in `@media (prefers-reduced-motion: no-preference)` |
| A7 | 4.1.3 Status Messages | `StockHeader.tsx:71` | No `aria-live` for price updates | ✅ Shipped (PR #14, v1.18.3) — price wrapped in `role=status aria-live=polite` |
| A8 | 1.4.3 Contrast | global — `--tx3` `#5b626c` on `--card` `#14171c` ≈ 3.2:1 | Fails AA (needs 4.5:1) for 10-12px secondary text | Lighten dark `--tx3` to ≈ `#7a8290` (≈ 4.8:1) |
| A9 | 1.3.1 / 2.5.3 | `SignalChips.tsx:28-37` | Chip detail only via `title` (hover) — no mobile/keyboard/SR access | `<details>`/`<summary>` or proper `role="tooltip"` |
| A10 | 4.1.2 | `UpgradePrompt.tsx:26` | Modal missing dialog semantics (same as A3) | Add `role="dialog"`/`aria-modal`/`aria-labelledby` |

---

## Feature suggestions (ranked)

1. **Alert direction toggle** (P1, Low) — ✅ shipped (F2).
2. **Current price vs threshold preview during alert setup** (P1, Low) — show `Current: $X · Alert at $Y · Z% away` as the user types in ManageWatchlist; `aria-live` the context.
3. **Market status pill + quote age in StockHeader** (P1, Low) — OPEN/CLOSED/PRE-MARKET pill from `marketStatus` + "as of HH:MM" from `quotesFetchedAt`, both inline with the 32px price. ⏳ next tier.
4. **First-time onboarding tour** (P2, Medium) — 3-step tooltip overlay (watchlist → Pulse → alerts) gated on `localStorage('tt_onboarded')`; reuse the existing `StarterPicker` pattern; keyboard-nav + reduced-motion aware.
5. **Screener column sorting** (P2, Low) — clickable headers w/ ▲/▼, `aria-sort`; mirror `AtAGlance.tsx:84-87` `onSort`.
6. **Alert creation from the Alerts view** (P2, Medium) — search-to-select ticker + inline price/direction form; `role="combobox"`; today requires navigating to ManageWatchlist.

---

## Performance follow-ups (flagged for other agents)
- If the Deep Dive fundamentals tab is rebuilt against a real source, install `database-optimizer` (VoltAgent) to design caching for the per-symbol fundamentals endpoint before the work.
- `performance-engineer` should audit the Screener `useEffect` quote batch-fetch (`visible.slice(0,30)`) before adding column sorting, since sort changes which rows are visible.

---

## Notes / gotchas surfaced during implementation
- **Strategy view is a parked mockup** — has a `routes.ts` entry but is intentionally unmounted in `App.tsx` (main `d4b7b62` "remove mockup Strategy page, park on roadmap"). Do NOT re-mount. `screener` is likely the same. F3's finding therefore applies to an unreachable view; its content was made honest defensively but it stays hidden.
- The genuine user-facing data-honesty win in the P1 batch is **F5 (Market Overview)** — those views are mounted and reachable.
