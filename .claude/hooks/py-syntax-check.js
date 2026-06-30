#!/usr/bin/env node
/**
 * PostToolUse hook (matcher: Write|Edit) — non-blocking feedback.
 * Compiles an edited .py file with `py_compile`; on a syntax error, feeds the
 * message straight back to Claude as context so it fixes it immediately instead
 * of discovering it at runtime. Pure stdlib — no ruff/black needed.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let raw = '';
try { raw = fs.readFileSync(0, 'utf8'); } catch { process.exit(0); }
let data;
try { data = JSON.parse(raw); } catch { process.exit(0); }

const file = ((data.tool_input || {}).file_path || '').replace(/\\/g, '/');
if (!file || !/\.py$/.test(file)) process.exit(0);

const cwd = (data.cwd || process.cwd()).replace(/\\/g, '/');
const isWin = process.platform === 'win32';
const venv = isWin
  ? path.join(cwd, 'backend', '.venv', 'Scripts', 'python.exe')
  : path.join(cwd, 'backend', '.venv', 'bin', 'python');
const python = fs.existsSync(venv) ? venv : 'python';

try {
  execFileSync(python, ['-m', 'py_compile', file], { stdio: 'pipe', timeout: 20000 });
} catch (e) {
  const msg = ((e.stderr && e.stderr.toString()) || e.message || '').trim();
  if (!msg) process.exit(0);
  console.log(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext:
        `py_compile found a syntax error in ${file}:\n${msg}\nFix it before continuing.`,
    },
  }));
}
process.exit(0);
