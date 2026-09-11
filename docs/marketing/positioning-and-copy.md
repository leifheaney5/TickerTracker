# Ticker Tracker — Positioning & Copy

> DRAFT material in Leif's voice. Calm, precise, confident-without-hype. Every claim here maps to
> shipped behavior (see §6 Honesty checklist). Grounded in:
> `docs/strategy/2026-06-28-moat-signal-intelligence.md`, `docs/market-and-marketing.md`, and
> `README.md`.

> **Update 2026-06-30 — Pulse is live in production.**
> Core Pulse confirmed shipped via code review: the 0–100 composite score (`/api/pulse/<sym>`,
> `compute_pulse()` in `backend/services/pulse.py`), the "Why" panel (`PulseWhy.tsx` with full
> component breakdown), and the momentum/trend inputs (RSI via `_momentum()`, SMA50/200 + MACD via
> `_trend()`). All `[ships when Pulse lands]` tags have been removed from those features.
>
> Sub-features that remain gated (do not use in live copy until confirmed):
> - **Crypto Pulse variant** (Fear & Greed + BTC dominance substitution) — no crypto branch found
>   in `pulse.py`; `compute_pulse()` always returns `kind: "stock"`. Leif to confirm before
>   un-gating.
> - **Pulse history / sparkline / "shifted N days ago"** (F3) — backend + frontend code exists but
>   not confirmed live on production data.
> - **Smart / divergence signal alerts** (F4) — `signal_alerts.py` and `SignalChips.tsx` exist but
>   not confirmed live on production data.
> - **"What changed since you last visited" strip** (F5) — no code found.

---

## 1. Positioning statement

**The insight hook, one line:**

> **Every other tracker shows you the market. Ticker Tracker tells you what *changed* and what it
> *means* — for the stocks and crypto you actually care about, in one honest score you can see the
> math behind.**

**Expanded positioning.**
Ticker Tracker is a clean, dark dashboard that unifies stocks and crypto in one surface — a curated
watchlist, a Finviz-style market map, news sentiment, and analyst ratings, free to browse, no
brokerage required. What sets it apart isn't another chart: it's **Pulse**, a single transparent
score per ticker that reads momentum, trend, analyst consensus, and news-headline sentiment and
tells you, in one number with a labeled band, whether a name is heating up or cooling off — with a
"Why" panel that shows every component and its raw value. No black box, no predictions, no advice.
Just the public signals, summarized honestly, with the math in plain sight.

**Who it's for.** People who hold both stocks and crypto, are tired of tab-hopping between Yahoo,
Finviz, and a coin app, and want a calm signal-over-noise read instead of a social feed or a pro
terminal they have to learn.

**Why it's defensible.** Anyone can pull the same raw data. Few build a *named, explainable,
trusted* score on top of it — and none store *your* watchlist's signal history over time. Taste is
copyable; an honest insight layer that compounds the longer it runs is not.

---

## 2. Landing hero

### Headline
> **See what changed. Understand what it means.**

(Alternate, Pulse-forward: **"One honest score for every ticker you watch."**)

### Subhead
> Ticker Tracker unifies your stocks and crypto in one dark dashboard — then reads the public
> signals for you and shows the math. No predictions. No advice. Just what moved, and why it
> matters.

### Three supporting value props

1. **One score, fully transparent.** Pulse blends momentum, trend, analyst consensus, and
   news-headline sentiment into a single 0–100 read with a clear band — and a "Why" panel that
   breaks down every input. You never have to trust a number you can't inspect.

2. **Stocks and crypto, one surface.** A curated watchlist, a Finviz-style market map, sector
   performance, and a live crypto Fear & Greed index — together, in one clean dark UI. No brokerage,
   no clutter, free to browse.

3. **It comes to you.** Arm price alerts on any name and get an email the moment a target is hit,
   plus a weekly digest of your watchlist. Stay oriented without digging. *(Smart, signal-based
   alerts — divergence, band changes — **ship when F4 lands.**)*

### "How Pulse works" — honest explainer

> Pulse is a transparent summary of public signals, not a prediction and not advice. For each
> ticker it reads four things we already pull from real data sources: **momentum** (RSI and MACD
> state from price history), **trend** (price relative to its moving averages), **analyst**
> consensus and distance to the mean price target, and **sentiment** — which is based on the
> language in recent news *headlines*, a keyword read, not a machine-learning model. We combine
> these with published weights into a 0–100 score and a labeled band (Cooling / Neutral / Building
> / Hot), and we show you every component and its raw value in the "Why" panel. For crypto, where
> analyst targets don't exist, Pulse substitutes the market's Fear & Greed reading and BTC
> dominance. The point isn't a magic number — it's breadth across independent signals, with nothing
> hidden.

---

## 3. Taglines

Pulse-led (new):
1. **"One honest score, with the math in plain sight."**
2. **"See what changed. Understand what it means."**
3. **"The signal, not the noise — and the receipts."**
4. **"Every ticker, read for you. Nothing hidden."**

Unified stocks+crypto (remixed from existing):
5. **"Stocks and crypto. One clean, dark dashboard."**
6. **"Track the market you actually care about."**
7. **"The market, minus the noise."**

> Recommended primary: **#2** for the brand line, **#1** as the Pulse sub-line.

---

## 4. Product Hunt launch kit

### Tagline (60-char limit)
> **One honest, transparent score for the stocks and crypto you watch.**

(Backup, no-Pulse-dependency: *"A clean dark dashboard for the stocks and crypto you care about."*)

### First comment — maker story

> Hi Product Hunt — Leif here.
>
> I built Ticker Tracker because I was tired of bouncing between Yahoo, Finviz, and a crypto app
> just to keep an eye on a handful of names — and because every "signal" in those tools is either
> buried or a black box.
>
> So it does two things. First, it unifies stocks and crypto in one dark dashboard: a curated
> watchlist with targets and email alerts, a Finviz-style market map, sector performance, news
> sentiment, analyst ratings, and a live crypto Fear & Greed index. Free to browse, no brokerage
> required.
>
> Second — and this is the part I care about — it reads the public signals for you and shows the
> math. **Pulse** is one transparent 0–100 score per ticker that blends momentum, trend, analyst
> consensus, and news-headline sentiment, with a "Why" panel that breaks down every input and its
> raw value. It is explicitly *not* a prediction and *not* advice. The sentiment piece is a
> headline-keyword read, and I label it as exactly that. The whole design rule is: if I can't show
> you where a number comes from, it doesn't ship.
>
> It runs on real data (Finnhub, Yahoo, CoinGecko, alternative.me) with graceful fallbacks, it's
> fully tested with CI, and it's live at tickertracker.info.
>
> Honest caveat: it's an indie project, not a pro terminal — it won't out-chart TradingView or
> out-screen Finviz, and it doesn't do brokerage sync, options, or predictions. It's the calm,
> honest tracker I wanted for myself. Would genuinely love feedback on Pulse and the watchlist flow.

### Gallery caption ideas
1. **"Pulse: one score, fully shown."** — the dial + "Why" component table on a stock card.
2. **"Stocks and crypto in one map."** — the market treemap beside the crypto map with Fear & Greed.
3. **"Your watchlist, your alerts."** — curated watchlist with per-row target arming.
4. **"Read the mood, not the feed."** — per-watchlist sentiment "mood" chips.
5. **"It emails you when it matters."** — a price-hit alert email + the weekly digest.
6. **"Dark by default, light if you like."** — theme toggle, same surface.

---

## 5. Social posts (value-first, no hype)

### X / Twitter — Pulse intro
> Most trackers show you a number and hide how they got it.
>
> Ticker Tracker's Pulse is one 0–100 score per ticker — momentum, trend, analyst consensus, and
> news-headline sentiment — and it shows you every component and raw value behind it.
>
> Not a prediction. Not advice. Just the public signals, summarized honestly.
>
> tickertracker.info

### X / Twitter — ships-today version (no Pulse dependency)
> I track stocks and crypto in the same dark dashboard now instead of three tabs.
>
> Curated watchlist + email price alerts, a Finviz-style market map, news sentiment, analyst
> ratings, and a live crypto Fear & Greed index. Free to browse, no brokerage required.
>
> tickertracker.info

### Reddit (r/stocks or r/investing) — value-first
> *Read each subreddit's self-promotion rules before posting; some require a flair, a set ratio of
> contribution to promo, or only allow this in a designated thread. Lead with the build story, not
> the link.*
>
> I got tired of every "signal" in retail trackers being either buried or a black box, so I built
> one that shows its work. It reads four public signals for a ticker — momentum, trend, analyst
> consensus, and news-headline sentiment — and rolls them into a single transparent score, with a
> panel that breaks down each input and its raw value. The sentiment part is a headline-keyword
> read and I label it as that, not as some ML model. It's explicitly not a prediction and not
> advice.
>
> It also just unifies stocks and crypto in one dark dashboard (watchlist, market map, alerts).
> Free to browse. I'd genuinely value feedback on whether the score's breakdown actually feels
> trustworthy vs. hand-wavy.

---

## 6. Honesty checklist — claim → shipped behavior

| Marketing claim | Maps to (real shipped behavior / source) | Status |
|---|---|---|
| Unified stocks + crypto in one dark dashboard | Dashboard, Map, Crypto world, Sectors — README §Features | **Shipped** |
| Curated watchlist with targets | "Manage Watchlist" bulk add + per-row targets — README | **Shipped** |
| Email price alerts when a target is hit | "Price Alerts & Digest" via Resend + Railway cron — README | **Shipped** |
| Weekly watchlist digest | Weekly digest via Resend — README; `services/digest.py` | **Shipped** |
| Finviz-style market map | Market overview / treemap Map — README | **Shipped** |
| Live crypto Fear & Greed index | alternative.me via `services/crypto.py::get_fng` — strategy §3 | **Shipped** |
| News sentiment "mood" chips | `services/news.py` keyword heuristic — strategy §3 | **Shipped (labeled heuristic)** |
| Analyst ratings + price targets | Finnhub via `services/ratings.py` — strategy §3 | **Shipped** |
| No brokerage required, free to browse | Freemium auth model — README §Authentication | **Shipped** |
| Shareable read-only watchlist links | `/s/<token>` — README | **Shipped** |
| Light/Dark theme | Theme toggle — README | **Shipped** |
| Mobile-responsive + home-screen install | Web manifest + favicons — README | **Shipped** |
| Sentiment is headline-keyword based, not ML | Explicitly labeled per strategy §3 honesty note | **Shipped (honesty req)** |
| **Pulse: one 0–100 transparent score** | `/api/pulse/<sym>` → `compute_pulse()` in `backend/services/pulse.py`; `PulseDial.tsx` | **Shipped** |
| **"Why" panel showing every component + raw value** | `PulseWhy.tsx` — component table with label, raw reading, state, contribution bar | **Shipped** |
| **Momentum/trend inputs (RSI, MACD, SMA cross)** | `_momentum()` (RSI 14) + `_trend()` (SMA50/200 + MACD hist) in `pulse.py` | **Shipped** |
| **Crypto Pulse variant (F&G + BTC dominance)** | Described in strategy §4 — no crypto branch found in `pulse.py`; `compute_pulse()` returns `kind: "stock"` only. Leif to confirm before un-gating. | **Not confirmed — stays gated** |
| **Pulse history / sparkline / "shifted bullish"** | F3 signal history — `signal_history.py` + `PulseTrend.tsx` exist; not confirmed live on production data | **Ships when F3 confirmed live** |
| **Smart/divergence alerts (not just price thresholds)** | F4 — `signal_alerts.py` + `SignalChips.tsx` exist; not confirmed live on production data | **Ships when F4 confirmed live** |
| **"What changed since you last visited" strip** | F5 — strategy §4 | **Ships when F5 lands** |

### Never claim (not built — see strategy §2.2 / §6)
- Advice, recommendations, or "buy/sell" calls. Pulse is "a transparent summary of public signals," never advice.
- Predictions, forecasts, or "confidence" in future price.
- Real-time options, implied volatility, short interest, insider flow, or real EPS-surprise scoring.
- Social-media sentiment (X / Reddit / StockTwits). Sentiment is **news-headline keyword** only.
- Brokerage / portfolio sync. Portfolio is a manual/simulated flow, not live holdings.
- Any paid-tier enforcement language while `BILLING_ENABLED=false` (launch gate — README §Billing).
