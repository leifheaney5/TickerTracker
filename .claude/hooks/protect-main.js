#!/usr/bin/env node
/**
 * PreToolUse hook (matcher: Bash)
 * Blocks direct pushes to main. CLAUDE.md rule: "Never push to main directly;
 * use feature branches."
 *
 * Only inspects actual `git push` command SEGMENTS — splits the command on
 * shell separators and checks segments that *start* with `git push`. This
 * avoids false positives when `git push`/`main` merely appear inside quoted
 * text (e.g. a `gh pr create --body "...git push to main..."`).
 *
 * Catches: `git push origin main`, `... HEAD:main`, `:main`, `--force ... main`,
 * and a bare `git push` while checked out on main. Lets `feat/main-x` through
 * (main must be a standalone ref token).
 */
const fs = require('fs');
const { execSync } = require('child_process');

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
let data;
try { data = JSON.parse(raw); } catch { process.exit(0); }

const cmd = ((data.tool_input || {}).command || '').trim();
const cwd = data.cwd || process.cwd();

function deny(reason) {
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

// `main` as a standalone ref token (not feat/main-x, origin/main path, etc.)
const mainRef = /(?<![\w/-])main(?![\w/-])/;

// Split on shell separators; only segments that START with `git push` count.
const segments = cmd.split(/&&|\|\||[;\n|]/);
for (const seg of segments) {
  const s = seg.trim();
  if (!/^git\s+push\b/.test(s)) continue;

  if (mainRef.test(s)) {
    deny('Blocked: direct push to main. CLAUDE.md: never push to main directly — ' +
         'open a feature branch and PR. (If you genuinely must, push from a terminal outside Claude.)');
  }

  // Bare `git push` / `git push origin` with no refspec → pushes current branch
  if (/^git\s+push\s*(origin\s*)?$/.test(s)) {
    let branch = '';
    try { branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf8' }).trim(); } catch {}
    if (branch === 'main') {
      deny('Blocked: bare "git push" while on main pushes directly to main. ' +
           'CLAUDE.md: use a feature branch + PR.');
    }
  }
}
process.exit(0);
