#!/usr/bin/env node
/**
 * PreToolUse hook (matcher: Bash)
 * Forces a confidence declaration before every commit. A `git commit` is denied
 * unless its message carries a `Confidence: <0-100>/100` trailer. The deny
 * reason tells Claude to first state its confidence (0-100, with a one-line
 * justification) to the user, then add the trailer and re-run — so the user is
 * told, and the score is also recorded in git history.
 *
 * Skips non-creating commits (--help, --dry-run) and amends that reuse the
 * existing message (--amend --no-edit / -C), where no trailer can be added.
 * Segment/command-position aware so quoted text mentioning "git commit" in some
 * other command doesn't trigger it.
 */
const fs = require('fs');

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
let data;
try { data = JSON.parse(raw); } catch { process.exit(0); }

const cmd = ((data.tool_input || {}).command || '').trim();
if (!cmd) process.exit(0);

// Find an actual `git commit` invocation at command position.
const segments = cmd.split(/&&|\|\||[;\n|]/).map(s => s.trim()).filter(Boolean);
const commitSeg = segments.find(s =>
  /^(sudo\s+|env\s+\S+=\S+\s+)*git\s+(-c\s+\S+\s+)*commit\b/.test(s));
if (!commitSeg) process.exit(0);

// Skip commands that don't create/edit a commit message.
if (/(^|\s)(--help|--dry-run)(\s|$)|(^|\s)-h(\s|$)/.test(commitSeg)) process.exit(0);
const amendReuse = /--amend\b/.test(commitSeg) &&
  /(--no-edit|--reuse-message(=|\s)|\s-C(\s|$))/.test(commitSeg);
if (amendReuse) process.exit(0);

// Accept if a valid confidence trailer is present anywhere in the command.
const m = cmd.match(/\bconfidence\s*[:=]?\s*(\d{1,3})\s*\/\s*100\b/i);
if (m && Number(m[1]) >= 0 && Number(m[1]) <= 100) process.exit(0);

const reason =
  'Before committing: tell the user your confidence in this change on a 0-100 ' +
  'scale with a one-line justification, then add a trailer line ' +
  '`Confidence: <0-100>/100` to the commit message and re-run the commit. ' +
  '(commit-confidence hook)';
console.log(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: reason,
  },
}));
process.exit(0);
