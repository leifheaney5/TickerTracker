# Ticker Tracker — Product Hunt Launch Kit

> DRAFT ONLY. Leif reviews and submits himself. Nothing in this file is live.
>
> Honesty rule: Pulse, the "Why" panel, smart/divergence alerts, and Pulse history
> are NOT shipped. All copy that depends on them is clearly marked HOLD. The primary
> launch path leads with shipped features only.
>
> Sources consulted: positioning-and-copy.md §4, brand-guide.md §1 and §7, README.md.
> PH guidelines: https://news.ycombinator.com/showhn.html (cross-reference launch norms),
> https://github.com/fmerian/awesome-product-hunt/blob/main/product-hunt-launch-guide.md

---

## 1. Tagline (60-character limit)

**Primary (ships-today, no Pulse dependency):**

> Stocks and crypto, one dark dashboard. Free to browse.

Character count: 54. Within limit.

**Alternate A (ships-today):**

> One dark dashboard for stocks, crypto, and market signals.

Character count: 58. Within limit.

**HOLD — Pulse-forward alternate (use only after Pulse merges and is live in prod):**

> One honest, transparent score for every ticker you watch.

Character count: 57. Within limit. (Adapted from §4 of positioning-and-copy.md; do not
use until Pulse is in production.)

---

## 2. Maker first comment

> HOLD NOTE: The maker comment in positioning-and-copy.md §4 leads with Pulse and
> the "Why" panel. Do not post that version until Pulse is merged and live. Use the
> ships-today version below instead.

### Ships-today version

---

Hi Product Hunt — Leif here.

I built Ticker Tracker because I was tired of keeping five browser tabs open just to
keep an eye on a handful of names: Yahoo Finance for quotes, Finviz for the market
map, a separate crypto app for Fear and Greed, and something else for analyst ratings.
None of them talked to each other, and none of them tracked both stocks and crypto in
the same place.

So Ticker Tracker does one thing first: it unifies everything on one calm, dark
surface. A curated watchlist with per-ticker price targets and email alerts (you get
an email the moment a target is hit, plus a weekly digest of your whole list). A
Finviz-style market treemap alongside a crypto world view and a live Fear and Greed
index. News sentiment mood chips per watchlist. Analyst ratings and price targets from
Finnhub. Free to browse, no brokerage required — you just need an account to save your
watchlist and set alerts.

The data layer runs on real sources (Finnhub, Yahoo Finance, CoinGecko, alternative.me)
with graceful per-field fallbacks, so the app never shows a broken page. It is tested,
deployed to Railway, and live at tickertracker.info.

Honest caveats, because I think they matter: this is an indie project, not a pro
terminal. It will not out-chart TradingView or out-screen Finviz. It does not sync with
your brokerage or do options. It is the calm, no-noise tracker I built for myself, and
I am genuinely curious whether it is useful to anyone else.

Happy to answer questions about the watchlist flow, the alert engine, or the data
sources. Would especially value feedback on what you reach for daily vs. what you
ignore.

— Leif

---

### HOLD — Pulse extension paragraph (add only after Pulse is live)

There is a second layer in progress: Pulse, a single 0–100 score per ticker that reads
momentum, trend, analyst consensus, and news-headline sentiment and shows you every
component and its raw value in a "Why" panel. It is not a prediction and not advice —
it is the public signals, summarized honestly, with the math visible. That ships when
the indicator service completes. I will update this thread when it does.

---

## 3. Gallery shot list

> Minimum 3 screenshots required by Product Hunt. Exclude stock photos and marketing
> jargon. First image serves as the social preview. Shoot on the dark theme at a
> standard laptop viewport (1440 × 900 recommended). Use real data, not placeholders.

### Shot 1 — Social preview (REQUIRED FIRST)
**"Stocks and crypto in one map."**
The market treemap alongside the crypto world view panel. Fear and Greed index visible.
Shows the core unified-asset-class proposition immediately.

### Shot 2 — Watchlist + alerts
**"Your watchlist, your alerts."**
The curated watchlist at full height with a few tickers, per-row price-target cells
visible, and the alert armed icon active on at least one row.

### Shot 3 — News sentiment + mood
**"Read the mood, not the feed."**
Per-watchlist sentiment mood chips and the news panel for a selected ticker. Shows the
headline-keyword sentiment feature (label it "headline-based" in the caption — honesty
rule).

### Shot 4 — Analyst ratings + price target
**"Analyst consensus in context."**
A stock detail panel showing analyst buy/hold/sell distribution and mean price target
from Finnhub. Shows the ratings feature that ships today.

### Shot 5 — Alert email (optional but strong)
**"It emails you when it matters."**
Screenshot of an actual price-hit alert email and/or the weekly digest email. This
shows the automation layer concretely.

### Shot 6 — Light/dark toggle (optional)
**"Dark by default. Light if you prefer."**
Side-by-side or transition shot of theme toggle. Shows polish.

### HOLD — Shot for Pulse (add when Pulse is live)
**"One score. Fully shown."**
The Pulse dial on a stock card with the "Why" component table open. Band label in the
active band color. Caption must say "Pulse is a transparent summary of public signals,
not a prediction."

---

## 4. FAQ (for the PH listing description section)

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
No. The news sentiment "mood" chips are based on headline keywords from Finnhub's news
feed, not from X, Reddit, or StockTwits. The app labels this as headline-based and
does not claim to model social sentiment.

**Is it a trading tool?**
No. It does not execute trades, give advice, or make predictions. It shows public market
data and lets you set price-hit alert thresholds.

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
stock and crypto dashboard that unifies a curated watchlist, Finviz-style market map,
news sentiment, and analyst ratings in one surface, with email price alerts and a
weekly digest. Free to browse, no brokerage required. Indie project, fully tested, live
on Railway.

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
| D-30 | Schedule the PH listing (up to 30 days ahead allowed). Upload assets, tagline, description, gallery shots. Set URL to tickertracker.info. |
| D-7 | Post once on X/Twitter teasing the launch date. Do not mention PH until D-1. |
| D-3 | Send hunter DM if going with a hunter (Template A). Confirm they are willing. |
| D-1 | Send supporter heads-up to anyone who has already used the app and expressed interest (Template B). Post X teaser referencing "launching tomorrow." |
| D-0 00:01 PST | Listing goes live. Post the maker first comment (ships-today version above) immediately. |
| D-0 00:01–04:00 | Monitor the thread. Respond to every comment within 30 minutes. Answer questions; do not pitch. This 4-hour window is the ranking window — engagement quality counts. |
| D-0 04:00–08:00 | Post the X launch thread (see channel-drafts.md). Share the PH link. |
| D-0 08:00–12:00 | Post to r/SideProject (see channel-drafts.md). Do not post other Reddit subs on launch day — spread Reddit over days 2-5. |
| D-0 12:00–18:00 | Post Show HN (see channel-drafts.md). |
| D-0 18:00–23:00 | Final check on PH thread. Thank commenters. Update maker comment with any live-feedback notes. |
| D+1 | Reddit community posts (r/stocks, r/investing) if rules allow on those days. |
| D+2 | r/CryptoCurrency value-first post (see channel-drafts.md) if account history and rules support it. |
| D+7 | Hand off to pr-backlink-builder for earned media, directories, and journalist outreach. |
