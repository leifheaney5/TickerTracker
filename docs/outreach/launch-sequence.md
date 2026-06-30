# Ticker Tracker — Launch Sequence

> DRAFT ONLY. Leif executes each step himself.
>
> Pulse gate: CLEARED as of 2026-06-30. Pulse (F1 + F2 — core score + Why panel)
> is confirmed live in production. All Pulse-forward copy is now the primary launch
> path. Phase 5 below is ACTIVE.
>
> Remaining gates still in force:
>   - F3 (signal-history sparkline / "shifted N days ago"): HOLD — data has not
>     accrued; claim would be misleading on day 1 for new users.
>   - F4 (smart/divergence alerts): HOLD — not discoverable in UI.
>   - F5 ("what changed since you last visited"): HOLD — no frontend component.
>   - Billing gate: BILLING_ENABLED=false at the time of writing. Do not mention
>     Pro tier pricing or enforcement in any launch copy until the billing gate is
>     lifted (see README.md Billing section and docs/ops/launch-gates.md). Freemium
>     + free tier features are safe to describe.

---

## Phase 0 — Pre-launch preparation (D-14 to D-1)

| Day | Action | Owner | Notes |
|---|---|---|---|
| D-14 | Confirm all shipped features work end-to-end in production on tickertracker.info. Test the watchlist flow, price alert email delivery, weekly digest, market map, crypto world view, analyst ratings, and Pulse score + Why panel on at least three different tickers. | Leif (or delegate to site-maintainer) | Do not launch if core flows are broken. Pulse is now a launch-blocking feature — verify it renders correctly on both stock and crypto cards. |
| D-14 | Take production screenshots for Product Hunt gallery (see product-hunt-kit.md §3 for shot list). Use real data, dark theme, 1440×900. Shot 2 is now the Pulse Why panel — open it on a ticker with a clear score and all four components visible. | Leif | Minimum 3 gallery images required; Shot 2 (Pulse) is now mandatory, not optional. |
| D-14 | Review billing gate status. If BILLING_ENABLED=false, confirm Pro tier is not mentioned in listing copy. | Leif | See README Billing section. |
| D-10 | Set up Product Hunt listing in draft (PH allows scheduling up to 30 days ahead). Upload Pulse-forward tagline (product-hunt-kit.md §1 primary: "One honest, transparent score for every ticker you watch."), description, gallery shots, thumbnail (240×240). | Leif | Use the Pulse-forward tagline from product-hunt-kit.md §1. |
| D-10 | Write and stage Pulse-forward maker first comment in a notes doc for copy-paste on launch day (product-hunt-kit.md §2 — the "Pulse-forward version — RECOMMENDED" block). | Leif | This is the primary first comment. The simpler alternate is the backup only. |
| D-7 | Post X teaser: "Building in public — launching [PROJECT NAME] on Product Hunt next week." No PH link yet. | Leif | Keep it brief, no hype language. |
| D-3 | Send hunter DM if using a hunter (Template A from product-hunt-kit.md §5). | Leif | Personalize; allow time to receive and review the app. |
| D-3 | Identify 5-10 existing users or close contacts to notify on launch day (Template 5 from templates.md). Do not send yet. | Leif | Confirm these are real users, not cold contacts. |
| D-1 | Send launch-day supporter notification (Template 5) to confirmed existing users/contacts. | Leif | Honest reactions only; no incentives. |
| D-1 | Post X teaser: "Launching on Product Hunt tomorrow — transparent signal scores for every stock and crypto ticker you watch." | Leif | Do not share the PH link until listing goes live. |
| D-1 | Confirm HN username is set up (personal handle, not brand name). Draft Show HN text in notes for copy-paste (the Pulse-forward body from channel-drafts.md). | Leif | See channel-drafts.md §Show HN. |

---

## Phase 1 — Product Hunt launch day (D-0)

Best day: Tuesday, Wednesday, or Thursday. Optimal time: 12:01 AM PST.

| Time (PST) | Action |
|---|---|
| 00:01 | Listing goes live (or schedule it). Post the Pulse-forward maker first comment immediately (product-hunt-kit.md §2 primary version). |
| 00:01 – 04:00 | Stay in the PH thread. Respond to every comment within 30 minutes. Answer questions directly; do not pitch. This window is the critical ranking window. Be ready to explain Pulse: what each component measures, why weights are fixed constants, and what "not a prediction" means concretely. |
| 04:00 | Post X Pulse launch thread (primary 4-tweet thread from channel-drafts.md §X primary thread). Include PH link. |
| 08:00 | Post to r/SideProject (Pulse-forward draft from channel-drafts.md). Include screenshots — Pulse Why panel is the recommended lead screenshot. Commit to answering all comments. |
| 12:00 | Post Show HN (Pulse-forward title + body from channel-drafts.md). Be in the thread for the next 2 hours to answer technical questions. |
| 18:00 – 23:00 | Final PH thread check. Thank commenters. If useful feedback has come in, add a brief update to the maker comment noting what you learned. |

---

## Phase 2 — Community distribution (D+1 to D+7)

These posts are spread out deliberately — posting to multiple subs on the same day
looks coordinated and reduces credibility.

| Day | Channel | Action | Condition |
|---|---|---|---|
| D+1 | r/stocks | Post Pulse-forward value-first draft from channel-drafts.md IF rules permit after Leif verifies the sidebar. If rules do not permit, skip. | Rules verification required first. |
| D+2 | r/investing | Do not post standalone. Look for an organic discussion thread and contribute a comment with maker disclosure (template in channel-drafts.md). | Only if a relevant thread exists. |
| D+3 | r/CryptoCurrency | Same approach as r/investing: comment in an organic thread only. Must have prior posting history in the sub. | Prior history required. |
| D+4 | Indie Hackers | Post a launch/milestone post on indiehackers.com: what you built, why, what you learned about the Pulse transparency approach, current traction. | Genuine milestone content only. |
| D+5 | X feature-spotlight singles | Post Spotlight E — Pulse (from channel-drafts.md). Lead with the transparency angle. | Space these 1-2 days apart. |
| D+6 | X feature-spotlight singles | Post Spotlight A (Alerts). | |
| D+7 | X feature-spotlight singles | Post Spotlight C (sentiment honesty). This one demonstrates brand voice authentically. | |

---

## Phase 3 — Newsletter and creator outreach (D+7 to D+30)

Slow, personalized, value-first. Do not batch-send. Each outreach takes 15-30 minutes
to personalize properly. Pulse is now a concrete, explainable pitch to editors — use it.

| Week | Action |
|---|---|
| Week 2 (D+7 to D+14) | Identify 3-5 newsletters from target-lists.md that are the strongest fit. Research their sponsorship or submission process. Pitch Pulse as the editorial angle: "a stock tracker that shows its math." Send Template 1 (newsletter inquiry) via their official contact form — not cold email to personal addresses. |
| Week 2 | Identify 2-3 YouTube channels or podcasts from target-lists.md where the fit is most specific. Watch recent content. Send Template 2 via their public collaboration inbox. |
| Week 3 (D+14 to D+21) | Follow up once with non-responding newsletter outreach (single follow-up, never twice). Begin second batch of 3-5 newsletters. |
| Week 3 | Post one more X feature-spotlight (Spotlight B — Market map or Spotlight D — Analyst ratings). |
| Week 4 (D+21 to D+30) | Review what is working. If r/stocks or r/investing organic thread opportunities arise, use them. Continue responding to any PH, Reddit, or HN comments that come in late. |

---

## Phase 4 — Handoff to pr-backlink-builder (D+7 onward, parallel track)

At D+7, Leif should route the following brief to pr-backlink-builder:

**Context to pass:**
- Live URL: tickertracker.info
- Product Hunt listing URL: [INSERT after launch]
- Show HN thread URL: [INSERT after posting]
- Shipped features: see README.md Features section; Pulse (core score + Why panel)
  is live as of 2026-06-30
- Positioning: docs/marketing/positioning-and-copy.md
- Brand guide: docs/brand/brand-guide.md
- Honesty constraint (still active): Do not pitch F3 (Pulse sparkline), F4
  (divergence alerts), or F5 ("what changed") to journalists or in directory copy.
  These are not meaningfully live for new users.
- Billing gate: BILLING_ENABLED=false. Do not mention paid tier enforcement until
  gate is lifted.

**What pr-backlink-builder owns from this point:**
- Finance/fintech journalist pitches (Pulse is a strong editorial angle: "the tracker
  that shows its math")
- Directory submissions (AlternativeTo, G2, Betalist, etc.)
- HARO / Qwoted responses
- Finance blog backlink acquisition
- Press release if warranted

**What outreach-coordinator retains:**
- Community channel posts (ongoing, as organic threads arise)
- X/Twitter feature-spotlight series (ongoing)
- Newsletter and creator outreach (Templates 1 and 2)

---

## Phase 5 — ACTIVE: Pulse launch burst (triggered 2026-06-30)

Pulse is live in production as of 2026-06-30. The following items from the previous
"future, timing TBD" plan are now in effect:

1. DONE (incorporated above): Product Hunt listing tagline and maker first comment
   are now Pulse-forward. The Pulse-forward maker comment (product-hunt-kit.md §2
   primary) replaces the ships-today version as the recommended first comment.
2. ACTIVE: X Pulse intro/launch thread (channel-drafts.md §X primary thread) is now
   the recommended launch thread. Post on D-0 at 04:00.
3. ACTIVE: r/stocks Pulse-forward draft (channel-drafts.md §r/stocks value-first
   variant) is now the recommended standalone post if rules permit.
4. CONSIDER: A second Show HN focused on Pulse architecture ("Show HN: Added a
   transparent 0–100 signal score to my stock/crypto tracker — here is how Pulse
   works") may be appropriate if D-0 Show HN gains traction and Pulse generates
   genuine technical questions. Do not post a second Show HN within 30 days of the
   first; gauge whether the technical angle warrants a standalone submission.
5. ACTIVE: Newsletter outreach now leads with Pulse as the editorial pitch angle.
   A concrete, explainable feature is a stronger editorial story than "I made a
   tracker."

Still waiting for lift (do not include in Pulse launch copy):
- F3 signal-history sparkline: gate lifts when at least a week of snapshots has
  accrued and the sparkline is meaningful for new users.
- F4 smart/divergence alerts: gate lifts when these are discoverable in the UI.
- F5 "what changed" digest: gate lifts when the frontend strip component ships.

Before including F3/F4/F5 in any copy, verify against positioning-and-copy.md §6
honesty checklist that every claim maps to shipped behavior visible to a first-time
user.

---

## Decision gates checklist

Before any public action, confirm:

- [x] tickertracker.info is live and all core flows work end-to-end (confirmed
      pre-launch)
- [ ] BILLING_ENABLED status: if false, remove all Pro tier pricing and enforcement
      language from all copy (still false — keep gate)
- [x] Pulse status: Pulse (F1 + F2) is live as of 2026-06-30. Pulse-forward copy
      is active. F3/F4/F5 remain gated.
- [ ] No claim in any live copy relies on a feature not yet in production (verify
      before each post — especially F3/F4/F5)
- [ ] All community post rules verified by Leif before posting to each sub
- [ ] Maker/commercial disclosure included in every community post and cold outreach
- [ ] No upvote incentivization in any supporter outreach
- [ ] CAN-SPAM opt-out included in any cold email
