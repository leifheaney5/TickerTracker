# Ticker Tracker — Product Hunt Launch Kit

> DRAFT ONLY. Leif reviews and submits himself. Nothing in this file is live.
>
> Gate status updated 2026-06-30: Pulse (F1 + F2 — core score + Why panel) is
> confirmed live in production. Pulse-forward copy is now the primary launch path.
>
> Still gated (do not use until confirmed live and useful to users):
>   - F3: Pulse signal-history sparkline and "shifted N days ago" annotation.
>     The PulseTrend component shows an "accruing" fallback until at least two
>     days of snapshot data exist for a symbol — it is not a meaningful claim for
>     new users on launch day.
>   - F4: Smart/divergence alerts (signal_alerts service).
>   - F5: "What changed since you last visited" digest strip.
>
> Honesty rule (standing): Pulse is a transparent summary of public signals, not a
> prediction or advice. News-headline sentiment is keyword-based from Finnhub's
> news feed; it is always labeled as such.
>
> Sources consulted: positioning-and-copy.md §4, brand-guide.md §1 and §7, README.md.
> PH guidelines: https://news.ycombinator.com/showhn.html (cross-reference launch norms),
> https://github.com/fmerian/awesome-product-hunt/blob/main/product-hunt-launch-guide.md

---

## 1. Tagline (60-character limit)

**Primary (Pulse-forward — now active):**

> One honest, transparent score for every ticker you watch.

Character count: 57. Within limit.

**Alternate A (unified-dashboard — good fallback if Pulse angle tests poorly):**

> Stocks and crypto, one dark dashboard. Free to browse.

Character count: 54. Within limit.

**Alternate B:**

> One dark dashboard for stocks, crypto, and market signals.

Character count: 58. Within limit.

---

## 2. Maker first comment

### Pulse-forward version — RECOMMENDED (Pulse is live as of 2026-06-30)

---

Hi Product Hunt — Leif here.

I built Ticker Tracker because every signal in retail trackers is either buried or a
black box. You get a "Strong Buy" badge with no explanation, or a sentiment dial with no
stated source. I wanted to see the actual inputs, with the math visible.

The centerpiece is Pulse: a single 0–100 score per ticker that reads four public
signals — momentum (RSI and MACD state), trend (price vs. moving averages), analyst
consensus (buy/hold/sell distribution and distance to the mean target from Finnhub),
and news-headline sentiment — and shows you every component and its raw value in a
"Why" panel. Not a prediction. Not advice. The sentiment piece is based on headline
keywords from Finnhub's news feed and is labeled exactly as that. The weights are
published constants in the source, not a model you cannot inspect.

That transparency is the core idea. The score tells you what to look at next; the Why
panel makes sure you know what the score actually means.

Pulse sits on top of the rest of the app: a curated watchlist with per-ticker price
targets and email alerts (you get an email the moment a target is crossed, plus a
weekly digest of your full list). A Finviz-style market treemap alongside a crypto
world view and live Fear and Greed index. Analyst ratings and price targets per stock.
News sentiment mood chips per watchlist. Stocks and crypto in one dark dashboard, no
brokerage required, free to browse.

The data layer runs on real sources (Finnhub, Yahoo Finance, CoinGecko, alternative.me)
with graceful per-field fallbacks, so the app never shows a broken page.

Honest caveats, because they matter: this is an indie project, not a professional
terminal. Pulse reflects public data available to anyone — it does not incorporate
order flow, institutional positioning, or proprietary signals. It will not out-chart
TradingView or out-screen Finviz. It is the calm, transparent tracker I built for
myself, and I am genuinely curious whether the honesty framing is useful to anyone
else or whether it just adds noise.

Happy to answer questions about how the Pulse components are weighted, the watchlist
alert engine, or the data sources.

— Leif

---

### Simpler alternate (use if shorter story is preferred or Pulse is not leading)

---

Hi Product Hunt — Leif here.

I built Ticker Tracker because I was tired of keeping five browser tabs open just to
keep an eye on a handful of names: Yahoo Finance for quotes, Finviz for the market
map, a separate crypto app for Fear and Greed, and something else for analyst ratings.
None of them talked to each other, and none of them tracked both stocks and crypto in
the same place.

Ticker Tracker unifies everything on one calm, dark surface. A curated watchlist with
per-ticker price targets and email alerts. A Finviz-style market treemap alongside a
crypto world view and live Fear and Greed index. News sentiment mood chips per
watchlist (headline-based, labeled as that). Analyst ratings and price targets from
Finnhub. And now Pulse — a single transparent 0–100 score per ticker that shows you
every signal behind it in a "Why" panel. Not a prediction, not advice, just the public
signals summarized honestly.

Free to browse, no brokerage required. Account needed to save your watchlist and set
alerts.

Happy to answer questions about the watchlist flow, the alert engine, or the data
sources. Would especially value feedback on whether the Pulse transparency approach
feels trustworthy or hand-wavy.

— Leif

---

## 3. Gallery shot list

> Minimum 3 screenshots required by Product Hunt. Exclude stock photos and marketing
> jargon. First image serves as the social preview. Shoot on the dark theme at a
> standard laptop viewport (1440 × 900 recommended). Use real data, not placeholders.

### Shot 1 — Social preview (REQUIRED FIRST)
**"Stocks and crypto in one map."**
The market treemap alongside the crypto world view panel. Fear and Greed index visible.
Shows the core unified-asset-class proposition immediately.

### Shot 2 — Pulse (now active — previously held)
**"One score. Fully shown."**
The Pulse dial on a stock card with the Why component table open beneath it. Band label
in the active band color. All four components visible with their raw values and labels.
Caption must say: "Pulse is a transparent summary of public signals, not a prediction."
This is the lead differentiator shot — place it second so it follows the
market-overview hook.

### Shot 3 — Watchlist + alerts
**"Your watchlist, your alerts."**
The curated watchlist at full height with a few tickers, per-row price-target cells
visible, and the alert armed icon active on at least one row.

### Shot 4 — News sentiment + mood
**"Read the mood, not the feed."**
Per-watchlist sentiment mood chips and the news panel for a selected ticker. Shows the
headline-keyword sentiment feature (label it "headline-based" in the caption —
honesty rule).

### Shot 5 — Analyst ratings + price target
**"Analyst consensus in context."**
A stock detail panel showing analyst buy/hold/sell distribution and mean price target
from Finnhub. Shows the ratings feature alongside the Pulse analyst-consensus component.

### Shot 6 — Alert email (optional but strong)
**"It emails you when it matters."**
Screenshot of an actual price-hit alert email and/or the weekly digest email. Shows the
automation layer concretely.

### Shot 7 — Light/dark toggle (optional)
**"Dark by default. Light if you prefer."**
Side-by-side or transition shot of theme toggle. Shows polish.

### HOLD — Pulse history shot (F3 — do not use until accrued history is meaningful)
**"The trend, day by day."**
The Pulse sparkline inside the Why panel with a "shifted N days ago" annotation.
Do not use this shot on launch day: the sparkline shows an "accruing" fallback
message until at least two days of snapshot data exist per symbol. Use once real
users have accumulated a week or more of Pulse history.

---

## 4. FAQ (for the PH listing description section)

**What is Pulse?**
Pulse is Ticker Tracker's transparency score — a single 0–100 number per ticker that
reads four public signals (momentum from RSI and MACD, price trend vs. moving averages,
analyst consensus and distance to the mean target, and news-headline sentiment) and
shows you every component and its raw value in a "Why" panel. It is not a prediction
and not investment advice. The sentiment input is based on headline keywords from
Finnhub's news feed, and the app labels it exactly as that. The weights are published
constants, not a hidden model.

**Is it free?**
Yes, free to browse the demo watchlist with no account. A free account lets you save
your own watchlist, set price targets, and arm email alerts. (A paid Pro tier exists in
the codebase at $7/mo or $59/yr but is launch-gated pending data provider rights
review — do not mention paid tier in the listing until the billing gate is lifted.)

**Does it require a brokerage connection?**
No. It pulls public market data from Finnhub, Yahoo Finance, CoinGecko, and
alternative.me. You do not connect a brokerage or enter any account credentials.

**What assets does it cover?**
US-listed stocks and ETFs (via Finnhub and Yahoo Finance) plus major cryptocurrencies
(via CoinGecko). The market map covers US equity sectors. The crypto world view covers
market cap and 24-hour change for major coins.

**Is the sentiment data from social media?**
No. The news sentiment "mood" chips and the Pulse sentiment component are based on
headline keywords from Finnhub's news feed, not from X, Reddit, or StockTwits. The
app labels this as headline-based and does not claim to model social sentiment.

**Is it a trading tool?**
No. It does not execute trades, give advice, or make predictions. Pulse is explicitly a
summary of public signals with full transparency on every input — not a buy/sell signal.

**What are the email alerts?**
You arm a price target on any watchlist ticker. When the live price crosses that target
(evaluated by a Railway cron job), Resend sends you an email. There is also a weekly
digest of your whole watchlist. Both are included in the free tier (up to 3 active
alerts free; more with Pro once billing is enabled).

---

## 5. Hunter and supporter outreach DM drafts

> DRAFT ONLY. Leif personalizes and sends each one himself. Never copy-paste without
> adding a personal line specific to the recipient. Obtain consent: do not DM people
> who have not indicated openness to being contacted.

### DM Template A — Potential hunter (finance/indie-tech PH hunter)

Subject/opener: Ticker Tracker launch — would you be open to hunting it?

---

Hi [Name],

I noticed you have hunted [relevant product or category — fill this in specifically]
and have an audience that overlaps with retail investors or indie-built finance tools.

I am launching Ticker Tracker (tickertracker.info) on Product Hunt — a dark-mode
stock and crypto dashboard with Pulse, a transparent 0–100 score per ticker that shows
every signal behind it in a "Why" panel. On top of that: a curated watchlist with
email price alerts, a Finviz-style market map, news sentiment, and analyst ratings.
Free to browse, no brokerage required. Indie project, tested, live on Railway.

If you find it genuinely useful after trying it, I would be grateful if you would
consider hunting it. If it is not your thing, no worries at all — I am happy to
self-hunt.

Thanks either way,
Leif

---

### DM Template B — Existing user or supporter (Product Hunt upvote ask)

---

Hi [Name],

Quick heads up: Ticker Tracker is launching on Product Hunt on [DATE] at 12:01 AM PST.
If you have used it and found it useful, I would genuinely appreciate an upvote and a
comment telling others what you found valuable. Honest reactions only — no need to say
anything you do not mean.

Link (goes live at launch): [INSERT PH LINK DAY OF]

Thanks,
Leif

---

> Compliance note: Do not mass-blast this template. Each message must go to someone
> who already has a relationship with the product or with Leif personally. Do not
> incentivize upvotes (violates PH terms). Solicit honest reactions only.

---

## 6. Launch-day timeline

> All times are PST. Leif is the only person who takes actions.

| Time | Action |
|---|---|
| D-30 | Schedule the PH listing (up to 30 days ahead allowed). Upload assets, Pulse-forward tagline (§1 primary), description, gallery shots. Set URL to tickertracker.info. |
| D-7 | Post once on X/Twitter teasing the launch date. Do not mention PH until D-1. |
| D-3 | Send hunter DM if going with a hunter (Template A). Confirm they are willing. |
| D-1 | Send supporter heads-up to anyone who has already used the app and expressed interest (Template B). Post X teaser referencing "launching tomorrow." |
| D-0 00:01 PST | Listing goes live. Post the Pulse-forward maker first comment (§2 primary version) immediately. |
| D-0 00:01–04:00 | Monitor the thread. Respond to every comment within 30 minutes. Answer questions; do not pitch. This 4-hour window is the ranking window — engagement quality counts. |
| D-0 04:00–08:00 | Post the X Pulse launch thread (see channel-drafts.md §X primary thread). Share the PH link. |
| D-0 08:00–12:00 | Post to r/SideProject (see channel-drafts.md). Do not post other Reddit subs on launch day — spread Reddit over days 2-5. |
| D-0 12:00–18:00 | Post Show HN (see channel-drafts.md). |
| D-0 18:00–23:00 | Final check on PH thread. Thank commenters. Update maker comment with any live-feedback notes. |
| D+1 | Reddit community posts (r/stocks, r/investing) if rules allow on those days. |
| D+2 | r/CryptoCurrency value-first post (see channel-drafts.md) if account history and rules support it. |
| D+7 | Hand off to pr-backlink-builder for earned media, directories, and journalist outreach. |
