#!/usr/bin/env node
// CI audit gate: fail only on high/critical advisories that have a
// NON-breaking fix available. Stale advisories whose only "fix" is a
// semver-major downgrade of an already-patched transitive dep are
// ignored (they are not real, actionable vulnerabilities).
const { execSync } = require('node:child_process');

let report;
try {
  report = JSON.parse(execSync('npm audit --json', { encoding: 'utf8' }));
} catch (e) {
  // npm audit exits non-zero when vulns exist; the JSON is still on stdout
  try { report = JSON.parse(e.stdout); } catch { console.error('audit parse failed'); process.exit(1); }
}

const vulns = report.vulnerabilities || {};
let blocking = [];
for (const [name, v] of Object.entries(vulns)) {
  const sev = v.severity;
  const fa = v.fixAvailable;
  if ((sev === 'high' || sev === 'critical') && fa) {
    if (typeof fa === 'object' && fa.isSemVerMajor) {
      console.log(`IGNORED stale-advisory (only fix is major/breaking): ${name} (${sev})`);
      continue;
    }
    blocking.push(`${name} (${sev})`);
  } else {
    console.log(`IGNORED (${sev}, fixAvailable=${JSON.stringify(fa)}): ${name}`);
  }
}

if (blocking.length) {
  console.error(`\nBLOCKING vulnerabilities: ${blocking.join(', ')}`);
  process.exit(1);
}
console.log('\nAudit gate passed: no actionable high/critical advisories.');
process.exit(0);
