# Ticker Tracker — Channel Post Drafts

> DRAFT ONLY. Leif reviews and posts himself. Nothing here is submitted or published.
>
> Honesty rule applied throughout: Pulse, the "Why" panel, smart/divergence alerts,
> and Pulse history are NOT shipped. All copy that depends on them is in a clearly
> labeled HOLD bucket at the bottom of this file. Primary drafts lead with shipped
> features only: unified stock+crypto dashboard, curated watchlist, email price alerts
> + weekly digest, market map, news sentiment (headline-based, labeled), analyst
> ratings, crypto Fear and Greed.
>
> Sources: positioning-and-copy.md §5, brand-guide.md §1 and §7, README.md.

---

## Platform rules checked

### r/SideProject
**Rules-checked: YES**
Sources consulted: https://www.mediafa.st/marketing-on-rsideproject and
https://shipwithai.substack.com/p/4-steps-to-promote-your-side-project

Summary of rules relevant to this post:
- r/SideProject explicitly welcomes self-promotion; it is the stated purpose of the community.
- Posts must include what you built, why, what tech you used, and what feedback you want.
- A bare link to a landing page is removed. Screenshots or demo GIFs are expected.
- Respond to every comment — post-and-ghost behavior is frowned upon and may lead to removal.
- Space reposts at least 3-4 weeks apart, each with new content (launch, update, milestone, lesson).
- New accounts should build a few days of comment karma before posting.
- No booster comment coordination — organic only.

**Verdict: GO. This is the best-fit sub for the launch post.**

---

### r/stocks
**Rules-checked: PARTIAL**
Source: Reddit's about/rules page is not directly fetchable from this environment.
General guidance drawn from https://www.onlinemoderation.com/market-on-reddit-without-getting-banned/
and community knowledge of r/stocks norms.

What is known:
- r/stocks (5M+ members) focuses on stock market discussion, company analysis, news, and data.
- Self-promotional posts and tool links are generally tolerated only when framed around
  genuine discussion and community value, not as advertisements.
- Direct "I made this app, check it out" posts without substantive market discussion tend to be
  removed.
- The community has no verified designated weekly promo thread as of the last check.
- Makers should disclose their connection honestly ("I built this").

**ACTION REQUIRED BEFORE POSTING:** Leif must visit r/stocks's sidebar and wiki and read the
current rules before posting. If the sub has a dedicated feedback/tools thread, post there
instead of as a standalone post. If it explicitly bans self-promotion, do not post the
promotional draft — use the value-first alternative below instead.

**Verdict: CONDITIONAL. Value-first alternative provided. Verify rules first.**

---

### r/investing
**Rules-checked: PARTIAL**
Source: Same limitation as r/stocks; direct fetch not available.
General guidance from community norms and https://finmasters.com/best-money-finance-subreddits/

What is known:
- r/investing (2.7M+ members) is oriented toward buy-and-hold strategy, fundamentals,
  and personal investing questions.
- It is generally stricter than r/stocks on promotional content.
- Tool and app promotion is often removed unless it surfaces in a community feedback context
  (e.g., a "what tools do you use" thread where a maker contributes honestly).
- The sub is not an ideal cold-launch target.

**ACTION REQUIRED BEFORE POSTING:** Read the sidebar and wiki. Look for a pinned
"what tools do you use" or monthly discussion thread. If one exists, contribute there
with honest maker disclosure rather than posting a standalone promotional post.

**Verdict: CAUTION. Do not post the standalone draft here. Value-first comment approach
only. Wait for a natural discussion thread.**

---

### r/CryptoCurrency
**Rules-checked: PARTIAL**
Sources: https://coinband.io/blog/top-9-crypto-subreddits and
https://surgence.io/blog/reddit-marketing-crypto

What is known:
- r/CryptoCurrency (8.7M+ members) has strict anti-shill and anti-promotion enforcement.
- Direct promotional posts for apps, tools, or projects are routinely removed.
- The sub prioritizes discussion of crypto markets, news, and analysis.
- When promotional posts were removed, remaining content received 23% higher karma —
  indicating the community actively downgrades promo content.

**Verdict: NO standalone promotional post. Value-first alternative only (below). Leif
should have prior posting history in the sub before any mention of Ticker Tracker.**

---

### Hacker News (Show HN)
**Rules-checked: YES**
Sources: https://news.ycombinator.com/showhn.html and https://news.ycombinator.com/newsguidelines.html

Summary of rules relevant to this post:
- "Show HN" is for things you built personally that people can run or try.
- tickertracker.info qualifies: it is live, tryable without signup (demo watchlist is free).
- The title must start with "Show HN".
- No marketing or sales language — factual and direct only.
- Do not use AI-generated text (the community actively flags it; write in your own voice).
- Do not solicit upvotes or comments from friends.
- Your HN username should not be the product or company name.
- Add a comment giving backstory and what is different about it.
- No signup barrier on the content people can immediately try (the free browse mode satisfies this).

**Verdict: GO. tickertracker.info is a good Show HN candidate. The demo watchlist is
browseable without login. Lead with the technical build, not the marketing pitch.**

---

### X / Twitter
**Rules-checked: YES (platform has no restrictions on original product posts)**
No content rules that restrict indie makers posting about their own projects.
Platform norms: short is better, value-first framing outperforms pure announcement,
link in tweet is fine.

**Verdict: GO.**

---

## Drafted posts — SHIPS TODAY (no Pulse dependency)

---

### [r/SideProject] Launch post

**Title:** [Launch] Ticker Tracker — stocks and crypto in one dark dashboard, with email price alerts and a weekly digest

---

I built Ticker Tracker because I track both stocks and crypto and I was tired of
bouncing between Yahoo Finance, Finviz, and a coin app just to keep an eye on a small
watchlist.

**What it does (shipped, today):**

- Curated watchlist: bulk add tickers (CSV, comma/space delimited), set a price target
  per ticker, arm an email alert. You get an email the moment a target is crossed, plus
  a weekly digest of your full list. The alert engine runs on Railway cron and sends
  through Resend.
- Finviz-style market treemap alongside a crypto world view (market cap, 24h change)
  and a live Fear and Greed index.
- News sentiment mood chips per watchlist — these are based on headline keywords from
  Finnhub's news feed, not social media, and I label them as that.
- Analyst ratings and price targets per stock (buy/hold/sell distribution, mean target,
  distance from current price).
- Shareable read-only watchlist links (/s/<token>).
- Free to browse without an account. Account needed to save your watchlist, set targets,
  and arm alerts.

**Stack:** Flask + SQLAlchemy + Railway (backend), React 18 + Vite + TypeScript +
Zustand (frontend), Postgres, Resend for email, Finnhub + Yahoo Finance + CoinGecko +
alternative.me for data.

**Live at:** tickertracker.info

What I am looking for: honest feedback on the watchlist flow and the alert UX. Does the
email alert actually feel useful or does it feel like spam? Is the sentiment mood chip
trustworthy-looking or hand-wavy?

Happy to answer any questions about the build.

---

> Posting guidance: Post on a weekday. Add at least one screenshot in the post body
> (watchlist + market map screenshot recommended). Respond to every comment. Disclose
> maker status in the post (already done above). Do not coordinate upvotes.

---

### [r/stocks] Value-first variant (use ONLY if rules permit after verification)

**Title:** Built a tool that puts stocks and crypto in one watchlist with email price alerts — looking for feedback on what's actually useful vs. noise

---

Full disclosure: I built this, so take it as a maker's perspective.

I track both stocks and crypto and got frustrated that no single tracker handles both
without either a brokerage connection or a noisy social feed. So I built Ticker Tracker
(tickertracker.info) — a curated watchlist where you set price targets and get an email
when they hit, alongside a market treemap, sector view, analyst ratings, news sentiment
(headline-based, not social media), and a live crypto Fear and Greed index. Free to
browse, no brokerage required.

The part I am genuinely curious about from this community: does the analyst ratings
panel feel useful alongside price alerts, or is it too much data on one screen? And
does the idea of a weekly watchlist digest email appeal to people who do not check
prices every day, or does that feel like a feature that sounds good but nobody uses?

Any candid reactions appreciated. Not looking for upvotes — looking for actual opinions
from people who use this kind of tool.

---

> Important: Only post this if r/stocks rules permit maker self-posts after Leif
> verifies the sidebar. If they do not, skip this sub entirely or wait for a
> natural "what tools do you use" thread and contribute there as a comment, with maker
> disclosure ("I built one of these, happy to share").

---

### [r/investing] Value-first comment approach (not a standalone post)

**Do not post a standalone promotional post to r/investing.**

**When to use:** Only when a thread like "what stock screener / watchlist tools do you
use" appears organically. Contribute as a comment with full maker disclosure.

**Comment template:**

---

Full disclosure: I built this one, so biased — but since people are sharing tools, I
will mention Ticker Tracker (tickertracker.info). Curated watchlist with email price
alerts when a target is crossed, market treemap, analyst ratings, and news sentiment
chips (headline-based, not social, I label it as that). Free to browse without an
account. No brokerage sync — it is just a tracker. Happy to share more about how the
alert engine works if useful.

---

> This is a comment, not a post. Leif should only submit this in response to an
> existing discussion thread where it is genuinely relevant.

---

### [r/CryptoCurrency] Value-first comment approach (NOT a standalone post)

**Do not post a standalone promotional post to r/CryptoCurrency.** The sub has
strict anti-promotion enforcement and it will be removed.

**When to use:** Only in an existing thread about "what crypto tracking tools do you
use" or "alternatives to CoinMarketCap / CoinGecko dashboards." Contribute as a
comment with maker disclosure. Leif must have prior posting history in the sub first.

**Comment template:**

---

Maker here, so take with salt: Ticker Tracker (tickertracker.info) is a dark-mode
dashboard that pulls CoinGecko data alongside stocks — market cap, 24h change, a live
Fear and Greed index (from alternative.me). It is focused on tracking, not trading or
social sentiment. Free to browse. I built it to avoid keeping three tabs open. Happy to
answer questions about how the data layer works.

---

---

### [Show HN] — Hacker News

**Title:**

> Show HN: Ticker Tracker – stocks and crypto in one dark dashboard with email alerts

**Body (posted in the URL field's companion text box OR as the first comment):**

> I built Ticker Tracker (tickertracker.info) because I track both stocks and crypto
> and no existing tracker handled both without either requiring a brokerage connection
> or becoming a noisy social feed.
>
> The app is a Flask backend (Finnhub, Yahoo Finance, CoinGecko, alternative.me as
> data sources, per-source TTL cache, deterministic seeded mock fallbacks so it never
> shows a broken page) serving a React 18 + Vite + TypeScript SPA. State via Zustand.
> Deployed on Railway with Postgres and two cron services for the alert engine (Resend
> for email delivery).
>
> What it ships today: curated watchlist with per-ticker price targets and email alerts
> (triggered by Railway cron when a target is crossed), a Finviz-style market treemap
> alongside a crypto world view, sector performance matrix, live Fear and Greed index
> (alternative.me), news sentiment mood chips (headline keyword heuristic — labeled
> as such, not claimed to be ML), analyst ratings and price targets from Finnhub,
> shareable read-only watchlist links, and a weekly watchlist digest email.
>
> Free to browse without an account. Account required to save watchlist and arm alerts.
>
> Happy to go deep on the data-provider abstraction layer, the alert cron design, or
> any other part of the build.

---

> Posting guidance: Post during US business hours (9am–2pm ET weekdays) for best HN
> visibility. Do not ask friends to upvote. Leif's HN username should be a personal
> handle, not "tickertracker" or "leif_tt." Be in the thread for the first 2 hours to
> answer technical questions. HN readers will ask about the data sources, rate limits,
> and what the fallback mocks do — be prepared with specifics.

---

### [X / Twitter] Launch thread (ships-today version)

**Tweet 1 (hook):**

> I track both stocks and crypto and I could never find one tool that handled both
> without requiring a brokerage login or becoming a social feed full of noise.
>
> So I built one.
>
> tickertracker.info — free to browse, dark by default, no brokerage required.

**Tweet 2 (what it does):**

> What ships today:
>
> — Curated watchlist: set a price target, get an email when it hits
> — Finviz-style market map + crypto world view in one surface
> — Live Fear & Greed index (alternative.me)
> — Analyst ratings + price targets from Finnhub
> — News sentiment per watchlist (headline-based — I label it that, not "AI")
> — Weekly watchlist digest email
> — Shareable read-only watchlist links

**Tweet 3 (honest caveat):**

> Honest caveats, because I think they matter:
>
> It does not connect to your brokerage. It does not do options or predictions.
> It does not claim the sentiment data is anything more than headline keywords.
>
> It is the calm, honest tracker I wanted for myself. Would value feedback.

**Tweet 4 (CTA):**

> If you track both stocks and crypto and bounce between tabs: give it a try.
>
> If something feels off or missing, reply here or open an issue — I read both.
>
> tickertracker.info

---

> Thread guidance: Post tweets 1-4 as a thread. No exclamation storms, no rocket
> emoji, no "to the moon" language. Space out feature-spotlight singles (below) over
> the days following launch, not all at once.

---

### [X / Twitter] Feature-spotlight singles (post one per day after launch week)

**Spotlight A — Alerts:**

> Price alert flow on Ticker Tracker: arm a target on any ticker, Railway cron checks
> it, Resend delivers the email when it crosses.
>
> Simple, no brokerage required, included in the free tier.
>
> tickertracker.info

**Spotlight B — Market map:**

> One surface: a Finviz-style US equity treemap alongside a crypto world view and a
> live Fear & Greed index.
>
> I got tired of keeping separate tabs for each.
>
> tickertracker.info

**Spotlight C — Sentiment honesty:**

> The "mood" chips in Ticker Tracker's watchlist are based on headline keywords from
> Finnhub's news feed.
>
> That is what the label says. Not "AI sentiment." Not social media. Just headlines.
>
> I think being honest about what a signal actually is matters more than sounding
> impressive.
>
> tickertracker.info

**Spotlight D — Analyst ratings:**

> Ticker Tracker pulls analyst buy/hold/sell distribution and mean price targets from
> Finnhub per stock.
>
> Useful to see alongside the current price without opening a separate terminal.
>
> tickertracker.info

---

## HOLD BUCKET — Pulse-dependent copy (do not use until Pulse is merged and live in production)

> Everything below requires the Pulse feature (F2 in the strategy doc, `/api/pulse/<SYM>`)
> to be shipped and live. Check README and the strategy doc before moving any of this
> to the active drafts above.

**[HOLD] r/stocks or r/investing — Pulse-forward post:**

> I got tired of every "signal" in retail trackers being either buried or a black box,
> so I built one that shows its work. Ticker Tracker's Pulse reads four public signals
> for a ticker — momentum (RSI, MACD state), trend (price vs. moving averages), analyst
> consensus and distance to the mean target, and news-headline sentiment — and rolls
> them into a single transparent 0–100 score, with a "Why" panel that breaks down each
> input and its raw value. It is explicitly not a prediction and not advice. The
> sentiment piece is a headline-keyword read and I label it as that.
>
> It also just unifies stocks and crypto in one dark dashboard (watchlist, market map,
> email alerts). Free to browse. I'd genuinely value feedback on whether the score's
> breakdown actually feels trustworthy vs. hand-wavy.

**[HOLD] X / Twitter — Pulse intro thread (from positioning-and-copy.md §5):**

> Most trackers show you a number and hide how they got it.
>
> Ticker Tracker's Pulse is one 0–100 score per ticker — momentum, trend, analyst
> consensus, and news-headline sentiment — and it shows you every component and raw
> value behind it.
>
> Not a prediction. Not advice. Just the public signals, summarized honestly.
>
> tickertracker.info
