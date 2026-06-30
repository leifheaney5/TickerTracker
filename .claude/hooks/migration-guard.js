#!/usr/bin/env node
/**
 * PreToolUse hook (matcher: Edit)
 * Blocks EDITING an already-committed Flask-Migrate migration in
 * backend/migrations/versions/. Migrations are an append-only ledger; rewriting
 * one that's been applied/committed corrupts schema history on a finance DB.
 *
 * New migrations are created via Write (a fresh file), not Edit, so this only
 * fires on attempts to modify existing revisions. Uncommitted (brand-new)
 * migration files are allowed — you can still fix one before it lands.
 */
const fs = require('fs');
const { execFileSync } = require('child_process');

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
let data;
try { data = JSON.parse(raw); } catch { process.exit(0); }

const file = ((data.tool_input || {}).file_path || '').replace(/\\/g, '/');
if (!file) process.exit(0);
if (!/\/migrations\/versions\/.+\.py$/.test(file)) process.exit(0);

const cwd = data.cwd || process.cwd();

// Allow if the file is NOT tracked in git yet (brand-new, not committed).
let tracked = false;
try {
  execFileSync('git', ['ls-files', '--error-unmatch', file], { cwd, stdio: 'ignore' });
  tracked = true;
} catch {
  tracked = false;
}
if (!tracked) process.exit(0);

const reason =
  `Blocked: editing a committed migration (${file.split('/').pop()}). ` +
  `Flask-Migrate revisions are append-only history — rewriting an applied one ` +
  `desyncs the DB. Generate a NEW migration (flask db migrate) for further ` +
  `schema changes instead.`;
console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: reason,
  },
}));
process.exit(0);
