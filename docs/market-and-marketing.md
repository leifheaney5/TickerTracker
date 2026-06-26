# Ticker Tracker — Market & Marketing Strategy

> Internal strategy doc. The **Marketing** section (Part 3) is **DRAFT material** — starting
> points for Leif to rewrite in his own voice and brand. Don't ship it as-is.

Grounded in the actual product: a dark-themed stock + crypto tracker with a hero split-view
Dashboard (curated watchlist + interactive candlestick chart, key stats, news with sentiment,
analyst ratings), At-a-Glance / Deep Dive tables, Market overview/treemap/sectors, a Crypto
world (live Fear & Greed, treemap), a Screener, a Strategy cockpit, Portfolio, and Alerts.
Freemium: browse free; a free account unlocks a personalized watchlist / targets / alerts /
portfolio. Real data (yfinance, CoinGecko, alternative.me, Finnhub).

---

## Part 1 — Competitive Landscape (honest)

### The real competitors

| Competitor | What they do well | Where Ticker Tracker can differentiate |
|---|---|---|
| **Yahoo Finance** | The default. Huge data breadth, free, brand trust, decent watchlists + portfolios. | Yahoo's UI is cluttered, ad-heavy, and dated. TT is cleaner, dark-native, and puts crypto + stocks in one coherent surface. |
| **TradingView** | Best-in-class charting, massive community, alerts, multi-asset. The power-user standard. | TT can't out-chart TradingView and shouldn't try. TT competes on *simplicity* — a curated tracker, not a pro terminal you have to learn. |
| **Finviz** | The iconic market heatmap + a deep, fast screener. Loved by stock traders. | TT already has a Finviz-style treemap **plus** crypto, a curated watchlist, and a modern dark UI Finviz lacks. Finviz is stocks-only and visually stuck in ~2010. |
| **Stocktwits** | Social sentiment, community, "what's trending." | TT is a calmer, signal-over-noise tool. News-sentiment pills give a lighter "mood" read without the social-feed chaos. |
| **Webull / Robinhood watchlists** | Free, slick mobile, integrated trading. | They lock value behind a brokerage account. TT is broker-agnostic — track everything in one place regardless of where you actually trade. |
| **Simply Wall St** | Beautiful fundamentals visualizations ("snowflake"), long-term investor focus. | Paywalled fast and stocks-only. TT's Deep Dive covers fundamentals for free and adds crypto + market-wide tooling. |
| **CoinMarketCap / CoinGecko** | The crypto data defaults (TT uses CoinGecko data). | They're crypto-only. TT's edge is *one* dark UI for both stocks and crypto — most people hold both and bounce between apps. |
| **Google Finance** | Frictionless, free, clean-ish watchlist. | Shallow — weak charting, no screener, no treemap, no real crypto depth, no sentiment/ratings. TT is far deeper. |

### Where Ticker Tracker realistically fits

TT is **not** going to beat TradingView on charting depth, Finviz on screener breadth, or
Yahoo on raw data coverage. It shouldn't try. Honestly, today it's a strong *prototype-grade*
product that needs real-world reliability, notifications, and a mobile story before it can win
sustained daily users.

Where it genuinely wins is **coherence and taste**: one beautiful dark surface that unifies
stock + crypto tracking, a Finviz-style market map, a curated personal watchlist with
targets/alerts, and news sentiment + analyst ratings — all free to start, no brokerage required.
Most competitors do *one* of these well and make the rest ugly, paywalled, or single-asset.

### Most defensible angle

**"A clean, dark, all-in-one tracker for the stocks *and* crypto you actually care about —
Finviz-style market map, curated watchlist, news sentiment, and analyst ratings in one free UI,
no brokerage required."**

The conversion moat is the **personalized watchlist**: anyone can browse, but saving your list,
targets, alerts, and portfolio requires a free account. That's the right freemium hook — the
value is obvious before signup, and the account unlocks *persistence*, which is sticky.

---

## Part 2 — Feature Gap Analysis / Roadmap

Ranked roughly by (impact ÷ effort). **[QW]** = quick win for an indie dev.

1. **Real price-alert delivery (email + push/web-push)** — Impact: High · Effort: Med. **[QW for email]**
   Alerts already exist in the UI but appear in-app only. An alert that emails/pushes you is the
   #1 reason people return to a tracker. Email is a quick win (Resend is already wired for auth).

2. **PWA / installable + mobile-responsive** — Impact: High · Effort: Med. **[QW for PWA shell]**
   The split-view Dashboard is desktop-first. A responsive layout + "Add to Home Screen" makes it
   a daily-glance tool without the cost of native apps. Highest-leverage reach unlock.

3. **Earnings calendar / earnings reminders** — Impact: High · Effort: Med.
   Finnhub already provides earnings data. A calendar view + "remind me before earnings" ties
   directly into the alerts system and is a strong recurring-visit driver.

4. **Dark/light theme toggle** — Impact: Med · Effort: Low. **[QW]**
   Tokens are already centralized as CSS custom properties — a light theme is mostly a token map.
   Cheap accessibility + preference win, and a tidy "we listened" launch note.

5. **Watchlist / portfolio import (CSV, paste tickers)** — Impact: High · Effort: Low–Med. **[QW]**
   New users abandon if they must add tickers one by one. "Paste your tickers" or CSV import
   removes the cold-start wall right at the conversion moment.

6. **Public/shareable watchlist or chart links** — Impact: High · Effort: Med.
   A shared read-only watchlist URL is free, viral distribution — every share is an ad for the
   curated-list feature and a top-of-funnel acquisition channel.

7. **Real brokerage connect (SnapTrade / Plaid)** — Impact: High · Effort: High.
   Portfolio is currently a simulated connect flow. Real holdings sync makes Portfolio genuinely
   useful — but it's heavy (compliance, OAuth, cost), so sequence it after the quick wins.

8. **Weekly digest email** — Impact: Med · Effort: Low. **[QW]**
   "Your watchlist this week" recap. Settings already references a Weekly digest toggle; Resend is
   in place. Pure retention with little new infrastructure.

9. **More robust real-data reliability + rate-limit handling** — Impact: High · Effort: Med.
   yfinance/free Finnhub tiers are fragile under load. Caching, graceful degradation, and possibly
   a paid data tier are table stakes before any real traffic push. (Foundational, not flashy.)

10. **Saved screener filters + screener alerts** — Impact: Med · Effort: Med.
    Let users save a screen and get notified when new tickers match. Turns a one-shot tool into a
    recurring habit and differentiates from Finviz's session-only screens.

11. **News digest per watchlist + sentiment trend** — Impact: Med · Effort: Med.
    Aggregate sentiment across your whole list ("your watchlist mood today") — a lightweight,
    distinctive signal that leans on the sentiment data already in the Dashboard.

12. **Onboarding flow with starter watchlists** — Impact: Med · Effort: Low. **[QW]**
    "Pick a starter list: Big Tech / AI / Crypto Majors / Dividend." Solves cold-start and shows
    off the curated-list value in the first 30 seconds.

**Suggested sequence:** quick wins first (email alerts, theme toggle, import, starter watchlists,
weekly digest) → PWA/responsive + earnings calendar → data reliability hardening → shareable
lists → real brokerage connect.

---

## Part 3 — Marketing Starting Points  *(DRAFT — rewrite in Leif's voice)*

> Everything below is raw material, not final copy. No emoji spam, no hype — tighten to brand.

### Taglines (pick/remix)
1. **"Track the market you actually care about."**
2. **"Stocks and crypto. One clean, dark dashboard."**
3. **"Your watchlist, the market map, and the news — in one place, for free."**
4. **"The market, minus the noise."**
5. **"A tracker that's actually nice to look at."**

### One-paragraph product description (landing page / Product Hunt)
> Ticker Tracker is a clean, dark-themed dashboard for tracking the stocks and crypto you care
> about — together, in one place. Build a curated watchlist with price targets and alerts, dig
> into any ticker with interactive charts, key stats, news sentiment, and analyst ratings, and
> zoom out to a Finviz-style market map, sector performance, and a live crypto Fear & Greed index.
> Browse everything for free; create a free account to save your watchlist, set alerts, and track
> your portfolio. No brokerage required, no clutter — just the market, the way you'd actually want
> to look at it.

### Sample social posts (DRAFT)

**X / Twitter (launch):**
> Built Ticker Tracker: a dark, all-in-one dashboard for stocks + crypto.
> Curated watchlist, price targets & alerts, a Finviz-style market map, news sentiment, analyst
> ratings, live crypto Fear & Greed — all free to browse. No brokerage required.
> tickertracker.info

**Reddit r/stocks (value-first, low-promo — read subreddit rules first):**
> I got tired of bouncing between Yahoo, Finviz, and a crypto app, so I built one dark dashboard
> that puts a curated watchlist, a market heatmap, news sentiment, and analyst ratings in one
> place — stocks and crypto together. Free to browse, free account to save your list + alerts.
> Would genuinely like feedback on the watchlist/alerts flow from people who track a lot of names.

**X / Twitter (feature spotlight):**
> One thing I wanted in a tracker: a market map that *also* covers crypto.
> Ticker Tracker has a Finviz-style treemap for stocks **and** a crypto map with live Fear & Greed,
> side by side in the same dark UI. Small thing, but it's why I stopped tab-hopping.

### SEO keyword themes
1. **All-in-one stock + crypto tracker** — "track stocks and crypto in one app," "stock and crypto
   watchlist," "combined stock crypto dashboard." (Owns the unification angle; low competition.)
2. **Free stock market heatmap / map** — "stock market heatmap," "market treemap," "Finviz
   alternative," "free market map crypto." (Rides Finviz search intent with a crypto+dark twist.)
3. **Free watchlist with price alerts (no brokerage)** — "free stock watchlist with alerts,"
   "price target tracker," "crypto price alerts free," "watchlist without a brokerage account."
   (Targets the conversion-driving feature and the broker-agnostic differentiator.)

---

*Bottom line: lead with the unified dark stocks+crypto map + curated watchlist angle; harden
reliability and ship notifications/PWA before any real traffic push; treat all Part 3 copy as
drafts to be rewritten in the owner's voice.*
