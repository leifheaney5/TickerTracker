# Ticker Tracker — Launch Sequence

> DRAFT ONLY. Leif executes each step himself.
>
> Honesty gate: This sequence assumes Pulse is NOT live. If Pulse ships before
> launch, revise the messaging to the Pulse-forward variants (marked HOLD in
> channel-drafts.md and product-hunt-kit.md) but do not change the channel
> sequence itself.
>
> Billing gate: BILLING_ENABLED=false at the time of writing. Do not mention Pro
> tier pricing or enforcement in any launch copy until the billing gate is lifted
> (see README.md Billing section and docs/ops/launch-gates.md). Freemium + free
> tier features are safe to describe.

---

## Phase 0 — Pre-launch preparation (D-14 to D-1)

| Day | Action | Owner | Notes |
|---|---|---|---|
| D-14 | Confirm all shipped features work end-to-end in production on tickertracker.info. Test the watchlist flow, price alert email delivery, weekly digest, market map, crypto world view, analyst ratings. | Leif (or delegate to site-maintainer) | Do not launch if core flows are broken. |
| D-14 | Take production screenshots for Product Hunt gallery (see product-hunt-kit.md §3 for shot list). Use real data, dark theme, 1440×900. | Leif | Minimum 3 gallery images required. |
| D-14 | Review billing gate status. If BILLING_ENABLED=false, confirm Pro tier is not mentioned in listing copy. | Leif | See README Billing section. |
| D-10 | Set up Product Hunt listing in draft (PH allows scheduling up to 30 days ahead). Upload tagline, description, gallery shots, thumbnail (240×240). | Leif | Use ships-today tagline from product-hunt-kit.md §1. |
| D-10 | Write and stage maker first comment in a notes doc for copy-paste on launch day (ships-today version from product-hunt-kit.md §2). | Leif | Do not use the Pulse-forward version. |
| D-7 | Post X teaser: "Building in public — launching [PROJECT NAME] on Product Hunt next week." No PH link yet. | Leif | Keep it brief, no hype language. |
| D-3 | Send hunter DM if using a hunter (Template A from product-hunt-kit.md §5). | Leif | Personalize; allow time to receive and review the app. |
| D-3 | Identify 5-10 existing users or close contacts to notify on launch day (Template 5 from templates.md). Do not send yet. | Leif | Confirm these are real users, not cold contacts. |
| D-1 | Send launch-day supporter notification (Template 5) to confirmed existing users/contacts. | Leif | Honest reactions only; no incentives. |
| D-1 | Post X teaser: "Launching on Product Hunt tomorrow — [brief one-line description]." | Leif | Do not share the PH link until listing goes live. |
| D-1 | Confirm HN username is set up (personal handle, not brand name). Draft Show HN text in notes for copy-paste. | Leif | See channel-drafts.md §Show HN. |

---

## Phase 1 — Product Hunt launch day (D-0)

Best day: Tuesday, Wednesday, or Thursday. Optimal time: 12:01 AM PST.

| Time (PST) | Action |
|---|---|
| 00:01 | Listing goes live (or schedule it). Post maker first comment immediately — the ships-today version. |
| 00:01 – 04:00 | Stay in the PH thread. Respond to every comment within 30 minutes. Answer questions directly; do not pitch. This window is the critical ranking window. |
| 04:00 | Post X launch thread (Tweets 1-4 from channel-drafts.md). Include PH link. |
| 08:00 | Post to r/SideProject (draft from channel-drafts.md). Include screenshots. Commit to answering all comments. |
| 12:00 | Post Show HN (title + body from channel-drafts.md). Be in the thread for the next 2 hours to answer technical questions. |
| 18:00 – 23:00 | Final PH thread check. Thank commenters. If useful feedback has come in, add a brief update to the maker comment noting what you learned. |

---

## Phase 2 — Community distribution (D+1 to D+7)

These posts are spread out deliberately — posting to multiple subs on the same day
looks coordinated and reduces credibility.

| Day | Channel | Action | Condition |
|---|---|---|---|
| D+1 | r/stocks | Post value-first draft from channel-drafts.md IF rules permit after Leif verifies the sidebar. If rules do not permit, skip. | Rules verification required first. |
| D+2 | r/investing | Do not post standalone. Look for an organic discussion thread and contribute a comment with maker disclosure (template in channel-drafts.md). | Only if a relevant thread exists. |
| D+3 | r/CryptoCurrency | Same approach as r/investing: comment in an organic thread only. Must have prior posting history in the sub. | Prior history required. |
| D+4 | Indie Hackers | Post a launch/milestone post on indiehackers.com: what you built, why, what you learned, current traction. | Genuine milestone content only. |
| D+5 | X feature-spotlight singles | Post one feature-spotlight tweet (Spotlight A — Alerts) from channel-drafts.md. | Space these 1-2 days apart. |
| D+6 | X feature-spotlight singles | Post Spotlight B (market map). | |
| D+7 | X feature-spotlight singles | Post Spotlight C (sentiment honesty). This one demonstrates brand voice authentically. | |

---

## Phase 3 — Newsletter and creator outreach (D+7 to D+30)

Slow, personalized, value-first. Do not batch-send. Each outreach takes 15-30 minutes
to personalize properly.

| Week | Action |
|---|---|
| Week 2 (D+7 to D+14) | Identify 3-5 newsletters from target-lists.md that are the strongest fit. Research their sponsorship or submission process. Send Template 1 (newsletter inquiry) via their official contact form — not cold email to personal addresses. |
| Week 2 | Identify 2-3 YouTube channels or podcasts from target-lists.md where the fit is most specific. Watch recent content. Send Template 2 via their public collaboration inbox. |
| Week 3 (D+14 to D+21) | Follow up once with non-responding newsletter outreach (single follow-up, never twice). Begin second batch of 3-5 newsletters. |
| Week 3 | Post one more X feature-spotlight (Spotlight D — Analyst ratings). |
| Week 4 (D+21 to D+30) | Review what is working. If r/stocks or r/investing organic thread opportunities arise, use them. Continue responding to any PH, Reddit, or HN comments that come in late. |

---

## Phase 4 — Handoff to pr-backlink-builder (D+7 onward, parallel track)

At D+7, Leif should route the following brief to pr-backlink-builder:

**Context to pass:**
- Live URL: tickertracker.info
- Product Hunt listing URL: [INSERT after launch]
- Show HN thread URL: [INSERT after posting]
- Shipped features: see README.md Features section
- Positioning: docs/marketing/positioning-and-copy.md
- Brand guide: docs/brand/brand-guide.md
- Honesty constraint: Pulse is not live. Do not pitch Pulse, the "Why" panel,
  smart/divergence alerts, or Pulse history to journalists or in directory copy.
- Billing gate: BILLING_ENABLED=false. Do not mention paid tier enforcement until gate
  is lifted.

**What pr-backlink-builder owns from this point:**
- Finance/fintech journalist pitches
- Directory submissions (AlternativeTo, G2, Betalist, etc.)
- HARO / Qwoted responses
- Finance blog backlink acquisition
- Press release if warranted

**What outreach-coordinator retains:**
- Community channel posts (ongoing, as organic threads arise)
- X/Twitter feature-spotlight series (ongoing)
- Newsletter and creator outreach (Templates 1 and 2)

---

## Phase 5 — Pulse launch burst (future, timing TBD)

When Pulse is merged and live in production:

1. Update the Product Hunt listing description to include the Pulse angle (the HOLD
   maker comment from product-hunt-kit.md §2 becomes the new first comment on an update
   post or a comment update).
2. Activate the HOLD social posts (X Pulse intro thread from channel-drafts.md HOLD
   bucket).
3. Activate the HOLD Reddit posts (Pulse-forward r/stocks and r/investing drafts from
   channel-drafts.md HOLD bucket).
4. Run a second Show HN if the technical scope of Pulse is significant enough to
   warrant it ("Show HN: Added a transparent 0-100 signal score to my stock/crypto
   tracker — here's how Pulse works").
5. Resume newsletter outreach with the Pulse angle (a concrete, explainable feature is
   a stronger editorial pitch than "I made a tracker").

Before activating any Pulse copy, verify against positioning-and-copy.md §6 honesty
checklist that every claim maps to shipped behavior.

---

## Decision gates checklist

Before any public action, confirm:

- [ ] tickertracker.info is live and all core flows work end-to-end
- [ ] BILLING_ENABLED status: if false, remove all Pro tier pricing and enforcement
      language from all copy
- [ ] Pulse status: if not live, all HOLD copy stays in the hold bucket
- [ ] No claim in any live copy relies on a feature not yet in production
- [ ] All community post rules verified by Leif before posting to each sub
- [ ] Maker/commercial disclosure included in every community post and cold outreach
- [ ] No upvote incentivization in any supporter outreach
- [ ] CAN-SPAM opt-out included in any cold email
