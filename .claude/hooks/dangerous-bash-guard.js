#!/usr/bin/env node
/**
 * PreToolUse hook (matcher: Bash)
 * Blocks clearly-destructive shell commands. Conservative by design.
 *
 * Avoids false positives on quoted text (commit messages, echoes, PR bodies):
 *  - command-style dangers (rm -rf, flask db downgrade, railway down) must
 *    appear at the START of a command segment, not inside a quoted argument.
 *  - SQL DROP/TRUNCATE only counts when paired with a DB client invocation or a
 *    `-c` exec flag in the same segment — so `git commit -m "...DROP TABLE..."`
 *    is not flagged, but `psql ... -c "DROP TABLE"` is.
 */
const fs = require('fs');

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
let data;
try { data = JSON.parse(raw); } catch { process.exit(0); }

const cmd = ((data.tool_input || {}).command || '').trim();
if (!cmd) process.exit(0);

const broadTarget = /(\s|=)(\/(\s|$)|~|\*|\.(\s|$)|\.\/\*|\$HOME|\/\w+\/?\s*$)/;
const sqlDrop = /\b(drop\s+(table|database|schema)|truncate\s+table)\b/i;
const sqlClient = /^(psql|mysql|mariadb|sqlite3)\b|\b(psql|mysql|mariadb|sqlite3)\b|\s-c\b/i;

const segments = cmd.split(/&&|\|\||[;\n|]/).map(s => s.trim()).filter(Boolean);

const hits = new Set();
for (const s of segments) {
  // command-position dangers (allow leading `sudo ` / `env VAR=x ` / `python -m `)
  const head = s.replace(/^(sudo\s+|env\s+\S+=\S+\s+|python\s+-m\s+)+/i, '');

  if (/^rm\s+-\w*[rf]\w*(\s|$)/i.test(head) && broadTarget.test(head)) {
    hits.add('recursive force-delete of a broad path');
  }
  if (/^flask\s+db\s+downgrade\b/i.test(head)) {
    hits.add('flask db downgrade (destructive migration rollback)');
  }
  if (/^railway\s+(down\b|.*\b(delete|remove)\b)/i.test(head)) {
    hits.add('railway teardown/delete');
  }
  // SQL drop/truncate, only in a real execution context
  if (sqlDrop.test(s) && sqlClient.test(s)) {
    hits.add('SQL DROP/TRUNCATE');
  }
}

if (hits.size) {
  const reason =
    `Blocked (destructive): ${[...hits].join('; ')}. If this is genuinely ` +
    `intended, run it from a terminal outside Claude. (dangerous-bash-guard)`;
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
}
process.exit(0);
