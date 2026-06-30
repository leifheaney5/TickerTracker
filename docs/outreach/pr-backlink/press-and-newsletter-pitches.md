# Journalist & Newsletter Pitch List + Drafts

> **DRAFT — TEMPLATES ONLY. `pr-backlink-builder` has NOT emailed anyone.** Every
> pitch below is a starting point that **Leif must personalize, fact-check against a
> live read of the target, and send himself.**
>
> ## Before you send ANY pitch (compliance gate)
> - **Lawful basis:** You must have a legitimate reason + lawful basis to email each
>   recipient (CAN-SPAM / GDPR / PECR). Cold B2B press outreach is generally
>   permissible when it's relevant and you provide identity + opt-out — but confirm
>   per-recipient and per-jurisdiction. When in doubt, use the publication's public
>   tip line / submission form rather than a scraped personal inbox.
> - **No scraped-email blasts. No fake personas. One real person, one real reason.**
> - **Every email must include:** who you are, why you're emailing *them specifically*,
>   a clear opt-out ("If this isn't your beat, tell me and I won't follow up"), and a
>   real reply-to. These are baked into the templates below — keep them.
> - **Honesty rule:** pitch **shipped** features only. Do NOT mention Pulse, the "Why"
>   panel, indicators, signal history, or smart/divergence alerts. If a writer asks
>   "do you predict prices / give advice / use AI?" the answer is **no** — it's an
>   honest, explainable tracker; sentiment is a labeled headline-keyword read.
>
> **Lane:** these are earned-media press/newsletter pitches. Reddit/HN/X/Product Hunt
> launch posts are **outreach-coordinator's** — not here.

---

## Shipped proof points (the only claims any pitch may use)

- Unified **stocks + crypto** in one dark dashboard — no brokerage required, free to browse.
- Curated **watchlist** with per-row price **targets**.
- **Email price alerts** when a target is hit + a **weekly digest** (Resend + Railway cron).
- **Finviz-style market map** (treemap) + sector performance; a **crypto map**.
- **News "mood" chips** — a transparent **headline-keyword** sentiment read (explicitly *not* ML; labeled as such).
- **Analyst ratings + price targets** (Finnhub).
- Live **crypto Fear & Greed** index (alternative.me).
- **Shareable read-only watchlist links** (`/s/<token>`).
- Light/Dark theme; **PWA** home-screen install.
- Runs on **real data** (Finnhub, Yahoo, CoinGecko, alternative.me) with graceful
  fallbacks so the app never shows a broken page; **CI-gated** deploys.
- **Honest caveats** (state them — they build trust): indie/solo project; no brokerage
  sync; no options/insider/short-interest data; no social-media sentiment; no
  predictions; no advice.

---

## Target list (fintech / indie-SaaS / retail-investing writers & newsletters)

| # | Target | Outlet / newsletter | Beat fit | Best contact route | Notes / rules |
|---|---|---|---|---|---|
| T1 | **Rob Berger** | robberger.com + YouTube | Retail investing tools, trackers, DIY investors | Site contact / newsletter reply | Creator-led, honesty-first; ideal for a value-first indie note. |
| T2 | **The Daily Upside** editorial | thedailyupside.com | Markets/finance, broad retail audience | Public tip/contact | Won't run a product ad — lead with a **data story**, not the product. |
| T3 | **Alex Johnson** | Fintech Takes (newsletter.fintechtakes.com) | Fintech analysis, industry POV | Newsletter reply / contact | Analyst, high bar; pitch an *idea* (honest retail signal layer), not a feature list. |
| T4 | **Indie Hackers** community + newsletter | indiehackers.com | Indie/bootstrapped maker stories | Free product post + profile | A **maker story** (not a launch blast). Real numbers + transparency resonate. |
| T5 | **Readless / Mint Studios fintech-newsletter authors** | various Substacks (from research lists) | "Tools we're watching" segments | Per-newsletter contact | Use the curated lists as a sourcing index; vet each for fit + self-promo rules. |
| T6 | **Smaller retail-investing Substacks** (dividend/ETF/beginner-investor niches) | various | Beginner-friendly tools, free options | Newsletter reply | Higher reply rates than big names; the "free, no-brokerage, calm UI" angle lands. |

> **Sourcing more targets:** the research surfaced curation hubs (Readless "Best
> Finance Newsletters 2026", Mint Studios "Top Fintech Newsletters", Substack Top
> Finance). Use them to expand T5/T6 — but vet each newsletter's audience + promo
> rules before adding. Quality over volume.

---

## Pitch drafts (personalize the [brackets]; keep identity + opt-out)

### Draft for T1 — Rob Berger (retail-investing tools)

**Subject:** A free, no-brokerage stock + crypto tracker for your tools coverage

**Body:**
> Hi Rob,
>
> I'm Leif, an indie developer — I read your investment-tracking-apps roundup and
> noticed most options either require linking a brokerage or split stocks and crypto
> across separate apps. I built something for the gap and thought it might be worth a
> look for a future update.
>
> **Ticker Tracker** (tickertracker.info) is a free, dark, all-in-one dashboard: a
> curated watchlist with price targets, email alerts when a target hits, a weekly
> digest, a Finviz-style market map, analyst ratings, news sentiment, and a live
> crypto Fear & Greed index — stocks and crypto on one surface, no brokerage linking.
>
> Honest about what it isn't: it's a solo indie project, not a pro terminal — no
> brokerage sync, no options data, no predictions or advice. The news "mood" chips are
> a plain headline-keyword read and I label them as exactly that, not an AI model.
>
> If it's useful, happy to give you a quick walkthrough or a no-strings account. If
> trackers aren't on your radar right now, just say the word and I won't follow up.
>
> Thanks for the genuinely useful reviews,
> Leif Heaney — leifheaney.com — [reply-to email]

**Why them:** Rob covers exactly this tool category for a DIY-investor audience and
rewards honesty over hype. *Status: template — needs Leif's personalization + consent check.*

---

### Draft for T2 — The Daily Upside (data-story angle, not a product pitch)

**Subject:** Data tip: what a week of news-headline sentiment looked like across the megacaps

**Body:**
> Hi [editor name],
>
> Quick data tip, not a pitch. I run Ticker Tracker, an indie market dashboard, and
> we compute a transparent **news-headline sentiment** read across the names people
> watch most. Over [date range], [one honest, specific finding — e.g. "headline
> sentiment for the Mag 7 diverged sharply from price: X kept positive coverage while
> the tape fell"].
>
> It's a simple, fully explainable keyword read (not an ML black box — I'm upfront
> about the method), built only from public news headlines. If a "what the headlines
> actually said this week" angle is useful for a brief, I can share the underlying
> numbers and methodology, and you're welcome to link the source.
>
> No ask beyond that. If this isn't your kind of tip, no worries — I won't follow up.
>
> Leif Heaney — Ticker Tracker (tickertracker.info) — [reply-to]

**Why them:** Newsletters run *data*, not ads. This leads with a linkable, honest
finding and offers the methodology. **Requires a real, verified finding before
sending — see `data-story-angles.md`.** *Status: template — fill the finding, fact-check, then send.*

---

### Draft for T3 — Alex Johnson / Fintech Takes (idea-led)

**Subject:** The honest-by-construction angle on retail "signals"

**Body:**
> Hi Alex,
>
> Longtime reader. One idea from the building trenches, in case it's useful fodder:
> nearly every retail tool ships a "signal" that's either buried or a black box, and
> the industry's defaulting to "AI score" language that users can't inspect.
>
> I took the opposite bet with Ticker Tracker (indie, solo): show the inputs, label
> the heuristics, and never imply prediction. Today that means an explicit
> headline-keyword sentiment read (labeled as exactly that), analyst-consensus
> context, and a crypto Fear & Greed reading — public signals, summarized honestly,
> no advice.
>
> Not pitching coverage — more curious whether you see "explainable-by-default" as a
> real differentiator for retail tools or just table stakes now. Happy to share what
> users actually respond to. If this isn't interesting, no need to reply.
>
> Leif — tickertracker.info — [reply-to]

**Why them:** Analyst-led newsletter; an *idea* with an honest POV travels further
than a feature list. *Status: template — personalize, confirm consent.*

---

### Draft for T4 — Indie Hackers (maker story; community post, not email)

**Subject / title:** I built an honest, explainable stock + crypto tracker solo — here's the real-data architecture

**Body (post, not cold email):**
> Built Ticker Tracker (tickertracker.info) solo: a dark, all-in-one stock + crypto
> dashboard — watchlist + price targets, email alerts + weekly digest, a Finviz-style
> market map, analyst ratings, news sentiment, crypto Fear & Greed. Freemium, free to
> browse, no brokerage required.
>
> The engineering bit makers might care about: every data provider (Finnhub, Yahoo,
> CoinGecko, alternative.me) falls back to a deterministic seeded mock, so the app
> never shows a broken page even when an upstream API is down. CI-gated deploys.
>
> Design rule I held to: if I can't show where a number comes from, it doesn't ship.
> The sentiment read is a labeled headline-keyword heuristic — no "AI prediction"
> claims, no advice. Happy to talk through the fallback architecture or the freemium
> model. Feedback welcome.

**Why them:** IH rewards transparency + real architecture detail; no approval gate.
**This is a maker/build post — distinct from outreach-coordinator's Show HN/PH
launch.** *Status: template — post from Leif's account when ready.*

---

### Draft for T6 — beginner/dividend retail Substack (generic, adaptable)

**Subject:** A free, calm tracker for readers who don't want to link a brokerage

**Body:**
> Hi [name],
>
> I read [specific recent post] — your readers clearly want simple, trustworthy tools.
> I built a free one that might fit: Ticker Tracker (tickertracker.info), a dark
> dashboard that tracks stocks and crypto together — watchlist, price targets, email
> alerts, weekly digest, market map — with no brokerage linking required.
>
> It's an indie project and I'm honest about the limits (no brokerage sync, no
> predictions, no advice; sentiment is a labeled headline read). If it's a fit for a
> "tools I like" mention I'd be grateful, and happy to set up free accounts for you to
> try. If not, no problem at all — just let me know and I'll leave it there.
>
> Leif Heaney — leifheaney.com — [reply-to]

**Why them:** Smaller newsletters reply more and value free, honest, beginner-friendly
tools. *Status: template — personalize per newsletter; confirm their promo rules + consent.*

---

## Ready-to-send status

| Pitch | Personalized? | Finding/fact filled? | Consent/lawful-basis confirmed? | Ready? |
|---|---|---|---|---|
| T1 Rob Berger | needs [name done] | n/a | **Leif to confirm** | template |
| T2 Daily Upside | needs editor name | **needs real verified finding** | **Leif to confirm** | template |
| T3 Fintech Takes | light | n/a | **Leif to confirm** | template |
| T4 Indie Hackers | ready to post (Leif's account) | n/a | n/a (own post) | template |
| T6 generic Substack | per-target | n/a | **Leif to confirm** | template |

> None are "ready-to-send" until Leif personalizes, fact-checks, and confirms a
> lawful basis to contact each recipient. `pr-backlink-builder` sends nothing.

## Hand-off
- **marketing-strategist:** owns the canonical positioning these draw from — flag if any pitch drifts from approved messaging.
- **data-story-angles.md:** T2's finding must come from a verified angle there.
