#!/usr/bin/env node
/**
 * SessionStart hook — stdout is added to the session's context. Prints a quick
 * orientation: version, branch, working-tree state, recent commits, and (best
 * effort) open PR count. Complements the `remember` plugin's history briefing.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let data = {};
try { data = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { /* fine */ }
const cwd = (data.cwd || process.cwd());

const git = (args) => { try { return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim(); } catch { return ''; } };
const read = (p) => { try { return fs.readFileSync(p, 'utf8').trim(); } catch { return ''; } };

const version = read(path.join(cwd, 'VERSION')) || 'unknown';
const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']) || 'unknown';
const dirty = git(['status', '--porcelain']);
const tree = dirty ? `${dirty.split('\n').length} uncommitted change(s)` : 'clean';
const recent = git(['log', '--oneline', '-3']);

let prs = '';
try {
  prs = execFileSync('gh', ['pr', 'list', '--state', 'open', '--json', 'number', '-q', 'length'],
    { cwd, encoding: 'utf8', timeout: 5000 }).trim();
} catch { prs = ''; }

const lines = [
  'Session briefing — TickerTracker:',
  `- v${version} | branch: ${branch} | tree: ${tree}` + (prs ? ` | open PRs: ${prs}` : ''),
];
if (recent) lines.push('- recent commits:', ...recent.split('\n').map(l => `    ${l}`));
process.stdout.write(lines.join('\n') + '\n');
process.exit(0);
