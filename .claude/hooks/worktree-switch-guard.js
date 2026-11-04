#!/usr/bin/env node
/**
 * PreToolUse hook (matcher: Bash)
 *
 * Blocks branch-switching the PRIMARY checkout. This repo has heavy concurrent
 * branch/worktree churn in one shared checkout; a `git checkout <branch>` in the
 * primary tree yanks HEAD out from under any other session working there and
 * discards their uncommitted work. Branch work must happen in a linked worktree.
 *
 * Blocks (only when run in the primary checkout):
 *   git switch <anything>        git switch -c X        git switch -
 *   git checkout <local-branch>  git checkout -b X      git checkout -
 * Allows everywhere:
 *   file restores  — git checkout -- file / git checkout <ref> -- path / git checkout .
 *   anything inside a LINKED worktree (that's the whole point — isolation)
 *   any non-checkout/switch command
 *
 * Detection of "primary vs linked worktree" uses git's own truth:
 *   --git-dir == --git-common-dir  → primary checkout
 *   --git-dir != --git-common-dir  → linked worktree (allowed)
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
let data;
try { data = JSON.parse(raw); } catch { process.exit(0); }

const cmd = ((data.tool_input || {}).command || '').trim();
const baseCwd = data.cwd || process.cwd();
if (!cmd) process.exit(0);

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

function git(dir, args) {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();
}

// Is `dir` the primary checkout (not a linked worktree)?
function isPrimaryCheckout(dir) {
  try {
    const gitDir = path.resolve(dir, git(dir, ['rev-parse', '--git-dir']));
    const commonDir = path.resolve(dir, git(dir, ['rev-parse', '--git-common-dir']));
    return gitDir === commonDir;
  } catch {
    return false; // not a repo / can't tell → don't block
  }
}

function isLocalBranch(dir, ref) {
  try {
    git(dir, ['rev-parse', '--verify', '--quiet', `refs/heads/${ref}`]);
    return true;
  } catch {
    return false;
  }
}

// Inspect each shell segment; only ones starting with a git checkout/switch count.
const segments = cmd.split(/&&|\|\||[;\n|]/);
for (const seg of segments) {
  const s = seg.trim();
  if (!/^git\b/.test(s)) continue;

  const tokens = s.split(/\s+/);
  // Resolve `git -C <dir>` so the guard follows the command's real target tree.
  let dir = baseCwd;
  let i = 1;
  while (tokens[i] === '-C' && tokens[i + 1]) { dir = path.resolve(baseCwd, tokens[i + 1]); i += 2; }

  const verb = tokens[i];
  if (verb !== 'checkout' && verb !== 'switch') continue;

  const rest = tokens.slice(i + 1);
  const hasPathSep = rest.includes('--');
  const flags = rest.filter(t => t.startsWith('-'));
  const positionals = rest.filter(t => !t.startsWith('-'));

  let isBranchSwitch = false;
  if (verb === 'switch') {
    // git switch is always branch-oriented.
    isBranchSwitch = rest.length > 0 && !flags.includes('--help');
  } else { // checkout
    if (hasPathSep) {
      isBranchSwitch = false;                       // file restore
    } else if (flags.some(f => f === '-b' || f === '-B' || f === '--orphan')) {
      isBranchSwitch = true;                        // create+switch branch
    } else if (rest.includes('-')) {
      isBranchSwitch = true;                        // `checkout -` = previous branch
    } else if (positionals.length === 1) {
      isBranchSwitch = isLocalBranch(dir, positionals[0]); // branch vs file/path/commit
    }
    // 0 positionals, or 2+ (ref + pathspec) → treat as file-oriented → allow
  }

  if (isBranchSwitch && isPrimaryCheckout(dir)) {
    deny(
      'Blocked: switching branches in the PRIMARY checkout. This repo runs ' +
      'concurrent sessions in one shared checkout — switching HEAD here can ' +
      'discard another session\'s uncommitted work (it has happened). ' +
      'Use an isolated worktree instead:\n' +
      '  git worktree add ../TickerTracker-<topic> -b <new-branch> <base>\n' +
      'then work there. (Linked worktrees and file-level `git checkout -- <path>` ' +
      'are not affected.)'
    );
  }
}
process.exit(0);
