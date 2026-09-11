#!/usr/bin/env node
/**
 * Stop hook — runs the relevant unit suites when an agent finishes, and BLOCKS
 * the stop (forcing it to keep working) if they fail. Enforces CLAUDE.md:
 * "Run pytest + npm run test before any commit."
 *
 * Cost controls:
 *  - stop_hook_active guard: never re-block a stop we already triggered (no loops)
 *  - scoped: only runs the side (backend/frontend) whose files actually changed
 *  - frontend uses `vitest related --run` (only tests touching changed files)
 *  - if a runner isn't found, it no-ops rather than blocking on tooling
 *
 * To disable, remove the Stop entry from .claude/settings.json.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

let data = {};
try { data = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }

// Loop guard — if this stop was already triggered by a Stop hook, let it through.
if (data.stop_hook_active) process.exit(0);

const cwd = (data.cwd || process.cwd());
const isWin = process.platform === 'win32';

const git = (args) => {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8' }); } catch { return ''; }
};

// Changed files = tracked diff vs HEAD + untracked, normalized to forward slashes.
const changed = new Set();
for (const line of (git(['diff', '--name-only', 'HEAD']) + '\n' +
                    git(['ls-files', '--others', '--exclude-standard'])).split('\n')) {
  const f = line.trim().replace(/\\/g, '/');
  if (f) changed.add(f);
}
const arr = [...changed];
const backendFiles = arr.filter(f => /^backend\/.*\.py$/.test(f));
const frontendFiles = arr.filter(f => /^frontend\/src\/.*\.(tsx?|jsx?)$/.test(f));
if (!backendFiles.length && !frontendFiles.length) process.exit(0);

const failures = [];

// ---- backend: venv pytest -q ----
if (backendFiles.length) {
  const py = isWin
    ? path.join(cwd, 'backend', '.venv', 'Scripts', 'python.exe')
    : path.join(cwd, 'backend', '.venv', 'bin', 'python');
  if (fs.existsSync(py)) {
    const r = spawnSync(py, ['-m', 'pytest', '-q'],
      { cwd: path.join(cwd, 'backend'), encoding: 'utf8', timeout: 300000 });
    if (r.status !== 0) {
      const tail = ((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(-12).join('\n');
      failures.push(`backend pytest failed:\n${tail}`);
    }
  }
}

// ---- frontend: vitest related --run <changed files> ----
if (frontendFiles.length) {
  const vitest = path.join(cwd, 'frontend', 'node_modules', 'vitest', 'vitest.mjs');
  if (fs.existsSync(vitest)) {
    const rel = frontendFiles.map(f => f.replace(/^frontend\//, ''));
    const r = spawnSync(process.execPath, [vitest, 'related', '--run', ...rel],
      { cwd: path.join(cwd, 'frontend'), encoding: 'utf8', timeout: 300000 });
    if (r.status !== 0) {
      const tail = ((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(-12).join('\n');
      failures.push(`frontend vitest failed:\n${tail}`);
    }
  }
}

if (failures.length) {
  console.log(JSON.stringify({
    decision: 'block',
    reason: `Tests are failing — fix before finishing (CLAUDE.md: tests pass before commit).\n\n${failures.join('\n\n')}`,
  }));
}
process.exit(0);
