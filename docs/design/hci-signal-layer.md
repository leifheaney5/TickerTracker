# HCI / Interaction Spec — The Signal Layer (Pulse + "Why" + What-Changed)

> Design track deliverable for the overnight Signal-Intelligence build.
> Author: HCI / Product-UX. Source of truth for the build track implementing F2/F3/F5/F6
> from `docs/strategy/2026-06-28-moat-signal-intelligence.md`.
>
> **This document is a spec only.** It does not edit source. Every interaction below is
> grounded in the *real* components and tokens that exist today (cited by path/var). The build
> track owns `frontend/src/**`; this file is the contract it implements against.

---

## 0. Honesty contract (binding on every surface here)

These rules override any visual temptation. Violating them is a defect, not a style choice.

1. **Pulse is "a transparent summary of public signals," never advice.** No "Buy/Sell," no
   "we predict," no confidence scores. The score is reproducible arithmetic over real inputs
   (§3 of the strategy doc). The "Why" table is always one tap away — the math is the product.
2. **Sentiment is headline-based.** Anywhere a sentiment value appears in a Pulse context it is
   labelled **"based on news-headline language"** (tooltip + the "Why" table footnote). It is the
   same heuristic the existing `NewsCard` (`frontend/src/components/NewsCard.tsx`) and the
   `WatchlistSentiment` mood chip (`frontend/src/views/AtAGlance.tsx:112`) already show — we are
   not upgrading it to NLP, so we do not imply we did.
3. **No invented data.** We do **not** render options/IV, short interest, insider flow, social
   sentiment, or real EPS actuals. The component table shows *only* the inputs in the strategy
   inventory (RSI/MACD/trend/52w-position/analyst-target/headline-sentiment; crypto swaps in
   F&G + BTC dominance). If a component is missing for a symbol (e.g. analyst data for a coin),
   it is shown as **"Not available for this asset"** and *excluded from the weighting*, never
   faked or zero-filled silently.
4. **Pulse band color is decorative intensity, not a verdict.** Meaning is always carried by the
   **band label + numeric value** (text), so the dial is never the sole signal carrier (WCAG
   1.4.1, §6). A high Pulse means "more signals are elevated," not "good."

---

## 1. Vocabulary, bands, and color semantics (tied to REAL tokens)

Tokens live in `frontend/src/theme/tokens.ts` (`COLORS` / `LIGHT_COLORS`, exposed as CSS vars by
`rootCssVars()`). The signal layer introduces **zero new raw colors** — it composes existing vars
so dark stays pixel-stable and light inherits automatically.

### 1.1 Pulse bands (0–100)

| Band | Range | Meaning (honest) | Token used for dial arc + pill text | Pill background |
|---|---|---|---|---|
| **Cooling** | 0–34 | Few signals elevated; quiet | `--tx2` (#9aa1ab dark) | `rgba(154,161,171,.12)` |
| **Neutral** | 35–54 | Mixed / no clear tilt | `--tx2` | `rgba(154,161,171,.12)` |
| **Building** | 55–74 | Several signals turning up | `--warn` (#ffb347) | `rgba(255,179,71,.12)` |
| **Hot** | 75–100 | Most signals elevated | `--accent` (#3ddc84) | `rgba(61,220,132,.12)` |

Rationale for the ramp: a **cool-grey → amber → green** intensity scale reads as "how lit up,"
not as red/green "sell/buy." We deliberately do **not** put `--down` (#ff5d73 red) on the band
scale — red on a composite would imply "bad / sell," which is advice. The existing `.12`-opacity
pill-background pattern is reused verbatim from `NewsCard.tsx:10-14` and `StockHeader.tsx:71`.

### 1.2 Per-component *state* pills (these CAN be directional — they're facts)

Inside the "Why" table, each component's state is a *factual reading of one indicator*, so it may
use the up/down semantics the app already uses everywhere:

| State | Example | Token |
|---|---|---|
| Bullish / elevated / above-trend / near-target | "RSI 71 · overbought", "Price > SMA200" | `--up` (#3ddc84) on `rgba(61,220,132,.12)` |
| Bearish / weak / below-trend | "MACD < signal", "Sentiment bearish" | `--down` (#ff5d73) on `rgba(255,93,115,.12)` |
| Neutral / in-range | "RSI 48", "Mid 52w range" | `--tx2` on `rgba(154,161,171,.12)` |

This is consistent with the analyst-distribution `SEG_COLORS` in
`frontend/src/components/DueDiligence.tsx:13` and the sentiment pill map — no new visual language.

### 1.3 Typography

Numbers (score, raw values, contributions) → `FONT_MONO` (`tokens.ts:70`, JetBrains Mono), matching
every numeric in the app (price, KeyStats, targets). Labels → `FONT_SANS` (Sora). Band label is
`FONT_SANS` 700, consistent with the bold ticker treatment in `StockHeader.tsx:58`.

---

## 2. PulseDial component — placement & states

### 2.1 Where it mounts

Three surfaces, one component at three sizes (a `size` prop, exactly like `Sparkline` and `Logo`):

| Surface | File it lives in | Size | Behavior |
|---|---|---|---|
| **Primary** — stock card header | `frontend/src/components/StockHeader.tsx`, right-hand cluster (the column that holds the PRICE TARGET chip, lines 78–105) | 56px dial | Click / Enter toggles the "Why" panel |
| **List** — each watchlist row | `frontend/src/components/Watchlist.tsx`, the right column that holds the %-change pill + `Sparkline` (lines 184–187 / 325–328) | 22px mini-dial (arc + number only, no band word) | Click selects the symbol (existing row behavior); dial is decorative-with-text-alt |
| **Movers / cold-start cards** | `MoversRibbon.tsx` chips & the cold-start list (§4) | 18px mini-dial | Inherits card click |

The **primary dial sits to the LEFT of the PRICE TARGET chip** in the existing right-aligned
`flex-direction: column` cluster, so the header's right edge reads top-to-bottom:
`[ PulseDial ] → [ PRICE TARGET chip ] → [ ● Target reached ]`. This keeps Pulse adjacent to the
other "is this interesting?" affordance (the target) without disturbing the left price block.

```
 StockHeader (desktop)  — frontend/src/components/StockHeader.tsx
 ┌───────────────────────────────────────────────────────────────────────┐
 │  [logo] NVDA  [NASDAQ]  [✓ Tracking]                                    │
 │  NVIDIA Corp · Semiconductors                       ╭─────────╮         │
 │                                                     │   ◜78◝  │  Pulse  │
 │  $1,182.40   ▲ +2.14%  +$24.70   Today              │  ◟HOT ◞  │  Why ▸ │
 │                                                     ╰─────────╯         │
 │                                              ┌──────────────────────┐   │
 │                                              │ ◎ PRICE TARGET  ✎    │   │
 │                                              │   $1,300.00          │   │
 │                                              └──────────────────────┘   │
 └───────────────────────────────────────────────────────────────────────┘
```

### 2.2 The dial itself (SVG, same hand-rolled approach as `Sparkline.tsx`)

- A **270° arc gauge** (gap at the bottom), background track in `--line`, value arc in the band
  token (§1.1). Score numeral centered in `FONT_MONO` 600; band word beneath it in `FONT_SANS`
  700 at the band token color.
- Built as inline SVG with a `<linearGradient>` exactly like `Sparkline.tsx:36-41` (reuse the
  pattern; gradient from band-token `stopOpacity .9 → .5` along the arc).
- The arc is the *only* animated element (§2.4).
- A tiny **"news-based" asterisk** is NOT on the dial (the dial is a composite); the headline-
  sentiment caveat lives in the "Why" table where that specific row is.

**Default (collapsed) state:** dial + the affixed label "Pulse" and a `Why ▸` disclosure control.
The disclosure is a real `<button>` (focusable), not a div, so keyboard + SR users reach it.

**Expanded state:** the `Why ▸` rotates to `Why ▾` and the "Why" panel (§3) renders directly
below the entire StockHeader, i.e. inserted into `frontend/src/views/Dashboard.tsx` between
`<StockHeader />` (line 39) and `<ChartControls />` (line 40) as a full-width collapsible card.
Placing it there (not inside the header's flex row) avoids reflowing the price block and gives the
table full column width.

### 2.3 Loading / empty / stale

- **Loading** (Pulse fetch in flight, mirrors `KeyStats.tsx:23` `'…'` convention): dial track
  renders at `--line`, numeral shows `…`, band word hidden, `Why ▸` disabled (`aria-disabled`).
- **Unavailable** (e.g. brand-new symbol with no history yet): show a hollow dial with `—` and a
  one-liner in the panel: *"Not enough history yet to compute Pulse."* Never fabricate a number.
- **Stale** (`Envelope.meta.stale === true`, `frontend/src/api/types.ts:3-6`): append a muted
  `as of <time>` using the existing `asOf()` helper already used in `KeyStats.tsx:44`.

### 2.4 Motion / micro-interaction

- On symbol change or first paint, the value arc **sweeps from 0 to score** over ~450ms
  `cubic-bezier(.22,.61,.36,1)`; the numeral counts up in lockstep. One-shot, not looping.
- Disclosure expand/collapse: panel height/opacity transition ~180ms ease (matches the app's
  existing `transition: 'border-color .15s'` cadence in `Watchlist.tsx:171`).
- **Reduced motion** (`@media (prefers-reduced-motion: reduce)`): no sweep, no count-up — the arc
  and final numeral render immediately; the panel toggles with no height animation. (See §6.)
- Hover on the primary dial: a 1px `--line2` ring (same hover affordance language as cards).

---

## 3. The "Why" panel — explainability table

A full-width collapsible card inserted between `StockHeader` and `ChartControls` in
`Dashboard.tsx`. Visual shell = the standard card style used everywhere
(`background:'var(--card)'; border:'1px solid var(--line)'; borderRadius:16; padding:'18px 20px'`
— identical to `KeyStats.tsx:41` / the `card` const in `DueDiligence.tsx:71`).

### 3.1 Layout

```
 ┌─ Why this Pulse?  ── NVDA · 78 HOT ───────────────── as of 9:41am  [×] ─┐
 │                                                                          │
 │  Component        Reading           State        Contribution           │
 │  ───────────────────────────────────────────────────────────────────    │
 │  Momentum         RSI 71 · MACD ▲   ● Elevated   +22  ▕███████▏         │
 │  Trend            Px > SMA50 & 200  ● Above       +19  ▕██████▏          │
 │  52-wk position   94% of range      ● High        +14  ▕█████▏          │
 │  Analyst target   +8.4% to mean     ● Near        +12  ▕████▏           │
 │  Sentiment*       Bullish (12▲/3▼)  ● Bullish     +11  ▕███▏            │
 │  ───────────────────────────────────────────────────────────────────    │
 │  Pulse                                            = 78 / 100  HOT        │
 │                                                                          │
 │  * Sentiment is based on news-headline language, not a financial model.  │
 │  Pulse is a transparent summary of public signals — not investment advice.│
 └──────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Column semantics

| Column | Content | Token / font |
|---|---|---|
| **Component** | Fixed label (Momentum, Trend, 52-wk position, Analyst target, Sentiment). Crypto variant: Momentum, Trend, **Fear & Greed**, **BTC dominance**, Sentiment. | `--tx`, `FONT_SANS` |
| **Reading** | The raw value(s) in plain numbers — `RSI 71`, `Px > SMA200`, `94% of range`, `+8.4% to mean`. | `--tx2`, `FONT_MONO` for the numbers |
| **State** | A small state pill (§1.2) — directional, color + **word** both present. | up/down/tx2 tokens |
| **Contribution** | Signed points the component added to the 0–100, plus a thin proportional bar (reuse the `width:%` segmented-bar pattern from `DueDiligence.tsx:85-89`). | `FONT_MONO`, bar in the band token |

The grid uses the same hairline-separated grid technique as `KeyStats.tsx:46` (`gap:1` over a
`--line` background) so it visually belongs to the existing stat panels. The footer total restates
**score + band label** (text redundancy with the dial — never color-only).

### 3.3 Published weights

A muted one-liner under the table or behind an `ⓘ` popover: *"Weights: Momentum 25 · Trend 25 ·
Position 20 · Analyst 15 · Sentiment 15."* These must match the backend `/api/pulse/<SYM>`
response exactly (the build track wires this; the design just reserves the slot). Honesty: if the
backend reweights because a component is unavailable, the panel shows the *effective* weights used
for *this* symbol, with a note "Analyst data not available for this asset — reweighted."

### 3.4 Keyboard + screen reader

- The `Why ▸/▾` toggle is a `<button aria-expanded={open} aria-controls="pulse-why">`.
- The panel container is `id="pulse-why"` with `role="region"` and
  `aria-label="Pulse breakdown for NVDA"`.
- The table is a real `<table>` (like `ShortcutsHelp.tsx:94`) with `<th scope="col">` headers, so
  SR users get "Momentum, RSI 71 MACD up, Elevated, plus 22" row navigation for free.
- The dial itself: `role="meter"` `aria-valuenow={78}` `aria-valuemin={0}` `aria-valuemax={100}`
  `aria-label="Pulse 78 of 100, Hot. Press Enter for the breakdown."` (see §6).
- Focus order: dial/Why button is reachable in normal tab flow *after* the Track button and
  *before* the price-target chip (DOM order in the right cluster). On expand, focus does **not**
  auto-jump; on collapse via `[×]`, focus returns to the `Why` button (standard disclosure pattern).

---

## 4. "What changed since you last visited" strip (F5)

### 4.1 Placement

A full-width strip at the **top of the Dashboard main column**, inserted in `Dashboard.tsx`
**above `<MoversRibbon />`** (line 38). It is the first thing in the research column, answering
"this changed, look here" before the user has to scan (directly addresses §1.3 "flat hierarchy").
It renders only for authed users with a watchlist and prior-visit history; otherwise it yields to
the cold-start experience (§5).

```
 ┌─ Since you were last here · 2 days ago ─────────────────────────── [×] ─┐
 │  ↑ TSLA Pulse 41→63 Building   ⚑ AMD sentiment flipped Bearish→Bullish   │
 │  ◷ NVDA reports earnings in 2 days   ◎ AAPL now +1.2% from analyst target │
 │                                                       See all changes ▸  │
 └──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Content (max 4 chips, ranked by salience; all from real first-party history, F3)

1. **Biggest Pulse movers** — `↑ TSLA Pulse 41→63 Building` (delta from `signal_snapshots`).
   Arrow + numbers carry meaning; band token tints the chip border-left only (3px), not the fill,
   to stay quiet.
2. **Sentiment flips** — `⚑ AMD sentiment flipped Bearish→Bullish` (label: tooltip "news-headline
   language"). Uses up/down tokens on the words.
3. **Upcoming earnings on your list** — `◷ NVDA reports in 2 days` (from `store.earnings`, already
   loaded by `DueDiligence.tsx:25`).
4. **Nearest analyst target** — `◎ AAPL +1.2% from mean target` (from `ratings`, the same
   `target.mean` used in `DueDiligence.tsx:45`). Reuses the `◎` glyph already on the target chip.

Each chip is a button that `setSelected(sym)` (the store action used throughout, e.g.
`MoversRibbon.tsx:41`) and, for Pulse/sentiment chips, auto-opens that symbol's "Why" panel.

### 4.3 Empty state

If nothing material changed: collapse to a single quiet line, *"Nothing major moved on your list
since 2 days ago."* in `--tx3`. Never fabricate a "change" to fill the strip. If the user has no
prior snapshot yet (first ever visit while authed), hide the strip entirely and let normal content
show — do not show an empty frame.

### 4.4 Dismiss behavior

- `[×]` collapses the strip for the session (state in the Zustand store, not persisted server-side
  for v1 — same lightweight pattern as the mobile-expand local state in `Watchlist.tsx:47`).
- "Last here" timestamp is updated on load; the **set of changes is computed against the previous
  timestamp**, so dismissing doesn't lose data — it just hides until next visit.
- The strip never re-expands itself within a session once dismissed.

---

## 5. Cold-start "Interesting right now" (F6) — first 30 seconds

### 5.1 Trigger

Replaces the bare empty watchlist state for **new / signed-out / empty users**. Today the empty
states are a star glyph + "No tickers here yet" (`Watchlist.tsx:200-205, 343-351`) and the
Dashboard just shows a default `NVDA` chart (`store.ts:131 selected:'NVDA'`). Instead, when the
watchlist is empty, the **main column leads with an "Interesting right now" board** computed over
the default universe (`frontend/src/data/universe.ts` / starter lists in `data/starterLists.ts`).

### 5.2 Layout

```
 ┌─ Interesting right now ───────────────────── honest snapshot, public data ─┐
 │                                                                            │
 │  Market regime    Crypto Fear & Greed: 74 · Greed                          │
 │                                                                            │
 │  Highest Pulse today          Reporting this week                          │
 │  ┌───────────────┐            ┌───────────────┐                            │
 │  │[N] NVDA  ◜82◝ │            │[T] TSLA  Wed   │                            │
 │  │ Hot   +2.1%   │            │ AMC · est 0.71 │                            │
 │  └───────────────┘            └───────────────┘                            │
 │  ┌───────────────┐            ┌───────────────┐                            │
 │  │[A] AVGO  ◜76◝ │            │[M] MSFT  Thu   │                            │
 │  └───────────────┘            └───────────────┘                            │
 │                                                                            │
 │     ＋ Add these to a watchlist     or pick a starter list ▸               │
 └────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Content (all real)

- **Market regime**: Crypto Fear & Greed from `services/crypto.py::get_fng` (already in the app via
  `Crypto.tsx`). Honest, no stock-market "fear index" we don't have.
- **Highest Pulse today**: top 4–6 from the default universe by `/api/pulse`. Each card uses the
  18px mini-dial + the existing `Logo` + day-change pill (reuse `MoversRibbon` card markup).
- **Reporting this week**: from the earnings calendar (`services/earnings.py`).
- **CTAs**: "Add these to a watchlist" and a link into the existing `StarterPicker`
  (`frontend/src/components/StarterPicker.tsx`) so cold-start funnels into the established
  onboarding rather than a parallel path.

### 5.4 Honesty + a11y

- Header subtitle literally reads "honest snapshot, public data." No "top picks," no "recommended."
- "Highest Pulse" ≠ "best to buy" — tooltip on the section title: *"Pulse summarizes public signals;
  it is not advice."*
- Each mini-dial card has the same `aria-label` meter pattern (§3.4) plus the ticker, so the board
  is fully navigable by keyboard/SR; cards are buttons that `setSelected` + load that symbol.

---

## 6. Sentiment-trend + Pulse sparkline micro-viz (F3 surfacing)

Two tiny, honest time-series, both rendered with the **existing `Sparkline` component pattern**
(`frontend/src/charts/Sparkline.tsx`) so they match the app's chart language exactly.

### 6.1 Pulse sparkline

- A 5–14 day Pulse history line, shown **inside the "Why" panel header** next to the score
  (`◜78◝ ▕╱╲╱▏ +12 over 5d`). Uses the band token for stroke, gradient fill identical to
  `Sparkline.tsx:36-43`.
- Honest label beneath: *"Pulse, last 5 sessions"* — and it only appears once `signal_snapshots`
  actually has ≥3 points; before that, show *"History starts accruing today."* (the strategy's
  un-backfillable-moat point — we don't fake a back-history).

### 6.2 Sentiment-trend chip

- A small chip in the `NewsCard` header (`NewsCard.tsx:51-57`, next to the sym/Market toggle):
  `Headline tone: ▲ improving (3d)` or `▬ steady` / `▼ softening`, computed from the snapshot of
  daily bullish/bearish counts.
- **Mandatory label**: the chip's tooltip and `aria-label` say *"Trend of news-headline language
  over 3 days — not a financial model."* This is the §0.2 honesty rule made literal.
- Color uses up/down/tx2 on the **glyph + word**, never color alone.

### 6.3 Why these are honest

Both visualize *our own first-party history of values we already compute*. They never imply a
forecast — labels are strictly past-tense and the time window is stated. No trend line is
extrapolated forward.

---

## 7. Information hierarchy fix (addresses §1.3 "flat hierarchy / this-changed-look-here")

The core problem: everything renders at equal weight. The fix is a **single, consistent "change
accent" vocabulary** applied sparingly so salience means something:

1. **One reserved motion**: only *changed* things animate (the Pulse arc sweep §2.4, the
   What-Changed strip's entrance). Static data never animates. Motion = "this is new."
2. **Border-left accent, not fills**: change chips (§4) and "shifted bullish N days ago"
   annotations use a 3px colored `border-left` on an otherwise standard `--card`, instead of full
   tinted backgrounds. This reads as "flagged" without the wall-of-color the team already pruned
   from the watchlist target bar (see the comment at `Watchlist.tsx:330-332` — they explicitly
   removed a progress bar "to declutter / cut the wall of green"; we honor that instinct).
3. **Vertical priority order in the main column** (top = most "you should look here"):
   `What-changed strip → MoversRibbon → StockHeader(+Pulse) → Why panel → chart → stats/news →
   DueDiligence`. The proactive/changed surfaces sit above the evergreen reference data.
4. **The dial is the one new focal point.** Everything else (Why table, sparklines, chips) is
   quiet by default and only "lights up" (band token) proportional to actual signal intensity. A
   Cooling/Neutral name is visually calm — only genuinely Hot names draw the eye, so attention is
   allocated by real signal, not by chrome.

---

## 8. Accessibility (WCAG 2.1 AA) — the dial and new surfaces

| Concern | Decision |
|---|---|
| **1.4.1 Use of color** | Band meaning is *always* carried by the **band word + numeric value** in text, never color alone. Component state pills always pair a word ("Elevated/Bullish/Neutral") with the color. The dial numeral is the primary signal; the arc color is redundant. |
| **1.4.3 Contrast** | Band tokens on `--card`: `--tx2` (5.2:1 light / strong on dark), `--warn`, `--accent` are used for **non-text decorative arc + bold ≥16px band word** (large-text / UI-component thresholds). Body text in the table stays `--tx`/`--tx2`, the same contrast-audited tokens documented in `tokens.ts:23-44`. We do not introduce a new low-contrast color. |
| **Non-text contrast 1.4.11** | The dial arc vs its `--line` track and the contribution bars meet 3:1 against the card. |
| **Name/role/value 4.1.2** | Dial = `role="meter"` with `aria-valuenow/min/max` + descriptive `aria-label` ("Pulse 78 of 100, Hot. Press Enter for breakdown."). Disclosure = `<button aria-expanded aria-controls>`. Panel = `role="region"` labelled by the symbol. |
| **Keyboard** | Dial/Why button is in natural tab order (after Track, before target chip). Enter/Space toggles. Esc closes the Why panel and the What-changed strip (consistent with the existing Esc-to-close in `useKeyboardShortcuts.ts:44` and `ShortcutsHelp.tsx`). Optionally extend the "g"-prefix map (`useKeyboardShortcuts.ts:11`) is **not** needed — no new view. |
| **Focus visible** | Reuse the app's accent focus ring convention (`boxShadow:'0 0 0 1px var(--accent)'`, as in `Watchlist.tsx:170`) on the dial button. |
| **2.3 / reduced motion** | `@media (prefers-reduced-motion: reduce)`: disable arc sweep, count-up, strip entrance, and panel height transition — render final state immediately. This is a new media query the build track must add; the app currently has none, so this is also a small a11y upgrade. |
| **Screen-reader narrative** | "Why" is a real `<table>` with `<th scope>` so each component reads as a coherent row. The headline-sentiment caveat is in the DOM (a `<caption>` or footnote `<p>`), so SR users hear "based on news-headline language," not just sighted users. |
| **Target size 2.5.5** | Mini-dials in watchlist rows are decorative-with-text-alt; the *row* remains the 44px+ touch target (unchanged), not the 22px dial. |

---

## 9. Mobile / responsive behavior

The app already branches on `useIsMobile()` (`frontend/src/hooks/useIsMobile.ts`), used in
`Dashboard.tsx:22`, `Watchlist.tsx:46`, etc. The signal layer follows the same branch.

| Surface | Mobile behavior |
|---|---|
| **Primary dial** | StockHeader already wraps (`flexWrap:'wrap'`, `StockHeader.tsx:54`). On narrow screens the right cluster drops below the price block; the dial sits **inline left of the target chip** as a 44px dial (slightly smaller) so the header stays ≤2 rows. |
| **Why panel** | Full-width card, table collapses from 4 columns to a **stacked 2-line row per component** (Component + State on line 1, Reading + Contribution on line 2) — same responsive instinct as the `DueDiligence` earnings grid. Contribution bar spans full width. |
| **Mini-dial in watchlist** | The mobile watchlist row (`Watchlist.tsx:184-187`) already stacks the %-pill above the `Sparkline`; the 22px dial replaces/accompanies the near-target `◆` glyph (line 179) — a tiny arc + number, tappable to select. |
| **What-changed strip** | Chips wrap to 1 column, horizontally scrollable like the existing movers/group rows (`overflowX:'auto'` pattern, `MoversRibbon.tsx:35`). Max 3 chips on mobile, "See all changes ▸" links to a sheet. |
| **Cold-start board** | The two columns ("Highest Pulse" / "Reporting") stack vertically; cards go full-width. CTAs stack. |
| **Sentiment-trend / Pulse sparkline** | Already tiny; unchanged — they're the same `Sparkline` size used in the mobile watchlist today. |
| **Reduced motion** | Honored identically on mobile (often the platform default for low-power). |

---

## 10. Build-track handoff checklist (what this spec assumes the API provides)

Not design work — listed so the interaction spec and the F2/F3 endpoints line up. The build track
owns these; design just states the shape it draws against (consistent with the `Envelope<T>` in
`frontend/src/api/types.ts:3-6`):

- `GET /api/pulse/<SYM>` → `{ score, band, components: [{ key, label, reading, state, contribution, weight, available }], asOf, stale }`. (Component `available:false` drives the "Not available for this asset" path, §0.3.)
- Pulse/sentiment history for the sparklines (F3 `signal_snapshots`): `{ date, pulse, bullish, bearish }[]`, returning `[]` (not fabricated) when history is too short.
- What-changed payload (F5): movers/flips/earnings/target deltas computed server-side against the user's `last_seen_at`.
- Cold-start board (F6): top-Pulse + F&G + this-week-earnings over the default universe.

Each must be reproducible from the §3 strategy inventory only. If any field can't be sourced
honestly, the surface degrades to its empty/unavailable state (specified per section) rather than
inventing a value.

---

## Appendix A — component/token citation index (for the build track)

| This spec references | Real location |
|---|---|
| Color tokens, fonts, density, light theme | `frontend/src/theme/tokens.ts` |
| Pill background `.12` pattern, sentiment color map | `frontend/src/components/NewsCard.tsx:10-14,71` |
| Stock card / header (primary dial mount) | `frontend/src/components/StockHeader.tsx:54-105` |
| Dashboard column order (strip + Why panel insertion points) | `frontend/src/views/Dashboard.tsx:37-49` |
| Watchlist row (mini-dial mount), local-state pattern, decluttering note | `frontend/src/components/Watchlist.tsx:47,179-187,330-332` |
| Sparkline (Pulse + sentiment micro-viz pattern) | `frontend/src/charts/Sparkline.tsx` |
| Segmented bar / contribution bar pattern | `frontend/src/components/DueDiligence.tsx:13,85-89` |
| Hairline grid / `…` loading / `asOf()` stale label | `frontend/src/components/KeyStats.tsx:23,44,46` |
| Existing sentiment "mood" chip (honesty precedent) | `frontend/src/views/AtAGlance.tsx:112-122` |
| Movers chips (cold-start + What-changed card markup) | `frontend/src/components/MoversRibbon.tsx:35-54` |
| Keyboard infra (Esc, focus, edit-target guard) | `frontend/src/hooks/useKeyboardShortcuts.ts` |
| Accessible table + dialog pattern | `frontend/src/components/ShortcutsHelp.tsx:94-121` |
| Mobile branch hook | `frontend/src/hooks/useIsMobile.ts` |
| Response envelope / Ratings / Earnings / Sentiment types | `frontend/src/api/types.ts` |
| Starter onboarding funnel target | `frontend/src/components/StarterPicker.tsx` |
