#!/usr/bin/env node
/**
 * PreToolUse hook (matcher: Write|Edit)
 * Enforces CLAUDE.md: "Never call any provider from the frontend. All market
 * data flows backend -> database/cache -> frontend."
 *
 * Blocks adding a market-data PROVIDER HOST to a frontend source file. Matches
 * hostnames (not brand words) so comments like "// data from Finnhub" pass.
 * Skips test/mock files, which legitimately reference provider hosts when
 * mocking at the network boundary.
 */
const fs = require('fs');

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
let data;
try { data = JSON.parse(raw); } catch { process.exit(0); }

const ti = data.tool_input || {};
const file = (ti.file_path || '').replace(/\\/g, '/');
const content = ti.content != null ? ti.content
  : (ti.new_string != null ? ti.new_string : '');
if (!file || !content) process.exit(0);

// Frontend source only
if (!file.includes('/frontend/')) process.exit(0);
if (!/\.(tsx?|jsx?)$/.test(file)) process.exit(0);
// Tests/mocks may reference provider hosts to intercept them — allow.
if (/\.(test|spec)\.[jt]sx?$/.test(file)) process.exit(0);
if (/\/(e2e|__mocks__|__tests__|test|tests)\//.test(file)) process.exit(0);

const hosts = [
  { re: /\bfinnhub\.io/i,             name: 'Finnhub' },
  { re: /\bfinance\.yahoo\.com/i,     name: 'Yahoo Finance' },
  { re: /\bquery\d+\.finance\.yahoo/i, name: 'Yahoo Finance' },
  { re: /\b(pro-)?api\.coingecko\.com/i, name: 'CoinGecko' },
];

const found = new Set();
for (const h of hosts) { if (h.re.test(content)) found.add(h.name); }

if (found.size) {
  const reason =
    `Blocked: ${[...found].join(', ')} provider call in a frontend file ` +
    `(${file}). CLAUDE.md: never call market-data providers from the frontend — ` +
    `add a backend endpoint under /api and fetch that instead ` +
    `(data flows backend -> cache -> frontend).`;
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  }));
}
process.exit(0);
