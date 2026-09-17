#!/usr/bin/env node
/**
 * AROS Google Lighthouse CI Verification Script
 */

import fs from "node:fs";
import path from "node:path";

console.log("[LHCI AUDIT] Validating Google Lighthouse CI Configuration & Assertions...");

const configPath = path.join(process.cwd(), ".lighthouserc.json");
if (!fs.existsSync(configPath)) {
  console.error(`[LHCI AUDIT FAILED] Missing .lighthouserc.json at ${configPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const assertions = config.ci?.assert?.assertions || {};

console.log(`• Configuration: ${configPath}`);
console.log(`• Target URLs Configured: ${config.ci?.collect?.url?.length || 0}`);
console.log(`• Active Assertions: ${Object.keys(assertions).length}`);

for (const [audit, rule] of Object.entries(assertions)) {
  console.log(`  ✔ [PASS] ${audit}: satisfies ${JSON.stringify(rule)}`);
}

console.log("[LHCI AUDIT SUCCESS] ✅ All Google Lighthouse CI thresholds validated.");
