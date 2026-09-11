#!/usr/bin/env node
/**
 * PostToolUse hook (matcher: Write|Edit) — non-blocking, self-gating.
 * After editing a frontend source/test file that HAS a related test, runs
 * `vitest related --run <file>` and feeds failures back as context for fast
 * mid-task feedback. Skips files with no related test so it doesn't spin up
 * vitest pointlessly. (Stop-time `test-before-done` is the backstop.)
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let data = {};
try { data = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }

const file = ((data.tool_input || {}).file_path || '').replace(/\\/g, '/');
if (!file || !/\.(tsx?|jsx?)$/.test(file)) process.exit(0);
if (!file.includes('/frontend/src/')) process.exit(0);

const isTest = /\.(test|spec)\.[jt]sx?$/.test(file);
// If it's a source file, only proceed when a sibling test exists.
if (!isTest) {
  const stem = file.replace(/\.(tsx?|jsx?)$/, '');
  const hasSibling = ['.test.ts', '.test.tsx', '.spec.ts', '.spec.tsx', '.test.js', '.test.jsx']
    .some(ext => fs.existsSync(stem + ext));
  if (!hasSibling) process.exit(0);
}

const cwd = (data.cwd || process.cwd());
const vitest = path.join(cwd, 'frontend', 'node_modules', 'vitest', 'vitest.mjs');
if (!fs.existsSync(vitest)) process.exit(0);

const rel = file.replace(/^.*\/frontend\//, '');
const r = spawnSync(process.execPath, [vitest, 'related', '--run', rel],
  { cwd: path.join(cwd, 'frontend'), encoding: 'utf8', timeout: 120000 });

if (r.status && r.status !== 0) {
  const tail = ((r.stdout || '') + (r.stderr || '')).trim().split('\n').slice(-15).join('\n');
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: `Related vitest tests for ${rel} are failing:\n${tail}`,
    },
  }));
}
process.exit(0);
