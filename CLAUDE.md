# Ticker Tracker — Subagent Network

## App context
Ticker Tracker (tickertracker.info) is a stock + crypto market dashboard.
Dark theme PWA. Authenticated users get personal watchlists, analyst ratings,
market news, and multi-signal market sentiment (Fear & Greed, news sentiment,
social volume). Live price data from Finnhub (WebSocket + REST) and Yahoo Finance
(REST fallback). Email alerts via Resend. Railway cron handles scheduled jobs
(price snapshots, alert delivery, sentiment aggregation).

## Stack
- **Backend**: Flask + SQLAlchemy 2 + psycopg v3 + Resend + Railway cron
- **Frontend**: React 18 + Vite + TypeScript + Zustand
- **Tests**: pytest + Vitest + Playwright
- **Data providers**: Finnhub (primary), Yahoo Finance (fallback/supplemental)
- **Deploy**: Railway

---

## Subagent Roster

**Engineering**

| Agent | File | Model | Role | Writes |
|---|---|---|---|---|
| `site-maintainer` | `.claude/agents/site-maintainer.md` | sonnet | Bug fixes, features, migrations, cron jobs | code |
| `security-auditor` | `.claude/agents/security-auditor.md` | sonnet | OWASP, auth, API key hygiene, rate limiting | read-only |
| `e2e-engineer` | `.claude/agents/e2e-engineer.md` | sonnet | Playwright authoring, execution, triage | tests |
| `hf-engineer` | `.claude/agents/hf-engineer.md` | sonnet | UX research, feature specs, accessibility | read-only |
| `performance-engineer` | `.claude/agents/performance-engineer.md` | sonnet | Query perf, Finnhub/YF caching, bundle size | read-only |
| `database-optimizer` _(optional, not installed)_ | external — VoltAgent `voltagent-data-ai` (see note below) | sonnet | Slow query analysis, indexing, psycopg v3 | code |

**Growth & Web**

| Agent | File | Model | Role | Writes |
|---|---|---|---|---|
| `marketing-strategist` | `.claude/agents/marketing-strategist.md` | sonnet | Positioning, messaging, brand voice, copy, SEO content strategy | drafts → `docs/marketing/` |
| `web-seo-engineer` | `.claude/agents/web-seo-engineer.md` | sonnet | On-page SEO (meta/OG/JSON-LD/sitemap), Core Web Vitals, brand visual assets | code (auto-commit low-risk SEO) |
| `outreach-coordinator` | `.claude/agents/outreach-coordinator.md` | sonnet | Distribution: Product Hunt/Reddit/HN/X drafts, target lists, launch sequencing | drafts → `docs/outreach/` |
| `pr-backlink-builder` | `.claude/agents/pr-backlink-builder.md` | sonnet | Earned media + off-page SEO: journalist/newsletter pitches, HARO responses, directory/listicle submissions, guest-post angles, backlink pipeline | drafts → `docs/outreach/pr-backlink/` |

> **Action boundaries:** `marketing-strategist`, `outreach-coordinator`, and
> `pr-backlink-builder` are DRAFT-ONLY — they never publish, post, pitch, submit, or
> send; they write artifacts for Leif to review. `web-seo-engineer` may auto-commit
> low-risk technical-SEO code (like `site-maintainer`'s tier) but flags
> visual-identity / CSP / copy changes.
>
> **`outreach-coordinator` vs. `pr-backlink-builder`:** outreach-coordinator owns the
> *launch burst* on community channels (Product Hunt / Reddit / HN / X) and launch-day
> sequencing; pr-backlink-builder owns *earned media + off-page SEO* that compounds
> over time (journalist/newsletter pitches, HARO, directories/roundups, guest posts,
> the backlink pipeline). Won/target backlinks flow from pr-backlink-builder →
> `web-seo-engineer`.
>
> **`database-optimizer` is not installed locally** — it's an external VoltAgent
> agent (`voltagent-data-ai`). Install before routing to it:
> `claude plugin marketplace add VoltAgent/awesome-claude-code-subagents`
> `claude plugin install voltagent-data-ai`

---

## Orchestration Rules

### Parallel dispatch — independent tasks, no shared write targets
```
"Full health check"
  → security-auditor + e2e-engineer + performance-engineer (parallel)
  → synthesize into prioritized action list

"Review the auth layer and run tests"
  → security-auditor (auth audit) + e2e-engineer (auth flow tests) (parallel)

"UX review + perf audit"
  → hf-engineer + performance-engineer (parallel)

"Launch prep / go-to-market"
  → marketing-strategist (positioning + copy + keyword strategy)
  → then web-seo-engineer (implement SEO) + outreach-coordinator (channel drafts)
    + pr-backlink-builder (earned-media + backlink pipeline) (parallel)
```

### Sequential chains — output of one feeds the next
```
security-auditor finds vuln
  → site-maintainer patches it
  → e2e-engineer verifies fix

hf-engineer produces feature spec
  → site-maintainer implements it
  → e2e-engineer writes e2e tests for the new flow

database-optimizer identifies slow queries
  → site-maintainer applies index migrations

performance-engineer flags Finnhub over-fetching
  → site-maintainer adds caching layer

marketing-strategist defines SEO keyword/content strategy
  → web-seo-engineer implements on-page tags + structured data

marketing-strategist writes positioning + landing copy
  → web-seo-engineer builds the SEO-structured page (+ site-maintainer if app code)
  → outreach-coordinator adapts the message into channel-specific launch drafts

marketing-strategist supplies positioning + proof points
  → pr-backlink-builder drafts journalist/newsletter pitches + backlink pipeline
  → web-seo-engineer tracks won links / builds any linkable data-asset page

hf-engineer surfaces a UX value prop
  → marketing-strategist turns it into messaging
```

### Delegation trigger phrases
| User says | Dispatch to |
|---|---|
| "fix", "refactor", "implement", "add", "update" | `site-maintainer` |
| "audit", "security", "CVE", "OWASP", "vuln", "key leak" | `security-auditor` |
| "test", "e2e", "playwright", "flaky", "coverage" | `e2e-engineer` |
| "UX", "feature idea", "improve", "usability", "user flow" | `hf-engineer` |
| "slow", "latency", "perf", "bottleneck", "bundle" | `performance-engineer` |
| "query", "index", "postgres", "slow query", "N+1" | `database-optimizer` |
| "marketing", "positioning", "messaging", "copy", "tagline", "campaign", "value prop" | `marketing-strategist` |
| "SEO", "meta tags", "structured data", "schema", "sitemap", "open graph", "page speed", "Core Web Vitals", "favicon", "brand assets" | `web-seo-engineer` |
| "outreach", "launch", "Product Hunt", "Reddit", "Hacker News", "social post", "distribution", "community" | `outreach-coordinator` |
| "PR", "press", "backlinks", "link building", "journalist", "newsletter pitch", "HARO", "directory", "roundup", "guest post", "earned media" | `pr-backlink-builder` |
| "health check", "full audit", "review everything" | engineering core parallel (security + e2e + performance + hf) |
| "launch prep", "go-to-market", "growth" | `marketing-strategist` → web-seo-engineer + outreach-coordinator + pr-backlink-builder |

### Context passing rules
- Always pass relevant file paths, module names, and route names when delegating
- For market-data tasks: specify which provider (Finnhub vs Yahoo) and whether it's
  REST or WebSocket, plus the relevant rate limit tier
- When chaining: pass full output summary from upstream agent, never just a reference
- Never ask a subagent to re-read files the parent already summarized

---

## Financial Domain Conventions

### Market data providers
Provider wrappers live in `backend/providers/` (one file per source); the
service layer that composes them is in `backend/services/`.
- **Finnhub** (`backend/providers/finnhub.py`): primary for quotes/analyst
  ratings/news. WebSocket (`wss://ws.finnhub.io`) for live price streaming.
  Free tier: 60 API calls/minute. Respect this; use caching aggressively.
  API key in `FINNHUB_API_KEY` env var — never in source.
- **Yahoo Finance** (`backend/providers/yahoo.py`): supplemental/fallback for
  historical OHLCV, fundamentals. Unofficial API — no key required but respect
  rate limits; use exponential backoff. Wrap all Yahoo calls in try/except;
  treat failures as non-fatal.
- **CoinGecko** (`backend/providers/coingecko.py`): crypto prices/market data.
- **Fear & Greed** (`backend/providers/fng.py`): sentiment index source.
- **Never** call any provider from the frontend. All market data flows
  backend → database/cache (`backend/cache.py`) → frontend.

### Caching strategy
- Finnhub REST quotes: cache 15 seconds minimum (free tier constraint)
- Yahoo Finance: cache 5 minutes minimum
- Analyst ratings: cache 24 hours (rarely updated)
- News: cache 10 minutes
- Sentiment aggregates: computed by cron job, read from DB — not live

### Watchlist / alert domain
- Watchlist items are user-owned; all reads/writes require auth
- Price alerts stored in DB with threshold, direction (above/below), and
  notification status; the `alerts` cron job (`backend/jobs.py check-alerts`)
  evaluates and triggers Resend emails
- Alert email subjects are templated — never inject user-controlled ticker
  symbols into subjects without sanitization (XSS/injection vector)

### Market hours awareness
- e2e tests must not depend on market hours or live prices
  (mock Finnhub/Yahoo at the API boundary in tests)
- Cron jobs should handle weekends/holidays gracefully (no-op, not error)
- Sentiment data: Fear & Greed is daily; news sentiment and social volume
  update on different cadences — document each source's update frequency
  in any code that touches them

---

## Project Conventions

Backend is a flat `backend/` package (no `app/` dir, no per-route blueprints).
- App factory + most routes in `backend/app.py`; auth routes in `backend/auth/routes.py`
- SQLAlchemy models in `backend/models.py` (single module); migrations via
  Flask-Migrate in `backend/migrations/`
- DB session/engine in `backend/db.py`; caching helpers in `backend/cache.py`
- Use psycopg v3 patterns via SQLAlchemy — no raw psycopg2 idioms
- Provider wrappers in `backend/providers/*.py`; composed business logic in
  `backend/services/*.py` (quotes, news, ratings, alerts, digest, screens, …)
- Email via `backend/providers/email.py` + `email_templates.py` (Resend SDK only — never raw SMTP)
- Cron jobs run via `backend/jobs.py` subcommands, declared in the `Procfile`
  (`alerts`, `digest`); Railway deploy config in `railway.json`
- All secrets via `os.environ.get()` — never hardcoded
- pytest fixtures in `backend/tests/conftest.py`

### TypeScript / React
- Components in `frontend/src/components/`; pages in `frontend/src/views/`
- Global state (watchlist, auth, market data) in `frontend/src/state/store.ts` (Zustand)
- All API calls in `frontend/src/api/` — no inline fetch in components
- WebSocket connection managed in a dedicated store/hook, not scattered across components
- Strict TypeScript; no `any`; use `unknown` + type guards
- Vitest for unit tests; co-locate (`*.test.ts`)
- `@/` alias maps to `src/`

### Playwright
- Config at `frontend/playwright.config.ts`; tests in `frontend/e2e/`
- Run via `npm run e2e` from `frontend/`
- Base URL from `PLAYWRIGHT_BASE_URL` env var
- Never assert on live price values — assert on format and presence only
- Mock Finnhub and Yahoo Finance at network level in all tests
- Use `data-testid` on all interactive elements

### Git / Shipping
- Commit format: `type(scope): description` e.g. `fix(auth): handle expired JWT`
- Run `pytest` (from `backend/`) + `npm run test` (from `frontend/`) before any
  commit; `npm run e2e` before marking any e2e task done
- Never push to `main` directly; use feature branches

---

## Automated Guardrails (Claude Code hooks)

Enforced automatically via `.claude/settings.json` (tracked, shared across all
worktrees). Scripts live in `.claude/hooks/` (Node, no external deps):

| Hook | Event / scope | What it does |
|---|---|---|
| `secret-guard.js` | `PreToolUse` `Write`/`Edit` | **Blocks** hardcoded secrets (Stripe/Resend/AWS keys, private-key blocks, or a sensitive env-var name assigned a string literal) in source. Allows env lookups, placeholders, `.env*`. |
| `frontend-provider-guard.js` | `PreToolUse` `Write`/`Edit` | **Blocks** adding a Finnhub/Yahoo/CoinGecko host to a `frontend/**` source file (data must flow backend→cache→frontend). Skips test/mock files. |
| `migration-guard.js` | `PreToolUse` `Write`/`Edit` | **Blocks** editing an already-committed Flask-Migrate revision in `migrations/versions/`. New (untracked) migrations pass. |
| `protect-main.js` | `PreToolUse` `Bash` | **Blocks** direct push to `main` (incl. `HEAD:main`, `--force`, bare push on `main`). Feature-branch pushes pass. |
| `dangerous-bash-guard.js` | `PreToolUse` `Bash` | **Blocks** clearly destructive ops: broad `rm -rf`, `flask db downgrade`, SQL `DROP`/`TRUNCATE`, `railway down`/delete. |
| `commit-confidence.js` | `PreToolUse` `Bash` | **Blocks** `git commit` unless the message has a `Confidence: <0-100>/100` trailer — forces a stated confidence score (and one-line justification to the user) before every commit. |
| `oxlint-fix.js` | `PostToolUse` `Write`/`Edit` | Best-effort `oxlint --fix` (safe fixes) on edited `frontend/**` JS/TS. Never blocks. |
| `py-syntax-check.js` | `PostToolUse` `Write`/`Edit` | `py_compile` on edited `.py`; feeds any `SyntaxError` back as context. Never blocks. |
| `related-test-runner.js` | `PostToolUse` `Write`/`Edit` | If an edited `frontend/src` file has a related test, runs `vitest related --run` and feeds failures back. Self-gating, never blocks. |
| `context-injector.js` | `UserPromptSubmit` | Injects current version, branch, working-tree status, worktree flag, `BILLING_ENABLED` into each prompt. |
| `session-briefing.js` | `SessionStart` | Prints version / branch / tree / recent commits / open-PR count at session start. |
| `subagent-logger.js` | `SubagentStop` | Appends an audit line per finished subagent to `.claude/logs/subagents.log` (gitignored). |
| `test-before-done.js` | `Stop` | If backend/frontend source changed, runs scoped `pytest -q` / `vitest related`; **blocks finishing** while they fail (loop-guarded). |
| `typecheck-frontend.js` | `Stop` | If `frontend/src` TS changed, runs `tsc --noEmit`; **blocks finishing** on type errors (loop-guarded). |
| `changelog-reminder.js` | `Stop` | If source changed but `CHANGELOG.md`/`VERSION` didn't, nudges once (loop-guarded). |

These mechanize the rules above — they tighten, never loosen, normal permissions.
Each is a dependency-free Node script using shell-free `execFileSync`. To disable one, remove its entry from `.claude/settings.json`.

---

## Output Format (all subagents)
```
## [Agent Name] — Summary

**Status**: DONE | PARTIAL | BLOCKED
**Files changed**: [list or "none"]
**Findings / Actions**: [bulleted]
**Follow-up needed**: yes/no + description
**Recommended next agent**: [name or "none"]
```
