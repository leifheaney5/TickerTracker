# Handoff: Ticker Tracker — Stock & Crypto Tracking App

## Overview
Ticker Tracker is a sleek, dark-themed stock and crypto tracking web app. The hero experience is a **split-view dashboard** (curated watchlist on the left, large interactive timeline chart + news on the right), surrounded by market-wide tooling: a market overview, a treemap "Market Map", sector performance, a crypto section, a stock screener with compare, a fundamentals "Deep Dive", a portfolio/holdings view, a price-alert system, an algo "Strategy" cockpit, and a Settings page with a brokerage-connect flow.

The product's intended differentiator is the **curated watchlist ("your Ticker Tracker list")**: search/screening spans a universe of ~100 stocks + crypto, but the hand-picked watchlist is what the user actively tracks (targets, alerts, holdings).

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing intended look and behavior, **not production code to ship directly**. The task is to **recreate this design in the target codebase's environment** (e.g. React + a charting lib, Vue, SwiftUI, etc.) using its established patterns, component library, and data layer. If no environment exists yet, choose an appropriate stack — the prototype's own structure (a single component with a data model + a `renderVals()` view-model + an inline-styled template) maps cleanly onto React function components with hooks.

> The prototype is authored as a "Design Component" (`.dc.html`) that renders via the bundled `support.js` runtime (a lightweight React-based template engine). **Do not port the runtime.** Read the `.dc.html` for layout, exact styles, copy, and the logic class for behavior/data — then reimplement in your stack.

### Running the prototype for reference
Serve the folder over HTTP (e.g. VSCode **Live Server**, or `npx serve`) and open `Ticker Tracker.dc.html`. It must be served over `http://` (not `file://`) and needs internet access (live Fear & Greed API + logo CDNs). Keep `support.js` beside the HTML.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, and interactions are all specified below and in the source. Recreate the UI pixel-faithfully using your codebase's libraries. Charts are hand-drawn SVG in the prototype — in production, prefer a real charting library (see *Charting* below) styled to match.

---

## Design Tokens

### Colors (CSS custom properties, defined on the root in `renderVals().rootStyle`)
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0a0b0d` | App background (near-black) |
| `--panel` | `#0f1115` | Header, sidebar, modals, table header rows |
| `--card` | `#14171c` | Cards, inputs, tiles |
| `--cardHi` | `#1a1e25` | Selected/hover card background |
| `--line` | `rgba(255,255,255,.07)` | Hairline borders, dividers |
| `--line2` | `rgba(255,255,255,.12)` | Stronger borders, menu edges |
| `--tx` | `#e9ebee` | Primary text |
| `--tx2` | `#9aa1ab` | Secondary text |
| `--tx3` | `#5b626c` | Tertiary/labels/placeholder |
| `--up` | `#3ddc84` | Gains / positive (also the accent) |
| `--down` | `#ff5d73` | Losses / negative |
| `--accent` | `#3ddc84` | Primary accent = green (a prop; alt options `#4f8cff`, `#c6f24e`, `#e9ebee`) |

Accent-on-button text is always near-black `#06120b` (green is light). Warning/amber used in a few places: `#ffb347` / `#ff9f43`. Compare-series palette: `['#4f8cff','#c6f24e','#ff9f43','#b794ff']`. Heatmap diverging scale interpolates between neutral `rgb(34,37,44)` and green `rgb(34,172,96)` / red `rgb(214,58,58)`.

### Typography
- **Sans (UI):** `Sora`, weights 400/500/600/700/800. Headings 800, section titles 700, body 400–600.
- **Mono (numbers):** `JetBrains Mono`, weights 400–700. Used for ALL prices, %s, stats, axis labels, table figures.
- Both loaded from Google Fonts. Letter-spacing on big headings: `-.02em`. `text-wrap: pretty` on long body copy.
- Representative sizes: page title 21px/800; stock symbol hero 30px/800; live price 32px mono/600; section title 13px/700; body 12.5–13px; labels 10–11px (often `letter-spacing:.04em`, uppercase).

### Spacing / radius / shadow
- Density is a prop (`airy` / `balanced` / `dense`) driving `--mpad` (main padding), `--gap` (card gap), `--lgap` (list gap). Defaults (balanced): main pad `22px 26px`, card gap `16px`, list gap `8px`.
- Radius: cards/modals `16–18px`, tiles/inputs/buttons `8–13px`, pills `20px`, full circle for dots/avatars.
- Shadows: modals `0 30px 80px rgba(0,0,0,.6)`; popovers `0 18px 50px rgba(0,0,0,.55)`; accent buttons `0 2px 10px rgba(61,220,132,.25)`.
- Card pattern: `background:var(--card)`, `border:1px solid var(--line)`, `border-radius:16px`.

---

## Global Layout & Chrome
- Root: `100vh` flex column, `overflow:hidden`, `background:#0a0b0d`, font Sora.
- **Header (60px, sticky, `--panel`, bottom hairline):** left = logo (28px green rounded square "T") + wordmark "**Ticker** Tracker" (Ticker green `--up`, Tracker red `--down`) + a pulsing "LIVE" pill. Center = global **search** (max 440px; `/` focuses it; type any symbol → results popover with one-tap ＋track; unknown symbols offer "Add to your tracker & open"). Right = portfolio chip (value + day %, hidden→"Connect account" when no broker), a context-aware **ⓘ help** button, a **↻ refresh** button, and the **avatar** (opens Settings).
- **View nav** lives in the header as a horizontally-scrollable segmented control: **Dashboard · At-a-Glance · Market · Crypto · Screener · Strategy**. Sub-navs live inside pages (At-a-Glance↔Deep Dive; Market↔Map↔Sectors).
- Single-page app: `state.view` selects which view renders. All views share the header.

---

## Screens / Views

### 1. Dashboard (`view:'dashboard'`) — the hero
**Purpose:** Deep-dive one stock. **Layout:** header + body flex row: **sidebar (336px)** watchlist | **main** (scroll).
- **Watchlist sidebar:** title + count + a sort-cycle button (Manual/% Change/Price/A–Z). Group folder tabs (All/Tech/Energy/Finance/Crypto). Scrollable list of **cards** (drag-to-reorder in Manual mode): symbol, name, mono price (flashes green/red on tick), % pill, 30-day sparkline (SVG, gradient fill), and a target-progress bar when a target is set. Selected card has accent border + ring. Empty state when a group has none. Footer: prominent filled-green **＋ Add ticker** button → inline add form (symbol + optional target).
- **Main column (top→bottom):** movers ribbon (gainers/losers toggle, horizontally scrollable chips) → **stock header** (symbol 30px, exchange pill, **＋ Track / ✓ Tracking** button, name·sector, big mono price + day change pill, editable **price target** chip, "target reached" flag) → **chart controls** (timeframe 1D/1W/1M/3M/1Y/5Y; Candles/Line/Area; **Compare** dropdown to overlay up to 4 tickers normalized to %) → **chart card** (see Charting) → **Key Statistics** grid (Open, Prev Close, Day Hi/Lo, 52W Hi/Lo, Volume, Avg Vol, Mkt Cap, P/E, Div, Beta) + **News** card (per-ticker / Market toggle; each item: source · timestamp · sentiment pill Bullish/Bearish/Neutral; headline) → **Due Diligence** row: Analyst Ratings (consensus, Strong Buy→Strong Sell distribution bars, 12-mo price target range with current+avg markers, upside %), Earnings & Events (next earnings date, EPS est, last surprise, event list), About (company blurb + CEO/HQ/Founded/Employees/Sector/Exchange).

### 2. At-a-Glance (`view:'overview'`) & Deep Dive (`view:'deep'`)
Shared header with a **Watchlist / Fundamentals** sub-toggle.
- **At-a-Glance:** one big sortable table of the watchlist. Columns: Ticker (logo+name), Price, 24H % pill, **Mkt Cap, P/E, Vol, Sector, Industry**, 30D Trend sparkline, 52W Range, Target (inline editable), Alert (inline editable). **Every data header is click-to-sort, toggling asc/desc with a ▲/▼ indicator.** Min-width ~1480px with horizontal scroll.
- **Deep Dive:** fundamentals table across the watchlist — P/E, P/S, P/B, PEG, EBITDA, FCF Yld, ROIC, Gr. Margin, Net Debt/EBITDA. Rows clickable → Dashboard.

### 3. Market (`view:'market'`) + Map (`view:'map'`) + Sectors (`view:'sectors'`)
Shared **Overview / Map / Sectors** sub-nav.
- **Overview:** major-index chart with **layer toggles** (S&P/Nasdaq/Dow/Russell — each a colored toggle; 1 = filled area in points, 2+ = normalized % overlay with legend) and **timeframe** (1W/1M/3M/6M/1Y/ALL, ALL spans ~16y with year axis labels). Sidebar: **Market Internals** (diverging bars: Advancing/Declining, New Highs/Lows, Above/Below SMA50, Above/Below SMA200), **Fear & Greed** gauge (live), index cards, **Biggest Gainers/Losers** (top 8 each, proportional bars), Market News.
- **Map:** Finviz-style **treemap** — tiles sized by market cap, colored by daily % (red→green legend). Click a sector to drill in; in a sector, click a tracked tile to open it. Centered square (≤600px).
- **Sectors:** **Performance Matrix** (11 sectors × 6 timeframes 1D/1W/1M/3M/YTD/1Y, color-coded cells) + a **ranked bar chart** for the selected timeframe.

### 4. Crypto (`view:'crypto'`)
Parallel world: coin tabs (BTC/ETH/TAO/…), coin price chart, **Crypto Map** treemap (top ~26 coins), total market cap, BTC dominance, **live Fear & Greed index** (fetched from `api.alternative.me/fng`), and crypto news.

### 5. Screener (`view:'screener'`)
Filter the full ~100-stock universe by Sector / Performance (Gainers/Losers) / Market-cap tier (Mega/Large). Results table (Ticker, Sector, Price, 24H, Mkt Cap, P/E, Vol) with **＋ Compare** per row (up to 4). A **compare panel** appears above with a metric matrix (Price, 24h, Mkt Cap, P/E, Vol, Div, Sector, Exchange) and removable columns. Rows open the Dashboard; ＋ Compare/track integrates with the watchlist.

### 6. Strategy (`view:'strategy'`)
Algo-trading cockpit: KPI banner (Sharpe, Max Drawdown, Win Rate, Risk/Reward, Trend Strength bar), **Equity Curve** (strategy area vs dashed benchmark), risk sidebar (**Circuit Breakers** with daily-loss/consecutive-loss limits, **System Health** traffic lights, **Execution Quality**), and **Active Positions** grid. Has its own dedicated "ⓘ How to read this" explainer modal.

### 7. Portfolio / Holdings (`view:'holdings'`)
Opened via the header portfolio chip. Summary cards (Total Value, Cost Basis, Total Return, Today), **allocation donut** (SVG, with center count), and a positions table (Asset, Shares, Avg Cost, Price, Value, Today, Return). Requires a connected broker; otherwise shows a "No brokerage connected → Go to Settings" empty state. All dollar values masked when "Hide balances" is on.

### 8. Alerts (`view:'alerts'`)
Active alerts (symbol, condition "Rises/Falls to $X", current price, HIT badge, Remove) + Triggered History log. Reached via the alerts dropdown's "View all alerts". Toasts pop on trigger (gated by a Settings toggle).

### 9. Settings (`view:'settings'`)
Profile (name/email/phone, editable), **Connected accounts** with a **brokerage-connect flow** (see below), Notifications & Data toggles (Live updates, Alert notifications, Weekly digest), Privacy (Hide balances), Sign out.

---

## Key Interactions & Behavior
- **Live ticking:** every 2.6s prices random-walk; changed prices flash green/red for ~650ms (gated by `liveTicker` prop + Settings "Live updates").
- **Chart crosshair + tooltip:** hover shows date/OHLC/close + **% change from range start**. **Drag across the chart to zoom** to a range; double-click or a "⤢ Reset zoom" button restores. (Line/Area/Candles only; Compare disables zoom.)
- **Compare:** up to 4 overlays, normalized to % so different price scales compare fairly; colored chips with remove ×.
- **Sorting:** all primary tables sort on header click (asc↔desc, ▲/▼ indicator).
- **Drag-reorder** watchlist cards (Manual sort only).
- **Keyboard:** `/` focus search; `g` then `d/a/m/c/h/s` jumps views; ↑/↓ moves watchlist selection on Dashboard; `Esc` closes overlays.
- **Brokerage connect flow:** Connect → modal with 6 providers (Plaid [Recommended], Charles Schwab, Fidelity, Robinhood, Interactive Brokers, Coinbase) → pick one → ~2.1s "Connecting to …" spinner → connected; `settings.brokerName` set and surfaced everywhere; Disconnect reverts. **This is a simulated front-end flow** — in production wire it to a real aggregator (Plaid Link, SnapTrade, or direct brokerage OAuth).
- **Context help:** a shared ⓘ button in the header opens a per-view explainer modal (numbered steps + glossary), content keyed in the `HELP` map.
- **Persistence:** watchlist, order, targets, alerts, settings, current view, compare set, sort all saved to `localStorage` key `tt_state_v1` and restored on load.

## State Management
The prototype keeps one component's `state` (port to hooks/store). Key fields: `view`, `selected` (active symbol), `timeframe`, `chartType`, `group`, `compare[]`, `search`/`searchFocus`, `hover`/`zoom`/`brush` (chart), `newsTab`, `moversTab`, `sortBy` (watchlist), `ovSort` ({col,dir} for At-a-Glance), `secTf`, `marketLayers[]`, `mktTf`, `cryptoCoin`, `scr` (screener filters), `compareSet[]`, `helpOpen`, `brokerModal`/`brokerPending`, and `settings` (profile + brokerConnected/brokerName + toggles). Non-reactive caches hold generated series/news/fundamentals (deterministic via a seeded PRNG so values are stable across renders).

## Data — what's mock vs live (production wiring)
All market data in the prototype is **synthetically generated from a seeded hash** so it's deterministic, EXCEPT:
- **Fear & Greed index:** real fetch from `https://api.alternative.me/fng/?limit=1` (refreshes every 5 min).
- **Company/crypto logos:** `https://icons.duckduckgo.com/ip3/<domain>.ico` for stocks (domain map in `DOMAINS`, falls back to `<symbol>.com`) and `cryptocurrency-icons` CDN for coins; both fall back to a colored monogram tile.

For production, replace the generators with a real quotes/fundamentals/news provider (e.g. Polygon, Finnhub, Alpha Vantage, IEX), portfolio via Plaid/SnapTrade, and news via a headlines API. The **view-model shape** in `renderVals()` is the contract to preserve — feed real data into the same fields.

## Charting
Charts are hand-rolled SVG (candles/line/area, volume bars, crosshair, drag-zoom, treemaps, donut, sparklines, equity curve) sized 1:1 to their container via a ResizeObserver to avoid text distortion. In production, prefer a charting library (Lightweight Charts / TradingView, ECharts, Recharts, or Visx) styled to these tokens; keep the candlestick + EMA + crosshair + compare/normalize + drag-zoom behaviors. Treemaps use a squarified algorithm (`_treemap`).

## Assets
- Fonts: Google Fonts (Sora, JetBrains Mono).
- Logos: DuckDuckGo icon service (stocks) + cryptocurrency-icons CDN (crypto). No bundled image assets; everything else is CSS/SVG. Monogram fallback is generated.

## Files
- `Ticker Tracker.dc.html` — the entire app: a `<helmet>` (fonts, keyframes, resets), an inline-styled template, and a `class Component` logic block (data model `U`/`HM`/`COINS`/`IDX`, generators, `renderVals()` view-model). Read this for exact layout, styles, copy, and behavior.
- `support.js` — the prototype's rendering runtime. **Reference only; do not port.**
