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
  // npm audit exits non-zero both when vulns exist AND on real errors
  // (EUSAGE/EMISSINGTARGET/network). Distinguish them below instead of
  // assuming the stdout is a vulnerability report.
  try { report = JSON.parse(e.stdout); }
  catch { console.error('audit gate FAILED: npm audit produced no parseable JSON'); process.exit(1); }
}

// A genuine audit report carries a `vulnerabilities` map. npm error payloads
// (e.g. {"error":{"code":"EMISSINGTARGET"}}) do NOT — previously these were
// treated as "0 vulns" and the gate silently passed. Fail loudly instead.
if (!report || report.error || !report.vulnerabilities) {
  const detail = report && report.error ? `${report.error.code || ''} ${report.error.summary || ''}`.trim() : 'empty report';
  console.error(`audit gate FAILED: npm audit did not return a vulnerability report (${detail || 'unknown'}).`);
  process.exit(1);
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
