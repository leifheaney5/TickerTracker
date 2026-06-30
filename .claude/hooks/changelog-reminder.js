#!/usr/bin/env node
/**
 * Stop hook — if app source changed this session but neither CHANGELOG.md nor
 * VERSION did, nudge once (loop-guarded) to update them. Matches the workflow
 * preference: keep CHANGELOG updated, roll semver as needed.
 */
const fs = require('fs');
const { execFileSync } = require('child_process');

let data = {};
try { data = JSON.parse(fs.readFileSync(0, 'utf8')); } catch { process.exit(0); }
if (data.stop_hook_active) process.exit(0);

const cwd = (data.cwd || process.cwd());
const git = (args) => { try { return execFileSync('git', args, { cwd, encoding: 'utf8' }); } catch { return ''; } };

const changed = (git(['diff', '--name-only', 'HEAD']) + '\n' +
                 git(['ls-files', '--others', '--exclude-standard'])).split('\n')
  .map(s => s.trim().replace(/\\/g, '/')).filter(Boolean);

const sourceChanged = changed.some(f =>
  /^backend\/.*\.py$/.test(f) || /^frontend\/src\/.*\.(tsx?|jsx?)$/.test(f));
const docsBumped = changed.some(f => f === 'CHANGELOG.md' || f === 'VERSION');

if (sourceChanged && !docsBumped) {
  console.log(JSON.stringify({
    decision: 'block',
    reason: 'Source changed but CHANGELOG.md / VERSION were not updated. ' +
            'Add a CHANGELOG entry (and roll semver in VERSION if warranted) ' +
            'before finishing. If this change is genuinely not user-facing, ' +
            'note that and stop again to proceed.',
  }));
}
process.exit(0);
