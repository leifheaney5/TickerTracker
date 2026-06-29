# Design — Growth & Web subagents (marketing / SEO-web / outreach)

**Date:** 2026-06-28
**Status:** Approved, implemented in this branch.

## Goal
Extend the Ticker Tracker subagent network with three go-to-market agents, without
overlapping each other or the existing engineering roster.

## Decisions (from brainstorming)
- **Action boundary:** `marketing-strategist` and `outreach-coordinator` are
  DRAFT-ONLY (write artifacts under `docs/`, never publish/post/send).
  `web-seo-engineer` may auto-commit low-risk technical-SEO code (mirrors
  `site-maintainer`'s tier); visual-identity / CSP / copy changes are flagged.
- **SEO/brand split = strategy vs. implementation:** `marketing-strategist` owns
  brand voice + messaging + SEO *content* strategy (which keywords/topics, intent).
  `web-seo-engineer` owns *implementation* (meta/OG/JSON-LD/sitemap/Core Web Vitals)
  + brand *visual* assets (favicon, manifest, OG images, logo/color usage).

## The three agents
1. **marketing-strategist** (draft → `docs/marketing/`) — the "what": positioning,
   messaging, voice, value props, campaigns, copy, SEO content strategy.
2. **web-seo-engineer** (read/write, auto-commit low-risk SEO) — the "how":
   on-page SEO, structured data, sitemap/robots, CWV, brand visual assets.
3. **outreach-coordinator** (draft → `docs/outreach/`) — distribution: Product Hunt
   kit, channel-tailored post drafts (rules-aware), target lists, launch sequencing.

## Orchestration
- **Triggers:** marketing/positioning/copy → marketing-strategist; SEO/meta/schema/
  sitemap/CWV/brand-assets → web-seo-engineer; outreach/launch/PH/Reddit/PR →
  outreach-coordinator.
- **Signature chain:** marketing-strategist (strategy + keywords + copy) →
  web-seo-engineer (implement) + outreach-coordinator (distribution drafts), in
  parallel. hf-engineer UX value props can feed marketing-strategist.

## Non-overlap with existing roster
- Brand VOICE = marketing; brand VISUAL/technical assets = web-seo.
- SEO STRATEGY = marketing; SEO IMPLEMENTATION = web-seo.
- web-seo writes code like site-maintainer but scoped to SEO/brand assets; deeper
  app/route/CSP changes still route to site-maintainer.

## Build note
Authored as agent definition files (same as the original 5) rather than a code
implementation plan; no app code changes. Full network is now 8 local agents +
`database-optimizer` (external VoltAgent, not installed).
