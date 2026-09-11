#!/usr/bin/env node
/**
 * UserPromptSubmit hook — stdout is appended to the model's context.
 * Injects lightweight, always-current project state so agents don't re-derive
 * it: version, branch, working-tree cleanliness, worktree flag, billing flag.
 * Kept to a few lines on purpose — it runs on every prompt.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let data = {};
try { data = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { /* no stdin is fine */ }
const cwd = (data.cwd || process.cwd());

const git = (args) => {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim(); }
  catch { return ''; }
};
const readFirst = (p) => {
  try { return fs.readFileSync(p, 'utf8').trim(); } catch { return ''; }
};

const version = readFirst(path.join(cwd, 'VERSION')) || 'unknown';
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']) || 'unknown';
const dirty = git(['status', '--porcelain']);
const tree = dirty ? `${dirty.split('\n').length} uncommitted change(s)` : 'clean';
const inWorktree = /[\\/]\.claude[\\/]worktrees[\\/]/.test(cwd.replace(/\\/g, '/'));

// BILLING_ENABLED from a local .env if present (best-effort, not authoritative)
let billing = 'unknown (env-controlled)';
const env = readFirst(path.join(cwd, '.env'));
const m = env.match(/^BILLING_ENABLED\s*=\s*(\S+)/m);
if (m) billing = m[1];

const lines = [
  'Project state (auto-injected):',
  `- TickerTracker v${version} | branch: ${branch}${inWorktree ? ' (in a worktree)' : ''}`,
  `- working tree: ${tree}`,
  `- BILLING_ENABLED: ${billing}`,
];
process.stdout.write(lines.join('\n') + '\n');
process.exit(0);
