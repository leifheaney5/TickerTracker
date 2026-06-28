# Ticker Tracker — SEO & Growth Program

> Deliverable M3 of the signal-intelligence track (see
> `docs/strategy/2026-06-28-moat-signal-intelligence.md`). Author: autonomous overnight run,
> 2026-06-28. **Scope of this doc:** an *honest*, real-data-backed programmatic-SEO program that
> turns the new **Pulse** signal layer plus existing endpoints into a top-of-funnel growth loop —
> without a single fabricated metric or doorway page.
>
> **Hard ground truth (verified in code):**
> - One Flask service (`backend/app.py`, `static_folder=None`) serves the built Vite SPA from
>   `frontend/dist` **and** all `/api/*` endpoints. Catch-all `@app.route("/<path:path>")` returns
>   `index.html` for any non-API path that isn't a real file (client-side routing). Real files in
>   `frontend/dist` (copied from `frontend/public`) are served directly — this is why
>   `robots.txt` and `sitemap.xml` already work as static files.
> - Real endpoints today: `/api/quotes`, `/api/history/<sym>`, `/api/fundamentals/<sym>`,
>   `/api/crypto`, `/api/fng`, `/api/news`, `/api/sentiment`, `/api/earnings`, `/api/ratings/<sym>`.
>   The signal track adds `/api/pulse/<SYM>`.
> - Response envelope: `{ "data": ..., "meta": { "source", "stale", "fetched_at" } }`. The
>   `source`/`fetched_at` fields are gold for honesty — every page can cite *where* and *when* its
>   data came from.
> - Existing SEO assets: `frontend/public/robots.txt` (Allow all + sitemap ref) and a **static,
>   hand-written** `frontend/public/sitemap.xml` listing 6 app routes. The current SPA is a single
>   `index.html` with one global title/description/OG set — **no per-page meta**. That is the core
>   SEO gap this program fixes.
>
> **This is a spec, not an implementation.** Per the M3 brief, it creates only this one file and
> edits nothing else. Phase 1 (§4) is the low-risk slice the build track can pick up.

---

## 0. Strategy in one line

> **Own the high-intent long-tail that our real data can answer better and more honestly than a
> cluttered incumbent — one indexable, server-meta'd page per ticker, anchored by the Pulse score
> and a transparent "why," each link a top-of-funnel entrance to the app.**

We are not trying to out-rank Yahoo on `AAPL stock`. We target *question-shaped, decision-shaped*
long-tail where (a) intent is high, (b) we have **real** data to answer it, and (c) the Pulse
"see-the-math" angle is a genuine differentiator. Every page must pass one test: **could a human
who landed here say "this answered my question with real, dated data"?** If not, it doesn't ship.

---

## 1. Keyword / intent map (high-intent long-tail, each backed by a real endpoint)

Building on the three keyword themes already in `docs/market-and-marketing.md` (all-in-one
stock+crypto tracker; free market heatmap / Finviz alternative; free watchlist + alerts), this
adds **decision-intent clusters** that the signal layer uniquely lets us answer honestly.

Legend — **Intent:** I = informational, N = navigational, C = commercial-investigation.
Every cluster names the **real backing endpoint(s)** and the **page template** that renders it.

### Cluster A — "<TICKER> signals / pulse" (the brand-ownable moat term)
- **Queries:** `nvda signals`, `is tsla a buy signal`, `aapl momentum signal`, `<ticker> pulse
  score`, `<ticker> technical signals today`.
- **Intent:** C — user is mid-decision, wants a synthesized read, not raw OHLC.
- **Real backing:** `/api/pulse/<SYM>` (score + band + component table) + `/api/history` (the OHLC
  the indicators are computed from). Honest because the page shows the *component breakdown* and
  the published weights — no black box.
- **Page template:** `Signals` template → `/signals/<TICKER>` (§2.1). Pulse dial, component table
  (RSI/MACD/trend/52w-position/analyst/sentiment, each with raw value + contribution), "as of"
  timestamp from `meta.fetched_at`.
- **Why we can win it:** essentially nobody owns "<ticker> pulse" and the named-composite angle
  (VST/Optix/Formula Score) is proven to capture branded long-tail. Low competition, high
  differentiation.

### Cluster B — "is <TICKER> overbought / oversold" + "<TICKER> RSI"
- **Queries:** `is nvda overbought`, `aapl rsi today`, `tsla rsi 14`, `is bitcoin overbought`,
  `<ticker> oversold`.
- **Intent:** I→C — classic technical-question intent with strong, recurring search volume.
- **Real backing:** F1 technical-indicators service (RSI(14), MACD, Bollinger, SMA cross,
  52-week-range position) computed server-side from `/api/history`, surfaced via the Pulse
  component table / a dedicated `/api/pulse/<SYM>` field.
- **Page template:** same `Signals` template, with an RSI-forward H1 and an FAQ block
  ("What does an RSI of 72 mean?") that is *educational*, not fabricated. The number itself is
  real and dated.
- **Why honest:** RSI is a deterministic function of price history. We show the value, the period,
  the source, and the date. No interpretation is presented as a prediction.

### Cluster C — "<TICKER> analyst price target / consensus"
- **Queries:** `aapl analyst price target`, `nvda price target 2026`, `tsla analyst rating
  consensus`, `<ticker> wall street price target`.
- **Intent:** C — high commercial intent, strong existing volume, directly buy/sell-adjacent.
- **Real backing:** `/api/ratings/<SYM>` (Finnhub: consensus + low/mean/high target + buy/hold/sell
  distribution). Pair with `/api/quotes` to show **distance to mean target** (real arithmetic on
  two real numbers).
- **Page template:** `Signals` template, "Analyst" section promoted: consensus label, target
  low/mean/high, current price, % to mean target, rating distribution bar. JSON-LD optional and
  only if we can map it honestly (§3.4 — we lean conservative here).
- **Why honest:** these are aggregated third-party analyst figures attributed to the provider with
  a fetch date; we never present them as *our* recommendation.

### Cluster D — "crypto fear and greed today" (highest-volume single page)
- **Queries:** `crypto fear and greed index today`, `bitcoin fear and greed`, `is the market
  greedy right now`, `crypto sentiment today`.
- **Intent:** I — huge, daily-recurring, evergreen informational volume; a single canonical page.
- **Real backing:** `/api/fng` (alternative.me: 0–100 value + label) + `/api/crypto` (BTC
  dominance, majors) for supporting context.
- **Page template:** dedicated `Crypto F&G` template → `/crypto/fear-and-greed` (one page, not
  programmatic). Big dial, today's value + label, "as of" date, short honest explainer of what the
  index is and who computes it (attribution to alternative.me).
- **Why we can win it:** evergreen, updates daily (freshness signal), and we already render this
  beautifully in-app. One strong canonical page > thin per-day pages.

### Cluster E — "<TICKER> earnings date / when does <TICKER> report"
- **Queries:** `nvda earnings date`, `when does aapl report earnings`, `<ticker> next earnings`,
  `tsla earnings this week`.
- **Intent:** I→N — recurring, calendar-driven, high intent near report dates.
- **Real backing:** `/api/earnings` (Finnhub: date, hour, epsEstimate). **Honesty guard:** we have
  *estimates and dates only* — NOT actual EPS or surprise (explicitly out of scope, strategy §6).
  The page shows date + estimate, clearly labeled "estimate," and never invents an actual.
- **Page template:** an **earnings panel within** the `/signals/<TICKER>` page (not a separate
  thin page per ticker) plus the existing `/earnings` calendar hub as the internal-link anchor.

### Cluster F — existing brand/category themes (keep, already in market doc)
- **All-in-one stock+crypto tracker / Finviz alternative / free watchlist + alerts.** These map to
  the **home, /market (map), /crypto** marketing surfaces — not programmatic. Keep their copy
  honest and ensure each has its own server-rendered title/description (Phase 1 fixes the SPA's
  single-meta problem for these too).

**Cluster prioritization (impact ÷ effort):** D (one page, huge evergreen volume) → A+B (Pulse/RSI,
the moat term, programmatic) → C (analyst targets, high volume) → E (earnings, recurring). F is
copy-only and handled by the brand/copy track (M2).

---

## 2. Programmatic-page spec (honest, indexable, not thin)

### 2.1 URL structure (chosen)

| Pattern | Type | Backing data | Notes |
|---|---|---|---|
| `/signals/<TICKER>` | Programmatic, per stock | `/api/pulse`, `/api/ratings`, `/api/earnings`, `/api/news`, `/api/quotes` | The flagship. Clusters A, B, C, E in one rich page. |
| `/signals/crypto/<COIN>` | Programmatic, per coin | `/api/pulse` (crypto variant), `/api/crypto`, `/api/fng` | Crypto Pulse substitutes F&G + dominance for analyst/valuation (strategy §F2). |
| `/crypto/fear-and-greed` | Single evergreen page | `/api/fng`, `/api/crypto` | Cluster D. The big winner. |
| `/signals` | Hub / index | `/api/pulse` over a curated universe | Lists top Pulse movers; internal-link spine to all `/signals/<TICKER>`. |

**Why `/signals/<TICKER>` (not `/stock/<TICKER>` or `/<TICKER>`):**
- A `signals/` namespace stakes the brand-ownable term (Cluster A) into the URL itself.
- It avoids colliding with the SPA's existing app routes (`/dashboard`, `/market`, `/crypto`,
  `/earnings`, `/screener`) — important because the Flask catch-all serves the SPA for any unknown
  path, so a public-page namespace must be unambiguous to the prerender/meta layer (§3.5).
- Ticker is uppercased and validated with the **existing** `valid_symbol()` guard already used by
  every `/api/*/<sym>` route — reuse it so we never mint a page for a junk symbol.

**Generation universe (avoids the infinite-thin-page trap):** do **not** generate a page for every
symbol that exists. Generate only for a **curated, bounded universe** where we reliably have real
data: the union of (a) the app's starter-watchlist symbols (Big Tech / AI / Crypto Majors /
Dividend), (b) symbols with live analyst ratings + news from Finnhub, (c) crypto majors CoinGecko
covers. This is a few hundred high-quality pages, not a spam farm — directly the anti-thin posture
Google asks for (§5).

### 2.2 Per-ticker page template (`/signals/<TICKER>`)

Content blocks, all from real endpoints, top to bottom:

1. **H1 + Pulse hero** — `"<Company> (<TICKER>) Signals — Pulse <score>/100 (<band>)"`. Renders the
   Pulse dial. The score and band come straight from `/api/pulse/<SYM>`.
2. **"As of" line** — `"Data as of <meta.fetched_at>, source: <meta.source>."` Built directly from
   the envelope. This single line is the honesty backbone and a freshness signal for crawlers.
3. **Why panel (component table)** — each Pulse input (RSI, MACD state, trend vs SMA50/200,
   52-week-range position, analyst distance, news-headline sentiment) with **raw value +
   contribution + the label that it's headline-based for sentiment**. This is the anti-thin payload:
   unique, real, per-ticker, and genuinely useful.
4. **Analyst section** (Cluster C) — consensus, target low/mean/high, % to mean target, rating
   distribution. From `/api/ratings`.
5. **Earnings panel** (Cluster E) — next date + EPS *estimate*, labeled "estimate." From
   `/api/earnings`.
6. **Recent news** — 3–5 latest headlines + heuristic sentiment pill, each **labeled
   "headline-based sentiment"** and linked to the source. From `/api/news`.
7. **Honest disclaimer** — "Ticker Tracker summarizes public signals for information only. Not
   investment advice." (Strategy §2.2.)
8. **Internal-link footer** — links to `/signals` hub, peers in the same sector, `/crypto/fear-and-greed`,
   and an in-app CTA ("Add <TICKER> to your watchlist →" → drives signup, the conversion moat).

**Thin-content floor:** if `/api/pulse/<SYM>` returns a fallback/mock source (envelope
`meta.source` indicates seeded mock) **or** the symbol has no ratings AND no news, the page is
**not added to the sitemap and emits `<meta name="robots" content="noindex,follow">`**. It can still
render for a direct visitor, but it will not be presented to search as indexable. Real data is the
gate to indexability.

### 2.3 Title / meta / OG patterns (per template)

`/signals/<TICKER>`:
- `<title>`: `"<TICKER> Signals — Pulse Score, RSI, Analyst Target | Ticker Tracker"`
- `meta description`: `"<Company> (<TICKER>) Pulse score, RSI, MACD, analyst price target, and
  latest news sentiment — one honest, transparent read, updated <date>."`
- `og:title` / `og:description`: mirror the above; `og:type=website`.
- `og:image`: **dynamic Pulse OG card** (see §3.3) — `/og/signals/<TICKER>.png` showing the dial +
  score + band. Falls back to the static brand card if the dynamic card is unavailable.
- `twitter:card=summary_large_image` for these pages (richer than the site default `summary`).

`/crypto/fear-and-greed`:
- `<title>`: `"Crypto Fear & Greed Index Today — <value> (<label>) | Ticker Tracker"`
- `description`: `"Today's crypto Fear & Greed Index: <value>/100 (<label>), with BTC dominance and
  major-coin context. Updated daily. Source: alternative.me."`
- `og:image`: dynamic F&G dial card.

### 2.4 Canonical + internal-linking strategy

- **Canonical:** every programmatic page self-canonicals to its clean URL
  (`https://tickertracker.info/signals/<TICKER>`), uppercase ticker, no query strings. Lowercase or
  alternately-cased requests **301 to the canonical case** (or at minimum emit a canonical tag) so
  `/signals/nvda` and `/signals/NVDA` don't split. The crypto F&G page is its own canonical (one
  page, never per-day URLs — avoids near-duplicate proliferation).
- **Internal linking (the link spine):**
  - `/signals` hub links to every indexable `/signals/<TICKER>` (flat, crawlable).
  - Each ticker page links to **sector/theme peers** (e.g. AI names link to each other) using the
    starter-watchlist groupings — real topical clusters, not random.
  - Cross-link the evergreen `/crypto/fear-and-greed` from every crypto signal page and the home.
  - The existing app nav (`/dashboard`, `/market`, `/earnings`) links *into* the public pages where
    honest (e.g. the `/earnings` calendar deep-links to `/signals/<TICKER>`).
- **No orphan pages:** anything in the sitemap must be reachable from the `/signals` hub.

---

## 3. Technical SEO checklist

### 3.1 sitemap.xml — from hand-written to generated

Today `frontend/public/sitemap.xml` is static and lists 6 app routes. Plan:

- **Generate, don't hand-maintain.** Add a Flask route **`/sitemap.xml`** (served by the same single
  service) that builds the sitemap at request time (or from a cached, cron-refreshed file) from:
  the static app/marketing routes + the **bounded, indexable** `/signals/<TICKER>` universe (§2.1)
  filtered by the thin-content floor (§2.2). Use `<lastmod>` from the freshest `meta.fetched_at` and
  honest `<changefreq>` (signals: `daily`; F&G: `daily`; marketing pages: `weekly`).
- A Flask route **takes precedence is NOT automatic** — the SPA catch-all `@app.route("/<path:path>")`
  would otherwise serve a built `sitemap.xml` static file if one exists in `dist`. Decision: either
  (a) **drop the static file** and own `/sitemap.xml` via an explicit Flask route declared *before*
  the catch-all (Flask routing prefers the specific rule), or (b) keep generating the file at build
  time. **Recommended: explicit Flask route** — it stays fresh as the universe changes and reuses the
  live data layer. If the universe grows past ~50k URLs, split into a sitemap index.
- Keep `robots.txt` pointing at `https://tickertracker.info/sitemap.xml` (already correct).

### 3.2 robots.txt

Current file (`Allow: /` + sitemap ref) is fine. Additions to consider:
- Keep `/api/` **out of the index** without blocking it for the prerender layer. The envelope JSON
  should not rank — add `Disallow: /api/` to robots (the API is data, not content). The HTML pages
  that *use* the API stay allowed.
- Do **not** disallow `/og/` (OG card images must be fetchable by social crawlers).
- Leave `/s/<token>` shared-watchlist links allowed but consider `noindex` on them (user-generated,
  potentially thin/duplicate) — they're share links, not SEO targets.

### 3.3 Open Graph / Twitter card defaults + dynamic cards

- **Site defaults** already exist in `index.html` (global title/desc/OG/Twitter `summary`). Keep as
  the fallback for any route without specific meta.
- **Dynamic OG cards** for programmatic pages: a Flask route `/og/signals/<TICKER>.png` that renders
  the Pulse dial + score + band server-side (Pillow, or a small headless render). Honest by
  construction — it shows the same real number as the page. Cache aggressively (Pulse changes at
  most daily). Fall back to the static brand card on any error so a page never ships a broken image.
- Upgrade programmatic pages to `twitter:card=summary_large_image`; keep `summary` site-wide.

### 3.4 Structured data (JSON-LD) — conservative + honest only

Add JSON-LD **only where it maps cleanly to a real, standard schema** — never to dress up thin
content. Schema.org has no first-class "stock signal" type, so we stay conservative:

- **`WebSite` + `Organization`** (site-wide, in `index.html`): name, url, logo, sameAs. Safe,
  honest, enables sitelinks search box if we want it.
- **`BreadcrumbList`** on programmatic pages (`Home › Signals › <TICKER>`): trivially honest,
  improves SERP presentation.
- **`FAQPage`** on the RSI/overbought sections (Cluster B) **only if** the Q&A is genuinely on-page
  and educational (e.g. "What is RSI?"). Do not fabricate Q&A to farm rich results.
- **`Dataset`** for `/crypto/fear-and-greed` is *defensible*: it genuinely is a published dataset
  (creator: alternative.me, measurement: 0–100, temporal: daily). Use `Dataset` with honest
  `creator`/`temporalCoverage`/`distribution` attribution — this is the one place structured data
  is a clean fit.
- **Avoid** `FinancialProduct`, `Rating`/`AggregateRating`, and any `Product` review markup on
  ticker pages — those imply *we* are rating a security/product and risk both dishonesty and a
  manual action. Analyst figures are attributed third-party data in plain HTML, not marked-up
  ratings.

### 3.5 Performance + SSR/prerender for the Vite SPA (the crucial decision)

**The problem:** the SPA ships one `index.html` with global meta. The Flask catch-all serves that
same HTML for `/signals/NVDA`, so today **every page would get identical title/meta/OG** and the
real Pulse content only appears after JS runs. Google *can* render JS, but per-page meta and OG
(needed for Twitter/Slack/Discord unfurls, which do **not** run JS) require HTML that already
contains the right tags.

**Options evaluated against THIS stack (single Flask + Vite SPA, no Node SSR server in prod):**

1. **Full SSR (Next.js / Node render server).** Rejected — would mean introducing a Node runtime in
   production alongside Flask, contradicting the "one process" architecture. Too heavy for the goal.
2. **Build-time prerender (vite + `vite-plugin-ssr`/`react-snap`/`puppeteer` over the bounded
   universe).** Viable but the universe is data-dependent and changes daily; rebuilding the SPA to
   refresh Pulse numbers is the wrong cadence.
3. **★ Recommended: Flask-side HTML meta injection / lightweight server render for the public
   namespaces.** For `/signals/*` and `/crypto/fear-and-greed`, add **explicit Flask routes (before
   the SPA catch-all)** that:
   - fetch the same data the API returns (reuse `get_pulse`, `get_ratings`, `get_fng` — no new data
     path),
   - take the built `index.html` as a template and **inject per-page `<title>`, `<meta>`, OG/Twitter
     tags, JSON-LD, and a server-rendered `<noscript>`/SSR HTML block** containing the real Pulse
     score, component table, analyst target, and news (so the indexable, unfurl-able content is in
     the initial HTML),
   - then hand off to the existing React app for full interactivity (hydration-friendly: the SPA
     mounts and enriches the same content).

   This fits the stack perfectly: **still one Flask process**, no new runtime, reuses the live data
   layer and the existing `valid_symbol()` guard, and Flask route specificity means `/signals/<t>`
   resolves to the meta-injecting handler instead of the dumb catch-all. Cache the rendered HTML per
   ticker (same daily cadence as Pulse) to keep it fast.

   Minimal honest variant for Phase 1: inject **just the meta/OG/JSON-LD** (cheap, big SEO/unfurl
   win) and let React render the body. Full server-rendered body is a fast-follow once meta is live.

**Performance notes (SPA hygiene that helps rankings):**
- Vite already code-splits; ensure the `/signals/*` initial payload isn't the whole app — lazy-load
  heavy chart components below the fold.
- Serve `dist` assets with long cache headers + content hashing (Vite default); ensure Flask
  `send_from_directory` sets sane caching for hashed assets.
- Core Web Vitals: the Pulse dial + "as of" line + component table should be in the initial HTML
  (option 3) so LCP isn't gated on JS. Preconnect to font origin (already `font-src` configured).
- Keep the existing CSP intact; the meta-injection approach adds no new external origins.

---

## 4. Phase 1 — the low-risk shippable slice

A concrete, honest, non-overpromising first cut the build track can ship **after `/api/pulse`
exists** (F2). Each item is independently valuable and reversible:

1. **Generated `/sitemap.xml` Flask route** (replaces the static file): static app/marketing routes
   + the bounded indexable `/signals/<TICKER>` universe, filtered by the thin-content floor, with
   honest `<lastmod>`. Declared before the SPA catch-all. **Low risk, no UI change.**
2. **Per-page meta injection for `/signals/<TICKER>` and `/crypto/fear-and-greed`** (option 3,
   minimal variant): explicit Flask routes that inject real per-page `<title>`/description/OG/Twitter
   + `BreadcrumbList` JSON-LD into the existing `index.html`, then serve the SPA. The body still
   renders client-side; this alone fixes the "every page has identical meta" defect and makes social
   unfurls show the real Pulse score. **Highest SEO ROI for the least code.**
3. **Thin-content guard wired in:** a symbol whose Pulse is mock-sourced or has no ratings+news is
   excluded from the sitemap and gets `noindex,follow`. Ships *with* item 1 so we never expose a
   thin page. **This is the honesty gate, not optional.**
4. **`robots.txt` tweak:** add `Disallow: /api/` (data, not content); keep sitemap ref.

**Explicitly deferred (don't overpromise):** full server-rendered page body (option 3 full),
dynamic `/og/*.png` cards, `Dataset` JSON-LD, FAQ markup, the `/signals` hub page, crypto
`/signals/crypto/<COIN>` programmatic set. All are fast-follows once Phase 1 proves the meta/sitemap
plumbing.

**Success check for Phase 1:** `curl https://tickertracker.info/signals/NVDA` returns HTML whose
`<title>` and OG tags contain NVDA's real Pulse/analyst data; `/sitemap.xml` lists only
real-data-backed tickers; a mock/empty symbol is `noindex`. No fabricated numbers anywhere.

---

## 5. Honesty guard (non-negotiable, applies to every page)

Google's stance is explicit: **"spammy automatically-generated content"** and **doorway/thin
pages** with little original value are a spam-policy violation that can trigger ranking suppression
or manual actions. The fix is not "fewer pages" — it's that **each page must offer real,
substantive, original value**. This program is built to clear that bar:

- **Real data is the gate to indexability.** A page is only added to the sitemap and left indexable
  if its Pulse comes from real sources (envelope `meta.source` is not the seeded mock) and it has
  genuine analyst/news/indicator content. Otherwise: `noindex,follow` and excluded from sitemap.
  (§2.2 thin-content floor.)
- **Bounded universe, not a symbol farm.** We generate a few hundred curated, data-rich pages, not
  one per every conceivable ticker. No infinite long-tail of empty shells. (§2.1.)
- **Every number is sourced and dated.** The "as of `<fetched_at>`, source `<source>`" line and
  per-component raw values mean a reader (and a quality rater) can see exactly where each figure came
  from. The Pulse "why" table is original, per-ticker synthesis — the opposite of scraped boilerplate.
- **No fabricated metrics, ever.** Sentiment is labeled "headline-based," earnings EPS is labeled
  "estimate" (we have no actuals — strategy §6), analyst figures are attributed third-party data. No
  invented confidence, no fake predictions, no "AI score" with no math behind it.
- **No doorway pages.** Each `/signals/<TICKER>` is a genuine destination answering the query, not a
  thin gateway funnelling to a single signup page. CTAs are present but secondary to real content.
- **Conservative structured data.** JSON-LD only where it maps to a real schema honestly (§3.4);
  no `AggregateRating`/`Product` markup implying we rate securities.
- **De-dupe by design.** Self-canonicals, single canonical F&G page (no per-day duplicates), case
  normalization — no near-duplicate clutter.

If a page can't be made to clear this bar with real data, **it does not ship.** That constraint is
the same one that makes the underlying product honest (strategy §2.2) — SEO inherits the product's
integrity rather than fighting it.

---

## 6. Summary for the orchestrator

- **URL structure chosen:** `/signals/<TICKER>` (flagship programmatic, stocks),
  `/signals/crypto/<COIN>` (crypto Pulse), `/crypto/fear-and-greed` (single evergreen, Cluster D),
  `/signals` (hub / internal-link spine). Ticker uppercased + validated via the existing
  `valid_symbol()` guard; bounded curated universe only.
- **Phase-1 shippable (after `/api/pulse` lands):** (1) generated `/sitemap.xml` Flask route, (2)
  per-page meta/OG/JSON-LD injection for `/signals/<TICKER>` + `/crypto/fear-and-greed`, (3)
  thin-content `noindex` guard, (4) `robots.txt` `Disallow: /api/`. No UI rewrite, reuses the live
  data layer, fits the single-Flask-process architecture.
- **SSR/prerender recommendation:** do **not** add a Node SSR server. Use **Flask-side per-page meta
  injection (and, as a fast-follow, a server-rendered body block) on explicit `/signals/*` and
  `/crypto/fear-and-greed` routes declared before the SPA catch-all**, reusing the existing data
  services. One process, no new runtime, real per-page meta for crawlers and social unfurls, React
  hydrates on top. Phase 1 ships the meta-only variant for maximum ROI at minimum risk.
- **Honesty:** real data gates indexability; mock/empty pages are `noindex` and excluded from the
  sitemap; every metric is sourced + dated; no fabricated numbers, no doorway/thin pages — directly
  compliant with Google's auto-generated-content spam policy.
