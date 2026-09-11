#!/usr/bin/env node
/**
 * PostToolUse hook (matcher: Write|Edit) — best-effort, never blocks.
 * Runs the project's own linter (oxlint, per frontend/package.json) with --fix
 * on edited frontend JS/TS files. No-op for everything else.
 *
 * Note: backend has no configured Python formatter (no ruff/black), so .py
 * files are intentionally left untouched. Uses execFileSync with an argument
 * array (no shell) so the file path cannot inject shell commands.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
let data;
try { data = JSON.parse(raw); } catch { process.exit(0); }

const file = ((data.tool_input || {}).file_path || '').replace(/\\/g, '/');
if (!file) process.exit(0);
if (!/\.(tsx?|jsx?)$/.test(file)) process.exit(0);   // frontend JS/TS only
if (!file.includes('/frontend/')) process.exit(0);

const feDir = file.slice(0, file.indexOf('/frontend/')) + '/frontend';
// oxlint's bin is a plain JS launcher — run it via node (no shell, so the
// file path can't inject commands; also avoids Windows .cmd execFile EINVAL).
const oxlintBin = path.join(feDir, 'node_modules', 'oxlint', 'bin', 'oxlint');
if (!fs.existsSync(oxlintBin)) process.exit(0);   // linter not installed → no-op

try {
  execFileSync(process.execPath, [oxlintBin, '--fix', file], {
    cwd: feDir,
    stdio: 'ignore',
    timeout: 60000,
  });
} catch {
  // Lint warnings / non-zero exit / timeout — stay silent, never block a turn.
}
process.exit(0);
