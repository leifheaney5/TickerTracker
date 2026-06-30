# Data-Story / Linkable-Asset Angles

> **DRAFT — angle ideas by `pr-backlink-builder`. Nothing has been built, computed,
> published, or pitched.** This file supplies *angles only*. The actual page/asset
> build is handed to **marketing-strategist** (copy/narrative) + **web-seo-engineer**
> (implementation, charts, OG, schema). I just say what's worth making and who'd link it.
>
> ## Hard constraints
> - **Honesty rule:** every angle uses **only data the product actually ships** —
>   news-headline sentiment (labeled keyword heuristic, *not* ML), analyst ratings +
>   price targets (Finnhub), crypto Fear & Greed (alternative.me), crypto market data +
>   BTC dominance (CoinGecko), and watchlist/quote data. **No Pulse**, no momentum/trend
>   indicators, no signal history, no smart alerts — those aren't live, so no story may
>   depend on them. **No predictions, no advice, no social-media sentiment** (we don't
>   have it). Every published figure must carry its method + date range.
> - **Why data stories:** a genuinely useful, citable data asset is the one thing that
>   earns links from high-DA finance publishers who will *never* add a product link
>   cold. The asset is the bait; the editorial link is the catch.
> - **No fabrication:** the numbers in any published story must be **really computed**
>   from the app's live data before it goes out. The findings below are *hypotheses /
>   formats*, not results. Verify before any pitch (esp. the Daily Upside pitch in
>   `press-and-newsletter-pitches.md`).

---

## What real data we can mine (inventory)

| Signal | Source (shipped) | Story potential |
|---|---|---|
| News-headline sentiment per ticker | `services/news.py` keyword heuristic | "What the headlines actually said" recaps; sentiment-vs-price divergence |
| Analyst ratings + mean price target + distance | Finnhub via `services/ratings.py` | "Where Wall Street's targets sit vs. price" snapshots |
| Crypto Fear & Greed (daily) | alternative.me | Mood timelines; F&G vs. BTC price |
| Crypto market data + BTC dominance | CoinGecko | Dominance shifts; "alt season" framing |
| Starter-watchlist compositions | app templates (Big Tech, AI, Crypto Majors, Dividend) | "What retail watchlists hold" descriptive pieces |
| Sector performance / market map | treemap data | Sector heat recaps |

> All of the above are **descriptive, transparent reads** of public data — not
> forecasts. That framing is the credibility moat: we report what the public signals
> *say*, with the method shown.

---

## Angle 1 — "Headlines vs. the tape": weekly news-sentiment divergence recap

**The asset:** a recurring short recap (and a simple chart) of names where our
**headline-keyword sentiment** most diverged from price over a week — e.g. "covered
positively but fell," and vice versa — across a defined universe (megacaps / a starter
watchlist). Method and date range stated plainly; sentiment labeled as a headline
heuristic.

**Why it's linkable:** newsletters and markets desks love a clean "narrative vs. reality"
angle; it's evergreen-repeatable and inherently honest.

**Who'd plausibly link:** The Daily Upside, Axios Markets-style briefs, retail-investing
Substacks (T6), Rob Berger (T1). Pairs with the **T2 Daily Upside pitch**.

**Honesty notes:** never imply the divergence predicts a move; it's a description of two
independent public signals. Show the keyword method.

---

## Angle 2 — "Where Wall Street's price targets sit": analyst-consensus snapshot

**The asset:** a snapshot of analyst **mean price targets vs. current price** (implied
upside/downside %) across a popular universe, sourced from Finnhub, with the data date
stamped. A clean sortable table + bar chart.

**Why it's linkable:** concrete, sourced, screenshot-friendly; finance writers cite
analyst-target roundups constantly.

**Who'd plausibly link:** StockAnalysis.com-tier data sites, finance newsletters,
WallStreetZen-style roundups.

**Honesty notes:** these are **analysts'** targets, not ours; we're aggregating a public
dataset and citing the source. No "we expect" language. State that targets are opinions, not guarantees.

---

## Angle 3 — "The mood meter": crypto Fear & Greed vs. BTC, a 90-day read

**The asset:** a tidy timeline pairing the **Fear & Greed** index (alternative.me) with
BTC price + **BTC dominance** (CoinGecko) over a window, plus a short plain-English read
of what the mood did around notable moves.

**Why it's linkable:** crypto media love F&G visuals; pairing it with dominance is a
slightly fresher cut than the usual single-line chart.

**Who'd plausibly link:** Ventureburn, NFTPlazas, altFINS/Guardfolio-style crypto blogs
(P3 roundup targets), crypto Substacks.

**Honesty notes:** F&G measures sentiment, not value; explicitly not a trading signal.
Cite alternative.me + CoinGecko.

---

## Angle 4 — "What retail actually watches": a look at starter-watchlist composition

**The asset:** a descriptive piece on the make-up of common retail watchlists, anchored
on our starter templates (Big Tech, AI, Crypto Majors, Dividend) and, if/when there's
enough **opt-in, fully-anonymized, aggregate** data, broad watchlist trends. A simple
"most-watched names" visual.

**Why it's linkable:** "what retail is watching" is a perennial media hook; an honest
indie data point is quotable.

**Who'd plausibly link:** markets newsletters, retail-investing writers, fintech press.

**Honesty + privacy notes:** **only aggregate, anonymized, opt-in** data may ever be
used — never individual users' lists, never anything identifying. If that data isn't
cleanly available and consented, fall back to the *template* compositions only and say
so. Coordinate any user-data use with security-auditor before it leaves the building.

---

## Angle 5 — "Designing a market app that never shows a broken page" (engineering story)

**The asset:** a technical write-up (guest post or own blog) on the **provider-fallback
architecture** — every data source degrades to a deterministic seeded mock, so the UI
stays usable when an upstream API fails — plus the CI-gated deploy pipeline.

**Why it's linkable:** dev-audience evergreen; earns links from engineering blogs,
dev.to/Hashnode, indie-maker communities, and StackShare.

**Who'd plausibly link:** Indie Hackers (T4), dev communities, bootstrapper blogs
(guest-post row #24 in `prospects.md`).

**Honesty notes:** all shipped behavior (per README); frame the seeded mock honestly as a
*fallback for availability*, not as "real-time data" when it's serving.

---

## Angle 6 — "Stocks and crypto in one view": the cross-asset behavior angle

**The asset:** a short, opinionated-but-honest piece on *why* retail increasingly holds
both stocks and crypto and the friction of tracking them in separate apps — using our
unified dashboard as the worked example (not the headline).

**Why it's linkable:** the cross-asset framing is genuinely underserved in "best crypto
tracker" roundups (almost all are crypto-only); gives those editors a reason to mention a
stock+crypto option.

**Who'd plausibly link:** Ventureburn, crypto roundups, fintech newsletters.

**Honesty notes:** a perspective piece grounded in the shipped unified dashboard; no
behavioral claims we can't support — keep it qualitative and honest.

---

## Build & priority guidance (for the next agents)

| Angle | Effort | Link payoff | Data ready today? | Start with |
|---|---|---|---|---|
| 1 — Sentiment divergence | Low–med | High (newsletters) | Yes (compute live) | **Yes — fastest, pairs with T2 pitch** |
| 2 — Analyst targets snapshot | Low | High (data sites) | Yes | **Yes** |
| 3 — Crypto F&G vs BTC | Low | Med–high (crypto blogs) | Yes | Yes |
| 4 — Watchlist composition | Med | Med–high | **Only with opt-in aggregate data** | Defer / template-only fallback |
| 5 — Fallback architecture | Med | Med (dev links) | Yes (it's the README story) | Yes (guest post) |
| 6 — Cross-asset perspective | Low | Med | Yes | Opportunistic |

## Hand-off
- **marketing-strategist:** turn the chosen angle into a narrative + headline; keep the
  honesty framing ("public signals, method shown; not advice").
- **web-seo-engineer:** build the linkable page — chart, on-page SEO, OG card, and (for
  angles 2–3) `Dataset`/`Article` JSON-LD so it's citation- and link-friendly.
- **security-auditor:** must sign off before **any** user/watchlist data (Angle 4) is
  aggregated or published, even anonymized.
- **CRITICAL:** the numbers must be **really computed** from live data before anything is
  pitched or published. These are formats, not findings.
