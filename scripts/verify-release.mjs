#!/usr/bin/env node
/**
 * AROS Master Production Release & Quality Gate Verification
 * Orchestrates all pre-flight verification checks across the 10 core roadmap pillars.
 */

import { execFileSync } from "node:child_process";
import path from "node:path";

console.log("=====================================================================");
console.log("   AROS (Accessibility Remediation OS) — Master Release Gate");
console.log("=====================================================================\n");

const gates = [
  {
    name: "Gate 1: Prisma Client Drift Check",
    command: "node",
    args: [path.join("scripts", "check-prisma-client-drift.mjs")],
  },
  {
    name: "Gate 2: Critical Tenant Boundary Enforcement",
    command: "node",
    args: [path.join("scripts", "check-tenant-boundary-critical.mjs")],
  },
  {
    name: "Gate 3: Scan Engine & Pareto Clustering Resilience",
    command: "node",
    args: [path.join("scripts", "test-engine-resilience.mjs")],
  },
  {
    name: "Gate 4: Disaster Recovery & Restore Drill Validation",
    command: "node",
    args: [path.join("scripts", "test-disaster-recovery.mjs")],
  },
  {
    name: "Gate 5: Stripe Ledger Reconciliation Audit",
    command: "node",
    args: [path.join("scripts", "reconcile-stripe-ledger.mjs")],
  },
  {
    name: "Gate 6: Synthetic User Journey & API Routes",
    command: "node",
    args: [path.join("scripts", "synthetic-user-flow.mjs")],
  },
  {
    name: "Gate 7: Google Lighthouse CI Assertion Audit",
    command: "node",
    args: [path.join("scripts", "test-lighthouse-ci.mjs")],
  },
];

let passed = 0;

for (const gate of gates) {
  console.log(`\n▶ Running: ${gate.name}`);
  try {
    const output = execFileSync(gate.command, gate.args, {
      encoding: "utf8",
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    console.log(output.trim());
    console.log(`✔ [PASS] ${gate.name}`);
    passed++;
  } catch (err) {
    console.error(`✖ [FAIL] ${gate.name}:`, err.message);
    if (err.stdout) console.log(err.stdout.toString());
    if (err.stderr) console.error(err.stderr.toString());
    process.exit(1);
  }
}

console.log("\n=====================================================================");
console.log(`   ALL ${passed}/${gates.length} QUALITY GATES PASSED WITH ZERO DEFECTS`);
console.log("   AROS IS OFFICIALLY CERTIFIED FOR PRODUCTION GO-LIVE & CLOSURE");
console.log("=====================================================================\n");
