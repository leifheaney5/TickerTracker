# Ticker Tracker — Building a Moat: The Signal Intelligence Layer

> Strategy doc. Author: autonomous overnight run, 2026-06-28. Direction approved by Leif:
> **moat = signal/intelligence layer**, build real ship-ready TDD code on an experimental
> branch (PRs, not merges), honesty enforced (every signal maps to real data — no fiction),
> tests + CI green. Marketing/design scope: brand + visual identity, honest copy/positioning/
> SEO, product/UX (HCI) polish.

---

## 0. Executive summary

Ticker Tracker today is a beautiful, coherent, dark-native tracker for stocks **and** crypto.
That coherence is real and valuable — but it is a *taste* moat, and taste alone is copyable.
The next moat is **insight**: a distinctive, explainable **composite signal** layered on top of
the real data we already pull, plus a **first-party signal history** that no competitor stores
for the user. The combination is defensible in a way a prettier UI is not.

The product thesis in one line:

> **"Every other tracker shows you the market. Ticker Tracker tells you what *changed* and what
> it *means* — in one honest score you can see the math behind."**

This document reviews the app from marketing, human, HCI, and user POVs, states the moat thesis,
and specifies the work. It is grounded in a full inventory of the backend's real data sources
(see §3) so that nothing proposed here is fiction.

---

## 1. End-to-end review (marketing · human · HCI · user)

### 1.1 Marketing POV
**Strengths.** Clear, honest positioning already exists (`docs/market-and-marketing.md`): unified
stocks+crypto, Finviz-style map, news sentiment, analyst ratings, no brokerage required, free to
browse. Real domain (tickertracker.info), OAuth, branded emails, footer/Help — it reads as a real
product, not a toy.

**Gaps.**
- **No reason-to-return narrative.** The marketing leads with *surface* ("clean dark dashboard").
  Surfaces don't retain. There is no "it tells me something I didn't know" hook.
- **No proof of intelligence.** Competitors (VectorVest VST, SentimenTrader Optix, TECHi Formula
  Score) lead with a *signal* you can name. We have sentiment pills but no headline metric to own.
- **SEO is intent-listed but not built.** The market doc names keyword themes; there are no
  programmatic landing pages capturing "is NVDA a buy", "AAPL analyst price target", "crypto fear
  and greed today" long-tail intent.
- **Brand identity is implicit.** Dark theme + tokens exist, but there's no named visual system,
  OG/social cards, or icon story. Shares (PNG export exists) are under-branded as growth surfaces.

### 1.2 Human / emotional POV
Investing apps trade on two emotions: **FOMO** (am I missing something?) and **anxiety** (is my
stuff OK?). Today the app answers *neither* proactively — the user must go look. The intelligence
layer flips this: the app *comes to you* with "3 names on your list shifted bullish; TSLA reports
in 2 days; BTC just hit Extreme Greed." That is the emotional product, and it's the retention loop.

### 1.3 HCI POV
**Strengths.** Centralized design tokens, keyboard shortcuts, a11y pass, responsive, light/dark.

**Gaps.**
- **Cold start.** Starter watchlists help, but the *first 30 seconds* show data, not insight. A
  new user sees a chart — not "here's what's interesting right now."
- **Flat information hierarchy.** Everything is presented at equal weight; nothing says *this
  changed, look here*. No "what's new since you last visited."
- **No explainability surface.** Sentiment is a single pill with no "why." Trust requires the math.
- **Alerts are threshold-only.** Price-cross alerts are commodity. There's no *intelligent* alert
  ("overbought + bearish news + near analyst target" = a divergence worth seeing).

### 1.4 User / jobs-to-be-done POV
The user's real jobs:
1. *"Tell me when something I care about meaningfully changed."* — partially served (price alerts).
2. *"Help me decide if a name is interesting right now."* — **unserved**. This is the moat gap.
3. *"Keep me oriented without me having to dig."* — **unserved** (no proactive intelligence).
4. *"Let me trust what you tell me."* — **unserved** (no explainability).

The signal layer is precisely the set of features that serve jobs 2–4 using data we already have.

---

## 2. The moat thesis

### 2.1 Why "signal/intelligence" is the right moat (research-backed)
- **Insight > data.** Raw data is a commodity; the moat is the analytics/insight layer on top
  (PYMNTS 2026, v7labs, S&P Global on AI-era software moats). Anyone can call Finnhub; few build a
  *trusted, named, explainable* score.
- **Named composite signals win retail.** VectorVest's VST, SentimenTrader's Optix, TECHi's
  Formula Score — each owns a metric users learn and trust. "Double confirmation" across
  indicator *types* (momentum + trend + sentiment + valuation) is more reliable and more
  explainable (multi-indicator composite research, Longbridge/CME technical guides).
- **First-party history is the durable, un-backfillable moat.** Competitors show *today's*
  sentiment; none store *this user's watchlist's* signal trajectory. Sentiment tone-consistency
  over time and price/sentiment **divergence** are exactly the "nuanced signals" sophisticated
  retail now wants (Medium/Janisch 2026; StockCharts; MDPI investor-sentiment study). Every day we
  run, we accrue history nobody can replicate after the fact.
- **Explainability is the trust unlock *and* our honesty guarantee.** A transparent status table
  ("here's each component and its state") improves trust (TECHi, multi-indicator system writeups)
  and structurally prevents fiction — there is no hidden model to fake.

### 2.2 What we will NOT do (honesty + scope guardrails)
- No black-box "AI prediction" or fabricated confidence. Every number traces to a real input.
- No claimed data we don't have (options/IV, short interest, insider flow, real EPS actuals,
  social sentiment) — these are §6 "future, needs a provider," explicitly out of scope tonight.
- No enabling paid enforcement (`BILLING_ENABLED` stays false — separate guardrail, untouched).
- The composite score is framed as **"a transparent summary of public signals,"** never as advice.

### 2.3 The named asset: **Pulse**
A single **Pulse score (0–100)** per ticker, with a labeled band (e.g. Cooling / Neutral /
Building / Hot) and an always-available **"Why" breakdown**. Pulse is computed *only* from real
inputs we already fetch. It becomes the headline metric the brand can own — the "VST of the
honest, unified stocks+crypto tracker."

---

## 3. Real data we can build on (verified inventory)

All confirmed present in `backend/` (providers + services). Pulse and every signal below use ONLY
these — no new providers tonight.

| Signal input | Source (real) | Where | Notes |
|---|---|---|---|
| Quote (price, %chg, OHLC of day, volume) | Finnhub→Yahoo→mock | `services/quotes.py` | 60s cache |
| OHLC history (1D…5Y) | Yahoo | `services/history.py` | enables RSI/MACD/Bollinger/52w-position |
| Fundamentals (P/E, div yield, mkt cap, beta, 52w hi/lo, EPS, sector) | Yahoo | `services/fundamentals.py` | 1h cache |
| News + heuristic sentiment (Bullish/Bearish/Neutral) | Finnhub | `services/news.py` | keyword heuristic; honest if labeled as such |
| Watchlist sentiment aggregate (mood) | Finnhub | `services/news.py::watchlist_sentiment` | already exists — extend it |
| Analyst ratings + consensus + price target (low/mean/high) | Finnhub | `services/ratings.py` | target-distance signal |
| Earnings calendar (date, hour, epsEstimate) | Finnhub | `services/earnings.py` | earnings-proximity signal |
| Crypto quotes, mkt cap, BTC dominance | CoinGecko | `services/crypto.py` | crypto Pulse variant |
| Crypto Fear & Greed (0–100, label) | alternative.me | `services/crypto.py::get_fng` | market-regime input |
| Alerts engine + cooldown + Resend email | — | `services/alerts.py`, `jobs.py` | extend for signal alerts |
| Weekly digest + unsubscribe | — | `services/digest.py` | upgrade to intelligence digest |
| Per-user models (watchlist items, targets, alerts, settings, plan) | Postgres | `models.py` | add signal-history tables |

**Honesty note on sentiment:** today's sentiment is a *headline-keyword heuristic*, not NLP. That's
fine and defensible **as long as we label it** ("based on news-headline language") and never imply
it's a proprietary ML model. The composite Pulse gains its credibility from *breadth across
independent signal types*, not from any single input pretending to be more than it is.

---

## 4. The signal layer — feature set (all on real data)

Ranked by (moat impact ÷ effort). Each is independently shippable and TDD-able.

### F1 — Technical indicators service (foundation) · Med effort
Compute **RSI(14), MACD(12,26,9), Bollinger position, SMA20/50/200 cross, 52-week range
position, volume vs 20-day avg** server-side from existing OHLC history. Pure functions, trivially
unit-testable against known fixtures. No UI yet — it's the substrate for Pulse and signal alerts.

### F2 — **Pulse** composite score + "Why" breakdown (the named moat) · Med effort
A transparent 0–100 score per ticker blending, with published weights:
- **Momentum** (RSI, MACD state) — from F1
- **Trend** (price vs SMA50/200) — from F1
- **Valuation/positioning** (52-week range position; P/E percentile is optional) — F1 + fundamentals
- **Analyst** (consensus + distance to mean target) — ratings
- **Sentiment** (news headline mood) — news, *labeled as headline-based*
- (Crypto variant substitutes F&G + dominance for analyst/valuation, which don't exist for coins)

Output: score, band label, and a **component table** (each input's contribution + raw value).
Exposed at `/api/pulse/<SYM>`. Rendered as a compact dial/bar on the stock card + an expandable
"Why" panel. **This is the brand-ownable metric.**

### F3 — Signal history (the durable first-party moat) · Med effort
A daily cron snapshots **Pulse + sentiment + price** per *actively-watched* symbol into a new
`signal_snapshots` table. Surfaces as: Pulse sparkline ("trending up 5 days"), sentiment-trend
chip, and **"shifted bullish 3 days ago"** annotations. This is the asset competitors cannot
backfill — value compounds the longer the app runs.

### F4 — Divergence & smart signal alerts · Med effort
Extend the alerts engine beyond price thresholds with **explainable, named conditions** built on
F1–F3, e.g.:
- *Price/sentiment divergence* (price up ≥X% while sentiment turned bearish)
- *Overbought + bearish* (RSI>70 and bearish news)
- *Near analyst target* (within X% of mean target)
- *Pulse band change* (crossed from Neutral→Hot)
- *F&G extreme* (crypto regime flip)
Each alert email states *which* condition fired and shows the components (honest by construction).

### F5 — Watchlist Intelligence (proactive digest + "What changed") · Med effort
Upgrade the weekly digest and add an in-app **"What changed since you last visited"** strip:
biggest Pulse movers, sentiment flips, upcoming earnings on your list, names nearest their analyst
target. This is the emotional retention loop (§1.2) — the app *comes to you*.

### F6 — First-30-seconds intelligence (cold-start HCI) · Low–Med effort
On first load / empty state, show **"Interesting right now"** computed from a default universe:
top Pulse movers, F&G regime, names reporting this week. Converts the cold start from "here's a
chart" to "here's what's worth your attention."

---

## 5. Marketing / brand / SEO / UX deliverables (parallel track)

- **Brand & visual identity (M1):** name + define the existing dark system as a real brand
  ("Signal" visual language), Pulse dial as a brand motif, OG/social card templates, app icon
  story, refined type/color scale documented as tokens. Lead the share-PNG with Pulse.
- **Honest copy & positioning (M2):** rewrite landing/hero around the *insight* hook (§0 thesis),
  Pulse as the named metric, "see the math" trust line. Product Hunt kit, honest social posts.
  Strictly maps to shipped behavior.
- **SEO program (M3):** spec (and stub) programmatic pages for high-intent long-tail
  ("<TICKER> signals", "crypto fear and greed today", "<TICKER> analyst price target"), each
  backed by real `/api/pulse`, `/api/ratings`, `/api/fng` data — honest, indexable, and a top-of-
  funnel growth loop. Sitemap + meta/OG.
- **HCI polish (M4):** the "Why" panel interaction, "What changed" strip, empty/cold-start states,
  Pulse dial micro-interaction, accessibility of the new surfaces, mobile layout for Pulse.

---

## 6. Explicitly out of scope tonight (future moats — need a provider)
Options/IV, short interest, insider transactions, real EPS actuals & surprise scoring, social
(X/Reddit/StockTwits) sentiment, earnings-call transcripts, macro (VIX/yields/Fed). Logged to
ROADMAP. Pulse is designed so these slot in as *additional components* later without rework.

---

## 7. Execution plan (overnight, experimental worktree)
1. Isolated worktree + experimental branch `experimental/signal-intelligence` (no auto-merge).
2. Spec → plan per the superpowers flow; then parallel subagent execution:
   - **Build track (TDD):** F1 → F2 → F3 → F4 → F5 → F6, tests-first, CI green at each step.
   - **Design/marketing track (parallel):** M1 brand, M2 copy/positioning, M3 SEO, M4 HCI.
3. Each shippable unit → its own commit; open PR(s) for review. **Do not merge to main.**
4. Keep CHANGELOG + version bumps per workflow preferences. Honesty self-check on every claim.

**Success criteria:** Pulse exists, is explainable, runs on real data only; signal history is
accruing; at least one intelligent alert + the intelligence digest work; brand/copy/SEO/UX
artifacts delivered; all tests green; PRs opened for Leif's review; zero fictional functionality.
