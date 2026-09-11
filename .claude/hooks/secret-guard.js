#!/usr/bin/env node
/**
 * PreToolUse hook (matcher: Write|Edit)
 * Blocks writing hardcoded secrets into SOURCE files.
 * CLAUDE.md rule: "All secrets via os.environ.get() — never hardcoded".
 *
 * Allows env files (.env*) — those are the legitimate, gitignored home for
 * real secrets — and example/placeholder values.
 */
const fs = require('fs');

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
let data;
try { data = JSON.parse(raw); } catch { process.exit(0); }

const ti = data.tool_input || {};
const file = (ti.file_path || '').replace(/\\/g, '/');
// Write provides .content; Edit provides .new_string
const content = ti.content != null ? ti.content
  : (ti.new_string != null ? ti.new_string : '');
if (!content) process.exit(0);

const base = file.split('/').pop() || '';
// Skip env files (real secrets belong here, gitignored) and our own hooks
if (base.startsWith('.env')) process.exit(0);
if (file.includes('/.claude/hooks/')) process.exit(0);

// 1) Known provider key shapes — high confidence
const tokenPatterns = [
  { re: /\bsk_live_[0-9a-zA-Z]{16,}/, name: 'Stripe live secret key' },
  { re: /\bsk_test_[0-9a-zA-Z]{16,}/, name: 'Stripe test secret key' },
  { re: /\brk_live_[0-9a-zA-Z]{16,}/, name: 'Stripe restricted key' },
  { re: /\bwhsec_[0-9a-zA-Z]{16,}/,   name: 'Stripe webhook secret' },
  { re: /\bre_[0-9a-zA-Z]{20,}/,      name: 'Resend API key' },
  { re: /\bAKIA[0-9A-Z]{16}\b/,       name: 'AWS access key id' },
  { re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/, name: 'private key block' },
];

// 2) Hardcoded assignment of a sensitive env var name to a string literal.
//    Env lookups (os.environ.get / process.env) never match because the value
//    after = is not a quoted literal, so they pass cleanly.
const assignRe = /\b(FINNHUB_API_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|RESEND_API_KEY|DATABASE_URL|JWT_SECRET|SECRET_KEY|GOOGLE_CLIENT_SECRET|GOOGLE_CLIENT_ID)\b\s*[:=]\s*["'`]([^"'`\n]{8,})["'`]/g;
const placeholder = /^(your[-_]?|xxx+|changeme|placeholder|example|sample|<|\$\{|test[-_]?key|dummy|fake|none|null|todo)/i;

const found = new Set();
for (const p of tokenPatterns) { if (p.re.test(content)) found.add(p.name); }

let m;
while ((m = assignRe.exec(content)) !== null) {
  const val = (m[2] || '').trim();
  if (placeholder.test(val)) continue;
  found.add(`hardcoded ${m[1]}`);
}

if (found.size) {
  const reason =
    `Blocked: possible hardcoded secret(s) in ${file || 'this file'} — ` +
    `${[...found].join(', ')}. Load secrets from the environment ` +
    `(os.environ.get() / process.env / import.meta.env), never inline. ` +
    `Put real values in a gitignored .env. (CLAUDE.md: all secrets via env vars.)`;
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
}
process.exit(0);
