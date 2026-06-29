#!/usr/bin/env node
/**
 * SubagentStop hook — appends a line to .claude/logs/subagents.log each time a
 * subagent finishes, giving an audit trail of the parallel fleet. Never blocks.
 * The log dir is gitignored (runtime state under .claude/).
 */
const fs = require('fs');
const path = require('path');

let data = {};
try { data = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { /* still log a heartbeat */ }

const cwd = (data.cwd || process.cwd());
const logDir = path.join(cwd, '.claude', 'logs');
const logFile = path.join(logDir, 'subagents.log');

const ts = new Date().toISOString();
const fields = [
  ts,
  data.session_id ? `session=${data.session_id}` : '',
  data.agent_type || data.subagent_type ? `agent=${data.agent_type || data.subagent_type}` : '',
  data.agent_name ? `name=${data.agent_name}` : '',
].filter(Boolean).join(' | ');

try {
  fs.mkdirSync(logDir, { recursive: true });
  fs.appendFileSync(logFile, fields + '\n');
} catch {
  // logging is best-effort; never interfere with the run
}
process.exit(0);
