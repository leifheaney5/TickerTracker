#!/usr/bin/env node
/**
 * Stop hook — runs `tsc --noEmit` once when finishing IF frontend/src TS files
 * changed this session, and blocks the stop while type errors remain. Enforces
 * the strict-TypeScript / no-`any` convention. Loop-guarded; no-ops when no
 * frontend TS changed or when typescript isn't installed.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

let data = {};
try { data = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }
if (data.stop_hook_active) process.exit(0);

const cwd = (data.cwd || process.cwd());
const git = (args) => { try { return execFileSync('git', args, { cwd, encoding: 'utf8' }); } catch { return ''; } };

const changed = (git(['diff', '--name-only', 'HEAD']) + '\n' +
                 git(['ls-files', '--others', '--exclude-standard'])).split('\n')
  .map(s => s.trim().replace(/\\/g, '/'));
const frontendTs = changed.some(f => /^frontend\/src\/.*\.(tsx?)$/.test(f));
if (!frontendTs) process.exit(0);

const tsc = path.join(cwd, 'frontend', 'node_modules', 'typescript', 'bin', 'tsc');
if (!fs.existsSync(tsc)) process.exit(0);

const r = spawnSync(process.execPath, [tsc, '--noEmit'],
  { cwd: path.join(cwd, 'frontend'), encoding: 'utf8', timeout: 180000 });

if (r.status && r.status !== 0) {
  const out = ((r.stdout || '') + (r.stderr || '')).trim();
  const errLines = out.split('\n').filter(l => /error TS\d+/.test(l)).slice(0, 15);
  const body = errLines.length ? errLines.join('\n') : out.split('\n').slice(-15).join('\n');
  console.log(JSON.stringify({
    decision: 'block',
    reason: `TypeScript type errors — fix before finishing (strict TS, no \`any\`):\n\n${body}`,
  }));
}
process.exit(0);
