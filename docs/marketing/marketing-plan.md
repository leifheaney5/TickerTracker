# Ticker Tracker — Consolidated Marketing Plan

> DRAFT for Leif to rewrite in his own voice before any external use.
>
> Canonical upstream docs this plan extends (read those first; this plan does not reproduce them):
> - Brand voice, tone, palette, Pulse motif: `docs/brand/brand-guide.md`
> - Positioning statement, hero copy, taglines, PH kit, social posts, claim-to-behavior table: `docs/marketing/positioning-and-copy.md`
> - SEO keyword clusters, programmatic-page specs, technical SEO checklist: `docs/marketing/seo-program.md`
> - Competitive landscape, feature gap analysis: `docs/market-and-marketing.md`
> - Moat thesis, Pulse feature set (F1–F6), real data inventory: `docs/strategy/2026-06-28-moat-signal-intelligence.md`
>
> **Shipped-vs-pending split (non-negotiable).** Every section that touches Pulse (F1–F6) is labeled
> **[ACTIVATES WHEN PULSE SHIPS]**. Do not run those campaigns or publish that copy until the code is
> merged and live. Lead now with the unified-tracker and alert/digest story — those features are
> confirmed shipped per `docs/marketing/positioning-and-copy.md §6`.
>
> **Billing gate.** `BILLING_ENABLED=false` in production. While that flag is false, no plan limits
> are enforced and Pro copy cannot truthfully gate any feature. Do not advertise Pro tiers, pricing,
> or feature restrictions until Leif flips the flag. See §9 Open Questions.

---

## 1. Objectives & Targets

### Guiding principle
Ticker Tracker is a solo indie product. Targets below are calibrated to what one founder can move
organically without a paid-acquisition budget. Hitting vanity-large numbers is not the goal;
building a user base that actually returns and eventually pays is.

### Phase A — Pre-Pulse (ships-today story)
The goal here is pipeline: build an audience before the headline feature lands so the Pulse launch
has someone to land in front of.

| Metric | Target | Window | How measured |
|---|---|---|---|
| Registered accounts | 250 | 12 weeks | Postgres `users` table count |
| **Activation rate** (first watchlist item saved) | 45% of signups | rolling | Postgres: `watchlist_items` per `user_id` |
| Weekly returning users | 30% of registered base | rolling | session data (if analytics added) or proxy: weekly-digest open rate |
| Outbound links to the app | 10 quality community links | 12 weeks | manual tracking in a links log |
| Social followers / subscribers | 150 (X or newsletter) | 12 weeks | platform count |

**Activation is the one metric that matters most at this stage.** A signup who never saves a
watchlist item has no retention hook. Every funnel decision should be evaluated by whether it pulls
the activation rate up.

### Phase B — Post-Pulse launch (when F2 merges to main)
The Pulse launch is the brand moment. Run the "One honest score" campaign (§6) when the code ships.

| Metric | Target | Window |
|---|---|---|
| Launch-week signups | 200 net new | 7 days post-launch |
| Product Hunt upvotes | Top-10 of the day | launch day |
| `/signals/<TICKER>` pages indexed | 50+ curated tickers | 30 days post-SEO-deploy |
| Digest subscribers on watchlist | 40% of registered users | 60 days post-launch |

### Phase C — Billing flip (when `BILLING_ENABLED=true`)
Only after the billing gate opens. Targets depend on registered base size at that point — set them
then, not now.

---

## 2. ICP & Segments

Three segments, each grounded in the product's actual differentiators. They are not mutually
exclusive; many users will fit two.

### Segment 1 — The Cross-Asset Juggler (primary)
**Who.** Holds both stocks and crypto. Currently bounces between Yahoo Finance / Google Finance and
CoinMarketCap / CoinGecko to keep an eye on a 10–20 name list. Not a day trader, not a
professional — a retail investor who checks in daily or a few times a week.

**Pain.** Two dashboards, two mental contexts, no single "how's everything" view. Market maps and
sentiment from the stock world don't cover crypto; crypto apps don't show equities.

**Why TT wins.** Unified dark dashboard — same watchlist, same map, same news sentiment read for
NVDA and BTC side by side. Watchlist persistence and price alerts mean they don't have to remember
to check; the app comes to them. No brokerage account required to start.

**Conversion hook.** Save a watchlist with both stocks and crypto tickers → arm a price alert →
get an email when it fires. That loop, experienced once, is the stickiness.

### Segment 2 — The Signal Seeker (pre-Pulse: underserved; post-Pulse: primary)
**Who.** Uses technical terms like RSI or "analyst consensus" but doesn't want to build their own
screener or read chart patterns for 30 minutes. Wants a synthesized read they can trust because
they can see where it came from.

**Pain.** Every "signal" in retail tools is either buried in noise (Yahoo's analyst tab) or a black
box (a score with no explanation). Skeptical of "AI-powered" claims with no math behind them.

**Why TT wins.** **[ACTIVATES WHEN PULSE SHIPS]** Pulse is the first score this user has seen
that shows its work. Momentum, trend, analyst consensus, headline sentiment — each component with
its raw value, right there. The "Why" panel is the trust unlock for this segment.

**Conversion hook.** See a Pulse score on a public `/signals/<TICKER>` page → click into the "Why"
panel → realize the app shows their whole watchlist in the same way → create account.

### Segment 3 — The Finviz Escapee (market map entry point)
**Who.** Uses Finviz's market heatmap as a morning ritual but finds Finviz visually dated,
stocks-only, and not particularly useful beyond the treemap. Crypto-curious but has no clean tool
for it.

**Pain.** Finviz is the industry standard for a market-at-a-glance view but the product hasn't
meaningfully evolved in years and has no crypto surface.

**Why TT wins.** TT's treemap covers stocks *and* crypto in a coherent dark UI, includes live
crypto Fear & Greed, and is free. The Finviz-alternative SEO angle (Cluster F in seo-program.md)
is the top-of-funnel entry; the watchlist and alerts are the depth that Finviz doesn't offer.

**Conversion hook.** Land on the market map from search → see the unified stocks + crypto view →
realize there's a free account with a persistent watchlist.

---

## 3. Funnel & Metrics

Each stage has one metric that matters and a realistic measurement path given the current stack
(Postgres, Resend, no analytics SDK installed yet).

### Awareness — "Does the right person know we exist?"

**One metric:** organic search impressions on target keywords (from Google Search Console — free
and recommended as the first analytics tool to add).

**Current state:** low. The SPA ships one global meta tag; no per-page titles for indexable
content. The SEO program (`docs/marketing/seo-program.md`) is the fix.

**How measured:** Google Search Console. Add the property and verify via DNS or the HTML tag
method (a one-time 30-minute setup). This is the only reliable way to know if the SEO work is
gaining traction without paying for a rank-tracking tool.

### Acquisition — "Does awareness convert to a visit and then a signup?"

**One metric:** signup conversion rate from first visit (signups ÷ unique visitors).

**How measured:** Postgres `users.created_at` gives signups. Unique visitors requires either a
lightweight analytics tool (Plausible or Umami — both privacy-first, cheap, self-hostable) or a
proxy (Railway request logs). Recommend Plausible at ~$9/mo as the first paid marketing tool —
it's simple, privacy-respecting, and gives the data needed without cookie banners.

**Funnel note:** the free-to-browse model means many visitors will consume the demo watchlist and
leave. That is expected and fine. The signup moment must be frictionless — email/password or Google
OAuth in under 30 seconds (already shipped).

### Activation — "Did the user do the thing that makes them sticky?"

**One metric:** percentage of registered users who save at least one watchlist item within 48 hours
of signing up.

**Why 48 hours.** A user who hasn't saved a ticker in the first two days almost never comes back.
This is the cold-start problem that onboarding starter watchlists (already shipped) are designed
to solve.

**How measured:** Postgres query: `SELECT COUNT(DISTINCT user_id) FROM watchlist_items WHERE
created_at < users.created_at + INTERVAL '48 hours'`. Run this weekly and track the ratio.

**Levers:** the starter watchlist templates ("Big Tech / AI / Crypto Majors / Dividend") are the
primary lever — they solve the blank-state problem. The copy on the empty watchlist state is the
secondary lever. Both are already in the product; test whether they're working.

### Retention — "Does the user come back?"

**One metric:** weekly digest open rate (a proxy for engaged users when no session analytics exist).

**Why digest open rate.** The weekly digest is an opt-in Resend email that goes only to users who
have saved a watchlist. An open means the user cared enough to click into their watchlist summary.
Resend's dashboard reports open rates natively. A healthy rate for a focused product like this is
30–45%.

**Secondary signal:** price alert fires → email opens → click-throughs. Each fire is a retention
touchpoint that was requested by the user; track via Resend event logs.

**Retention note:** until Pulse ships, the primary retention mechanic is alert emails. The product
needs this loop to be reliable before investing heavily in acquisition. A leaky retention bucket
makes paid or organic acquisition wasteful.

### Revenue — "Does a meaningful segment pay?"

**Deferred while `BILLING_ENABLED=false`.** When the flag flips, the one metric is
**trial-to-paid conversion rate** on Pro ($7/mo or $59/yr per README). The annual plan ($59) is
the primary CTA because it has better LTV and reduces churn exposure.

**Pre-flip note:** use the pre-flip period to establish product-market fit signals (activation
rate, retention rate, unsolicited positive feedback) that inform what the Pro tier should deliver.
Do not guess; let early user behavior tell you.

---

## 4. Channel Strategy

Prioritized for a solo founder with ~$0 paid-acquisition budget. Each channel has a role in the
funnel, an effort tier, and the agent that owns execution.

### Channel 1 — Organic Search / SEO
**Role in funnel:** awareness → acquisition. The only channel that compounds without ongoing effort.
A `/signals/NVDA` page that ranks for "NVDA RSI today" acquires users while Leif sleeps.

**Effort tier:** high upfront (implementation), then low ongoing (content refresh).

**Realistic timeline:** 3–6 months before programmatic pages gain meaningful ranking. Do not expect
fast results; SEO is the long game. Phase 1 (meta injection, sitemap, robots.txt) has immediate
social-unfurl value even before rankings move.

**What to publish now (no Pulse dependency):**
- Fix per-page meta on existing app routes (`/`, `/market`, `/crypto`, `/earnings`) — fastest SEO
  ROI since these pages exist.
- The `/crypto/fear-and-greed` evergreen page (Cluster D, seo-program.md) — one page, real data
  already flowing, no Pulse dependency. This is the highest-volume single target achievable today.

**What waits for Pulse:** the `/signals/<TICKER>` programmatic universe. Do not publish thin pages
that reference Pulse before `/api/pulse` is live with real data. The thin-content guard in
seo-program.md §2.2 is the gate.

**Agent:** `web-seo-engineer` owns implementation. See §7 for the strategy handoff.

### Channel 2 — Community (Reddit, Hacker News, X)
**Role in funnel:** awareness → acquisition, with some brand-building. Also the fastest way to get
early feedback from real users.

**Effort tier:** medium ongoing (requires genuine participation, not just link drops).

**Approach:** lead with the build story and the product's honesty angle, not the link. Reddit's
investing/trading subreddits (r/stocks, r/investing, r/wallstreetbets, r/CryptoCurrency,
r/PersonalFinance) have varying self-promotion rules — read each subreddit's rules before posting,
check comment-to-post ratios required, use the right flair. Hacker News "Show HN" is the right
format for the product launch (calm, technical, builder-respectful — matches the voice).

**What to post now:** the ships-today story — unified dark dashboard, no brokerage required,
shareable watchlists, price alerts, weekly digest. The Finviz-alternative angle plays well on
r/stocks and r/investing where Finviz is a known reference.

**What to post when Pulse ships:** the "shows its work" angle — a score that exposes every
component is a genuine differentiator that tech-literate investors on Reddit and HN will find
interesting precisely because it's the opposite of "AI black box."

**Agent:** `outreach-coordinator` owns drafts and target lists. See §8 for the positioning handoff.

### Channel 3 — Content (build-in-public, X / newsletter)
**Role in funnel:** awareness, brand building, and audience pre-warming before major launches.

**Effort tier:** low-medium per piece, medium cumulative (requires consistency).

**Format:** short-form, factual updates on X — "shipped X, here's why" — and, if Leif has
appetite, a lightweight newsletter (Resend can power it). The content should feel like what the
product is: calm, specific, honest. Show a screenshot. Say what it does. Don't oversell.

**Build-in-public works here** because the product has a clear honesty philosophy (show your work,
label your signals) that extends naturally to talking about what you built and how. A founder who
ships things and explains them clearly builds trust before the product ever comes up in search.

**Cadence:** see §5 content calendar.

**Agent:** no dedicated agent owns this channel. Leif owns the voice; `outreach-coordinator` can
draft posts that Leif rewrites.

### Channel 4 — Lifecycle Email
**Role in funnel:** activation → retention. This is not an acquisition channel; it's the mechanism
that keeps activated users returning.

**Effort tier:** low (infrastructure already built via Resend; only copy needs attention).

**What's live:**
- Email verification (transactional, already shipped).
- Password reset (transactional, already shipped).
- Price alert emails (triggered, already shipped — Pro-gated when billing flips).
- Weekly watchlist digest (scheduled, already shipped — Pro-gated when billing flips).

**What to improve:** the onboarding email sequence. After signup + verification, the user should
receive a brief "here's what to do first" email (add 3 tickers, arm an alert) within 24 hours.
This is a single transactional email, not a drip campaign — simple, low effort, high activation
impact. Draft belongs to `outreach-coordinator`; implementation belongs to `site-maintainer`.

**Pulse upgrade:** **[ACTIVATES WHEN PULSE SHIPS]** The weekly digest should be upgraded to
include each watchlist name's Pulse band, biggest movers, and "what changed" summary. This turns
the digest from a static price table into the product's primary retention loop.

### Channel 5 — Earned Media / Backlinks
**Role in funnel:** awareness + domain authority for SEO.

**Effort tier:** high per placement, but high value per link.

**Realistic targets for an indie SaaS:** indie-maker communities (Indie Hackers,
BetaList, MicroAcquire listing — not selling, just visibility), financial-tech newsletters that
cover tools (Morning Brew Markets, The Diff, a16z's newsletter for the "transparent AI"
finance angle), and any personal-finance or investing blog that does "best free stock tracker"
roundups.

**Agent:** a `pr-backlink-builder` agent is the right delegatee for this channel if/when one is
installed. Until then, `outreach-coordinator` can produce a target list and pitch template. See §8.

---

## 5. Content Calendar — 10-Week Cadence

Anchors: shipped features only for weeks 1–6; Pulse-dependent pieces in weeks 7–10 are labeled and
contingent on the code shipping. The calendar assumes Leif is posting 1–2 times per week on X
and participating in 1–2 community threads per week.

| Week | Theme | Format / Channel | Anchored feature | Notes |
|---|---|---|---|---|
| **1** | Launch the ships-today story | X post + HN Show HN | Unified dark dashboard, watchlist, map | Lead with the builder angle. Link to `tickertracker.info`. Read HN's Show HN guidelines first. |
| **1** | Reddit — build story | r/stocks or r/investing thread | Price alerts + no brokerage required | Read subreddit rules; lead with value, not the link. Use draft from `outreach-coordinator`. |
| **2** | The map | X screenshot post | Finviz-style treemap + crypto map side by side | One image, one sentence. Show, don't explain. |
| **2** | Fear & Greed page goes live | X post announcing `/crypto/fear-and-greed` | Crypto Fear & Greed (already in-app) | This is the first SEO-targeted public page. |
| **3** | "Why I built it" | X thread (3–4 posts) | Tab-hopping problem, unified dashboard as the solution | Personal, honest, no product-feature list. The founder's voice. |
| **3** | Screener + saved filters | X post | Screener (already shipped) | A feature users may not have found. Screenshot of a saved filter. |
| **4** | Watchlist sharing | X post | Shareable `/s/<token>` links | Show a real shared watchlist link. "You can share a read-only view of your list." |
| **4** | Community — crypto angle | r/CryptoCurrency or r/bitcoin thread | Crypto Fear & Greed + crypto map + watchlist | Angle: "unified view of your crypto + stock portfolio, no app required." Defer to subreddit rules. |
| **5** | Email alerts (the retention story) | X post | Price-hit alert emails | Frame it as: "the point is you stop having to remember to check." |
| **5** | Weekly digest feature | X post | Weekly watchlist digest | "Your watchlist, every week, no login required." (While billing is off, this is available to all.) |
| **6** | Analyst ratings deep-dive | X thread | Analyst consensus + price targets (already shipped) | "Where does the analyst data come from?" — educational, shows honesty by attribution. |
| **6** | Indie Hackers post | Indie Hackers / BetaList listing | Full product story | Submit to BetaList and post on IH; these have long tails. |
| **7** | **[ACTIVATES WHEN PULSE SHIPS]** Pulse launch week | X announcement + HN Show HN | Pulse score + "Why" panel | The full "one honest score" campaign. Use PH kit from positioning-and-copy.md §4 as the skeleton. |
| **7** | **[ACTIVATES WHEN PULSE SHIPS]** Pulse maker story | Longer X thread or blog post | How Pulse is computed, why we show the components | The transparency story — "we could have hidden the math; we didn't." |
| **8** | **[ACTIVATES WHEN PULSE SHIPS]** Product Hunt launch | Product Hunt | Full product with Pulse | Coordinate with `outreach-coordinator`. Gallery items from positioning-and-copy.md §4. |
| **8** | **[ACTIVATES WHEN PULSE SHIPS]** Reddit Pulse thread | r/stocks, r/investing | Pulse "Why" panel + component breakdown | Lead with: "I built a score that shows every input. Here's whether that feels trustworthy." Ask for feedback, mean it. |
| **9** | **[ACTIVATES WHEN PULSE SHIPS]** `/signals/<TICKER>` pages live | X post + community | Programmatic SEO pages | Announce the public signal pages. Show what `/signals/NVDA` looks like. |
| **9** | **[ACTIVATES WHEN PULSE SHIPS]** Divergence alerts preview | X post | Smart alerts (F4) | If F4 has shipped: "an alert that fires when price and sentiment diverge" is genuinely novel. |
| **10** | Reflection / what's next | X thread | Full product status | Honest recap. What worked, what didn't, what's next. The builder audience respects this. |

**Frequency note.** This is one piece of content per channel slot, not a content factory. Quality
and honesty beat cadence for a product with this voice. If a week feels forced, skip it.

---

## 6. Campaign Concepts

### Campaign A — "One Surface" (ships-today launch)

**Goal:** first 100 signups and audience pre-warming before Pulse.

**Hook:** the tab-hopping problem. "You track stocks in one tab and crypto in another and you're
tired of it." The promise is a single dark surface that ends that friction.

**Anchored features (all shipped):** unified dark dashboard, watchlist with bulk import and starter
templates, Finviz-style treemap + crypto map, price alerts, weekly digest, no brokerage required,
shareable watchlists.

**Channels:** HN Show HN, r/stocks + r/CryptoCurrency community posts, X launch thread.

**Success signal:** 100 registered accounts within the first 2 weeks post-launch. 40%+ activation
(first watchlist item saved within 48h).

**Copy reference:** the "ships-today version" social posts in `docs/marketing/positioning-and-copy.md §5`,
the no-Pulse-dependency PH tagline backup, and the §3 taglines numbered 5–7.

### Campaign B — Crypto Fear & Greed Evergreen SEO

**Goal:** own the `/crypto/fear-and-greed` search query (Cluster D, seo-program.md) as a
long-term passive acquisition channel.

**Hook:** "crypto fear and greed today" is one of the highest-volume, daily-recurring queries in
the crypto information space. The app already renders this beautifully in-product. One well-built
public page beats thin daily pages.

**Execution:** a single Flask-served `/crypto/fear-and-greed` page with the real alternative.me
data, honest attribution, the big dial, today's value + label, BTC dominance context, and a "what
this means" explainer that is educational and dated. Per-page meta/OG/JSON-LD (Dataset schema, as
specified in seo-program.md §3.4).

**Dependencies:** web-seo-engineer implements the Flask route + meta injection (Phase 1 of
seo-program.md). No Pulse dependency. Can ship now.

**Success signal:** Google Search Console shows impressions growing for "crypto fear and greed
today" within 8–12 weeks. Inbound traffic to `/crypto/fear-and-greed` converts to app signups at
measurable rate.

### Campaign C — "One Honest Score" Pulse Launch [ACTIVATES WHEN PULSE SHIPS]

**Goal:** make Pulse the named headline metric and drive the Product Hunt moment.

**Hook:** "Most trackers show you a number and hide how they got it." The counter-positioning is
transparency: one score, every component shown, the math in plain sight. For a user who has
learned to distrust "AI-powered" scores, this is the trust unlock.

**Anchored features:** Pulse score + "Why" panel (F2), technical indicators (F1), `/signals/<TICKER>`
programmatic pages (SEO program Phase 1 full variant).

**Channels:** Product Hunt (primary launch moment), X thread, HN Show HN, r/stocks + r/investing
Reddit posts, `/signals/<TICKER>` programmatic pages capturing long-tail search.

**Copy reference:** `docs/marketing/positioning-and-copy.md §2` (hero), §3 taglines 1–4, §4 PH kit,
§5 X / Reddit Pulse posts. All of those are draft-ready for this campaign.

**Success signal:** Product Hunt top-10 of the day. 200 new signups in launch week. `/signals/`
pages indexed and returning organic traffic within 30 days.

**Caution:** do not date-announce this campaign in advance. Ship the code, confirm it runs on real
data, then launch. A "coming soon" announcement that slips undermines the credibility the campaign
is built on.

### Campaign D — Digest Growth Loop (ongoing retention → word of mouth)

**Goal:** turn the weekly digest into both a retention mechanism and a low-friction referral surface.

**Hook:** the digest is the product's most underused growth asset. A user who opens it weekly is
retained; if the digest includes a link to share their watchlist (`/s/<token>`), it becomes a
word-of-mouth channel without any referral engineering.

**Execution:**
1. Improve the digest email copy to be less transactional and more like a weekly signal summary
   (pull top movers, biggest change, upcoming earnings on the watchlist — all already computable
   from shipped data).
2. Add a single "Share your watchlist" CTA at the bottom of each digest. No incentives needed; the
   shareable link already works.
3. **[ACTIVATES WHEN PULSE SHIPS]** Upgrade the digest to lead with Pulse band changes and "what
   moved" summary (F5 intelligence digest). This is the version that becomes genuinely distinctive.

**Dependencies (Phase 1, no Pulse):** improved digest copy only — `outreach-coordinator` writes
the draft; `site-maintainer` updates the template in `backend/email_templates.py`.

**Success signal:** weekly digest open rate above 30%. Inbound traffic from `/s/<token>` shared
links. A measurable cohort of signups who found the product through a shared watchlist.

---

## 7. SEO Content Strategy Handoff — for `web-seo-engineer`

This section extends `docs/marketing/seo-program.md` (do not duplicate it). The SEO program is the
spec; this section adds prioritization framing and the strategic rationale `web-seo-engineer` needs
to sequence the work correctly.

### Immediate priority (no Pulse dependency)

**Priority 1 — Per-page meta fix for existing app routes.**
The SPA currently ships one global title and description for every route. Fixing this for the
existing marketing-adjacent routes (`/`, `/market`, `/crypto`, `/earnings`) is the smallest work
for the largest SEO and social-unfurl impact. These pages already exist; they just need Flask-side
title/description/OG injection before the SPA catch-all.

Suggested meta per route:
- `/` (home/dashboard): "Ticker Tracker — Stocks & Crypto in One Dark Dashboard | Free Watchlist + Alerts"
- `/market`: "Stock Market Heatmap — Finviz Alternative with Crypto | Ticker Tracker"
- `/crypto`: "Crypto Dashboard — Fear & Greed Index, Market Map & Watchlist | Ticker Tracker"
- `/earnings`: "Earnings Calendar — Upcoming Stock Earnings Dates & Estimates | Ticker Tracker"

These are the brand/category themes in Cluster F of seo-program.md. Low competition, high
relevance to the product's actual capabilities.

**Priority 2 — `/crypto/fear-and-greed` standalone page.**
This is Campaign B. The highest-volume single-page target achievable without Pulse. Build as a
Flask route with real alternative.me data, `Dataset` JSON-LD, per-page OG card, and honest
attribution. Full spec in seo-program.md §1 Cluster D and §2.3.

**Priority 3 — `robots.txt` tweak + static-to-generated sitemap.**
seo-program.md §3.1 and §3.2. Add `Disallow: /api/` to robots. Build the Flask `/sitemap.xml`
route. Phase 1 version lists existing routes; programmatic signal pages are added in the Pulse
phase.

### Pulse-gated priority (after `/api/pulse` is live on real data)

**Priority 4 — `/signals/<TICKER>` programmatic pages.**
Full spec in seo-program.md §2.1–2.3. Phase 1 minimal variant: Flask-side meta/OG injection only;
React renders the body. Only index pages that clear the thin-content floor (real Pulse data,
analyst data, and news). Start with the bounded curated universe (Big Tech + AI + Crypto Majors +
Dividend starter-watchlist symbols) — that is 30–50 tickers, not a spam farm.

**Priority 5 — Dynamic OG cards for `/signals/<TICKER>`.**
The Pulse dial as an OG image makes every share of a signal page look like the product. Spec in
seo-program.md §3.3. This is a fast-follow after Priority 4.

### Keyword cluster summary for `web-seo-engineer` implementation

| Cluster | Target URL | Intent | Pulse required? |
|---|---|---|---|
| Crypto Fear & Greed today | `/crypto/fear-and-greed` | Informational | No |
| Finviz alternative / stock market heatmap | `/market` (per-page meta) | Commercial investigation | No |
| Stock + crypto dashboard / all-in-one tracker | `/` (per-page meta) | Navigational/Commercial | No |
| Free stock watchlist with alerts | `/` or a `/features/watchlist` marketing page | Commercial investigation | No |
| `<TICKER>` signals / Pulse score | `/signals/<TICKER>` | Commercial investigation | **Yes** |
| `<TICKER>` RSI / overbought | `/signals/<TICKER>` (RSI section) | Informational | **Yes** |
| `<TICKER>` analyst price target | `/signals/<TICKER>` (analyst section) | Commercial investigation | **Yes** |
| `<TICKER>` earnings date | `/signals/<TICKER>` (earnings panel) | Informational | **Yes** |

Full technical implementation spec (URL structure, Flask route approach, SSR recommendation,
JSON-LD schema choices, thin-content guard, sitemap generation) is in seo-program.md. Do not
re-derive it — implement it.

---

## 8. Positioning & Proof-Points Handoff — for `outreach-coordinator` and `pr-backlink-builder`

### Core positioning (ships-today version, no Pulse dependency)
The positioning statement, hero copy, taglines, PH kit, and social post drafts are all in
`docs/marketing/positioning-and-copy.md`. Use the "ships-today" variants (those without a Pulse
dependency tag) as the base for all outreach before Pulse ships.

**The one-line version:** "A clean, dark, all-in-one tracker for the stocks and crypto you actually
care about — no brokerage required."

**The honest differentiator sentence:** "Most trackers do stocks or crypto well, not both. Ticker
Tracker puts them in one coherent surface — same watchlist, same map, same news sentiment read."

### Proof points (all verified shipped, per positioning-and-copy.md §6)

Use these in community posts, pitch emails, and listing descriptions:

1. Unified stocks + crypto in one dark dashboard (watchlist, treemap map, sector view, crypto map).
2. Finviz-style market treemap — covers stocks AND crypto simultaneously.
3. Curated watchlist with bulk import (CSV, comma-separated), per-row price targets, and starter
   templates (Big Tech / AI / Crypto Majors / Dividend).
4. Email price alerts when a target is hit. Weekly watchlist digest. (Note: currently available to
   all users while `BILLING_ENABLED=false`. Do not frame as a paid feature yet.)
5. Live crypto Fear & Greed index from alternative.me, with BTC dominance and market-cap context.
6. News sentiment — per-ticker "mood" chips, labeled as headline-keyword heuristic, not a
   proprietary ML model. (Honesty here is a feature, not a caveat.)
7. Analyst ratings and consensus price targets from Finnhub, attributed and dated.
8. Shareable read-only watchlist links — free word-of-mouth surface.
9. Free to browse, no account required for the demo. Free account unlocks persistence.
10. Real data sources: Finnhub, Yahoo Finance, CoinGecko, alternative.me. Not a mock dashboard.

### What NOT to claim in outreach
See positioning-and-copy.md §6 "Never claim" table. Short version: no advice, no predictions, no
social sentiment, no brokerage sync (portfolio is manual), no options/IV/short interest, no Pro
tier enforcement language while billing is off.

### Tone for outreach
From the brand guide: calm, specific, confident without superlatives. No emoji storms. The product's
honest positioning is its strongest differentiator in a space full of hype — lean into it.
"Sentiment is a headline-keyword heuristic and we label it as that" is a more compelling story for
a skeptical HN or r/investing audience than "AI-powered sentiment analysis."

### Pulse-gated positioning [ACTIVATES WHEN PULSE SHIPS]
The full Pulse positioning (hero, PH kit, social posts, Reddit thread) is ready in
positioning-and-copy.md §§1–5. Use it when `/api/pulse` is live and confirmed running on real
data. The maker's note in the PH first-comment draft is the gate: "keep this in the drafts queue
until Pulse is merged and live."

### Earned media / backlink angles for `pr-backlink-builder`
The following are defensible pitch angles for finance/investing editorial and personal-finance
roundups:

1. **"Best free stock and crypto tracker, unified" roundups.** TT is genuinely differentiated in
   this category — most "best watchlist" lists cover Yahoo, Finviz, or CoinGecko separately. A
   unified stocks+crypto tool with a clean UI and no brokerage requirement is a gap in most lists.
2. **"Finviz alternative" or "Finviz with crypto" angle.** Finviz has a large search footprint;
   articles about Finviz alternatives are a high-value backlink target.
3. **[ACTIVATES WHEN PULSE SHIPS] "Transparent AI / anti-black-box" finance tools angle.** The
   "honest score that shows its math" story is genuinely novel and fits the editorial zeitgeist of
   skepticism about "AI-powered" financial tools.
4. **Build-in-public / indie maker angle.** Indie Hackers, BetaList, and similar communities
   provide both backlinks and a warm audience for the launch.

---

## 9. Open Questions for Leif

These are decisions only the owner can make. They are blockers or direction-setters for specific
parts of this plan.

**1. When does `BILLING_ENABLED` flip?**
The most consequential decision in the near-term marketing plan. Right now price-alert emails and
weekly digests are available to all users — which is a real advantage for acquisition copy. When
billing flips, those become Pro features and free-tier messaging changes significantly. Everything
in this plan that touches the free vs. Pro distinction is contingent on this decision.
Recommend: do not flip until you have confirmed the data-provider commercial-use rights are clean
(README "launch gate" note). Once that's clear, set a date and build the billing-flip messaging.

**2. What is the Pro launch plan?**
The pricing ($7/mo, $59/yr) and feature table (watchlist 15 → 250, alerts 3 → 100, screeners 1 → 25,
compare 2 → 10, email alerts and digest Pro-only) are in the README. But the marketing plan for the
billing flip needs its own copy treatment — what the upgrade pitch is, how the paywalled features
are communicated, and whether there is a trial period. This is a separate artifact; flag it when
billing timing is clearer.

**3. Is there appetite for a lightweight analytics tool?**
Without Plausible or equivalent, the funnel metrics in §3 are partly blind. Postgres gives signups
and activation; Resend gives email engagement; but unique visitors, bounce rate, and source
attribution are unavailable. At ~$9/mo, Plausible is the cheapest way to close that gap. The
decision is whether that spend and the implementation (a single script tag, no cookie banner) is
acceptable.

**4. What is the Pulse ship timeline?**
The entire Phase B plan (Campaign C, Pulse launch, `/signals/<TICKER>` SEO pages, digest upgrade,
smart alerts) gates on F1+F2 being live with real data. Even a rough "Pulse ships in N weeks"
answer lets the content calendar be firmed up and the PH launch be scheduled.

**5. Is there a newsletter or does X carry the owned-audience strategy?**
The content calendar assumes X as the primary owned channel. A newsletter (powered by Resend, which
is already in the stack) would be a stickier owned audience but requires consistent effort. If Leif
has no appetite for a newsletter, X is fine. This decision affects whether the digest subscriber
list is also the "newsletter" list or whether those are separate.

**6. What is the brand risk tolerance for community self-promotion?**
Community channels (Reddit, HN) carry a real risk: post too promotionally and you get flagged or
banned; post too subtly and the link never gets clicked. The outreach-coordinator drafts will
thread this carefully, but Leif should personally decide which subreddits are worth the relationship
investment and whether he wants to be identifiably the founder in those posts or post more
anonymously.

---

*This document is a draft. Rewrite in Leif's voice before any external use.*

---

## marketing-strategist — Summary

**Status**: DONE
**Artifacts written**: `docs/marketing/marketing-plan.md`

**Strategy / Findings**:
- All claims in the plan are grounded in shipped behavior per `positioning-and-copy.md §6`. Pulse-dependent content is segregated into clearly labeled `[ACTIVATES WHEN PULSE SHIPS]` sections throughout — no Pulse copy runs until the code is live.
- Billing gate is respected throughout: no Pro feature framing, no pricing copy, no tier restrictions referenced while `BILLING_ENABLED=false`. This is an open question for Leif (§9 #1).
- The plan identifies **activation rate** (first watchlist item saved within 48h) as the single most important near-term metric — it gates everything else and is measurable today from Postgres without any analytics tool.
- The `/crypto/fear-and-greed` standalone page (Campaign B) is the highest-ROI SEO target with no Pulse dependency. It can ship independently now.
- The weekly digest is underused as both a retention and word-of-mouth surface. Improving its copy and adding the shareable-watchlist CTA is a quick win (outreach-coordinator writes draft; site-maintainer updates `email_templates.py`).
- Three ICP segments defined: cross-asset juggler (primary, no Pulse required), signal seeker (primary post-Pulse), Finviz escapee (SEO/map entry point).
- Channel strategy is sequenced for ~$0 budget: SEO and community first, earned media as a fast-follow. Plausible Analytics flagged as the one justified micro-spend (~$9/mo) to close the funnel blind spot.

**Keyword targets for `web-seo-engineer`**: Full handoff in §7. Immediate no-Pulse priorities: (1) per-page meta for existing routes `/`, `/market`, `/crypto`, `/earnings`; (2) `/crypto/fear-and-greed` Flask route with `Dataset` JSON-LD; (3) robots.txt + generated sitemap Flask route. Pulse-gated: `/signals/<TICKER>` programmatic universe, dynamic OG cards.

**Positioning for `outreach-coordinator`**: Full handoff in §8. Ships-today one-liner: "A clean, dark, all-in-one tracker for the stocks and crypto you actually care about — no brokerage required." Ten verified proof points listed. Tone: calm, honest, no hype — the honesty framing (labeled sentiment, explained scores) is the differentiator for skeptical Reddit/HN audiences, not a caveat to bury.

**Open questions for Leif**:
1. When does `BILLING_ENABLED` flip? (Determines all free vs. Pro copy decisions.)
2. What is the Pro launch copy plan once billing is live?
3. Is Plausible Analytics acceptable at ~$9/mo to close funnel blind spots?
4. What is the Pulse ship timeline? (Determines Phase B calendar firmness and PH launch scheduling.)
5. Newsletter vs. X as the primary owned-audience channel?
6. Brand risk tolerance for community self-promotion (Reddit anonymity vs. founder identity)?

**Recommended next agent**: `web-seo-engineer` (implement §7 priorities 1–3, no Pulse dependency) in parallel with `outreach-coordinator` (draft HN Show HN post, ships-today Reddit posts, improved digest email copy, BetaList/IH listing descriptions per §8).
