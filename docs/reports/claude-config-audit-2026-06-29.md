# Claude Code Configuration Audit & Consolidation — 2026-06-29

## 1. Summary of changes made

The project had **two `.claude` directories**:

| Location | Contents | Status |
|---|---|---|
| `./.claude/` (main checkout) | 3 agents + `settings.local.json` | subset / canonical target |
| `./.claude/worktrees/agent-network-expand/.claude/` | 8 agents + `settings.local.json` + a root `CLAUDE.md` | superset, on an unmerged worktree branch with **uncommitted staged work** |

Key facts that shaped the merge:

- `.claude/` was **fully gitignored** — neither directory was tracked, so consolidation was a filesystem operation, not a git-history merge.
- The 3 shared agents and both `settings.local.json` files were **byte-identical** (verified with `diff`) — no true conflicts.
- The worktree was **not** a throwaway: branch `worktree-agent-network-expand` carries 80+ commits / ~9,200 lines diverged from `main`, plus staged-but-uncommitted files (the agents, `CLAUDE.md`, a design spec, and a modified `.gitignore`). It was therefore **preserved untouched**; nothing was deleted from it.

Actions taken:

1. Copied the 5 missing agents into the canonical `.claude/agents/` (verified identical to source).
2. Removed deprecated permissions from `.claude/settings.local.json` that pointed at the **older project copy** (`S:\Bandcamp Downloasd\ticker-tracker-subagents-v2\`).
3. Per your decision (*Track & share*): updated `.gitignore` to track `.claude/agents/` while keeping `settings.local.json` and `worktrees/` local; added the orchestration doc as a **root `CLAUDE.md`** (auto-loaded as project memory).
4. Created the agents' documented output dirs `docs/marketing/` and `docs/outreach/` (with `.gitkeep`) so draft-writing agents don't fail on first write.
5. Validated all 8 agents (frontmatter complete, `name` matches filename) and verified every path the config references exists.

## 2. Files merged, removed, or renamed

**Added to canonical `.claude/agents/`** (copied from worktree):
`site-maintainer.md`, `security-auditor.md`, `e2e-engineer.md`, `hf-engineer.md`, `performance-engineer.md`

**Modified:**
- `.claude/settings.local.json` — dropped 2 stale `Read(//s/Bandcamp Downloasd/ticker-tracker-subagents-v2/...)` permissions; kept `git branch`, `npm run`, `npx vitest`.
- `.gitignore` — `.claude/` → `.claude/*` + `!.claude/agents/` + explicit `.claude/settings.local.json` ignore.

**Created:**
- `CLAUDE.md` (repo root) — the subagent-network orchestration doc.
- `docs/marketing/.gitkeep`, `docs/outreach/.gitkeep`.
- `docs/reports/claude-config-audit-2026-06-29.md` (this file).

**Removed:** nothing. (Deprecated content was overwritten in place; the worktree was left intact because it holds uncommitted work.)

## 3. Manual follow-up actions required

1. **Commit the consolidation** on `main` (no command run for you — review first):
   `git add .gitignore CLAUDE.md .claude/agents docs/marketing/.gitkeep docs/outreach/.gitkeep docs/reports/claude-config-audit-2026-06-29.md`
2. **Retire the redundant worktree** once its branch work is done: its `.claude` is now duplicated in the canonical location. After committing/merging anything you still want from `worktree-agent-network-expand`, run `git worktree remove .claude/worktrees/agent-network-expand`. (Two other worktrees — `billing-verify`, `signal-intelligence` — also exist and have no `.claude` of their own.)
3. **Decide on `database-optimizer`**: the roster references it as an external VoltAgent agent (`voltagent-data-ai`) that is **not installed**. Either install it (`claude plugin marketplace add VoltAgent/awesome-claude-code-subagents` → `claude plugin install voltagent-data-ai`) or remove its rows from `CLAUDE.md`.
4. *(Optional, global)* Remove the orphaned `~/.claude/hooks/approval-ping-{start,stop}.ps1` — not referenced by `settings.json`.

## 4. Current subagent inventory

All 8 are `model: sonnet`, well-formed, and live in `.claude/agents/`.

| Agent | Purpose | Trigger phrases | Tools | Write scope | Dependencies | Prod-ready |
|---|---|---|---|---|---|---|
| `site-maintainer` | Full-stack bug fixes, features, migrations, cron, caching | fix, refactor, implement, add, update | Read, Write, Edit, Bash, Glob, Grep | code | consumes findings from security/perf/hf/db | ✅ |
| `security-auditor` | OWASP/auth/API-key/CVE audits | audit, security, CVE, OWASP, vuln, key leak | Read, Grep, Glob, Bash | read-only | feeds site-maintainer | ✅ |
| `e2e-engineer` | Playwright authoring/execution/triage | test, e2e, playwright, flaky, coverage | Read, Write, Edit, Bash, Glob, Grep | tests | runs after site-maintainer ships | ✅ |
| `hf-engineer` | UX/accessibility specs (WCAG 2.1 AA) | UX, feature idea, usability, user flow | Read, Grep, Glob | read-only | feeds site-maintainer & marketing | ✅ |
| `performance-engineer` | Query/caching/bundle/WebSocket perf | slow, latency, perf, bottleneck, bundle | Read, Grep, Glob, Bash | read-only | feeds site-maintainer | ✅ |
| `marketing-strategist` | Positioning, messaging, SEO content strategy | marketing, positioning, copy, tagline, campaign | Read, Grep, Glob, Write, WebSearch, WebFetch | drafts → `docs/marketing/` | hands keywords→web-seo, positioning→outreach | ✅ |
| `web-seo-engineer` | On-page SEO (meta/OG/JSON-LD/sitemap), CWV, brand assets | SEO, meta tags, schema, sitemap, open graph, favicon | Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch | code (auto-commit low-risk) | implements marketing-strategist strategy | ✅ |
| `outreach-coordinator` | Distribution: PH/Reddit/HN/X drafts, target lists | outreach, launch, Product Hunt, distribution, PR | Read, Grep, Glob, Write, WebSearch, WebFetch | drafts → `docs/outreach/` | takes positioning from marketing-strategist | ✅ |

`database-optimizer` is **referenced but not installed** (external VoltAgent) — not counted above.

## 5. Readiness score: 88 / 100

**Strong:** all agents valid and discoverable; clear read-only vs write boundaries; draft-only guardrails on marketing/outreach; sensible plugin set enabled; hook target present; every referenced path verified to exist.

**Deductions:** `database-optimizer` referenced but absent (−4); config was untracked/duplicated until now and the redundant worktree copy still lingers (−4); no automated tests/evals for the agents and no project-level `settings.json` defaults (−2); all-events global hook + orphaned ping scripts add minor noise (−2).

## 6. Prioritized recommendations

1. **Commit the consolidated config** so the network is a single shared source of truth (follow-up #1). — *done pending your commit*
2. **Resolve `database-optimizer`** — install or remove from the roster to eliminate the one dangling reference.
3. **Remove the redundant worktree** after its branch is finished, eliminating the second `.claude` for good.
4. **Add a tracked `.claude/settings.json`** (team defaults) distinct from per-user `settings.local.json`, e.g. baseline allow-list for `pytest`, `npm run test`, `git status`.
5. **Trim the global hook fan-out** — the pixel-agents hook fires on all 11 events; keep only the events you actually consume, and delete the orphaned `approval-ping*.ps1`.
6. **Add lightweight agent evals** (skill-creator supports this) before relying on routing heavily.
