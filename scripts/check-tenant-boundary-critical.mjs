#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const CRITICAL_ENTRYPOINTS = [
  "src/app/(dashboard)/settings/billing/actions.ts",
  "src/app/api/comments/route.ts",
  "src/app/api/credits/route.ts",
  "src/app/api/impact/route.ts",
  "src/app/api/reports/route.ts",
  "src/app/api/reports/vpat/route.ts",
  "src/app/api/ai-copilot/route.ts",
  "src/app/api/findings/summary/route.ts",
  "src/app/api/webhooks/stripe/route.ts",
  "src/app/api/github-action/route.ts",
  "src/app/api/github-action/status/[scanRunId]/route.ts",
  "src/app/api/deploy-webhook/route.ts",
  "src/app/api/public-scan/route.ts",
  "src/app/api/public-scan/[id]/route.ts",
  "src/app/api/badge/route.ts",
];

let stdout = "[]";
try {
  stdout = execFileSync(
    "npx",
    ["eslint", "--format", "json", ...CRITICAL_ENTRYPOINTS],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      cwd: "apps/web",
    },
  );
} catch (error) {
  stdout = error.stdout?.toString() ?? "[]";
}

const jsonStart = stdout.indexOf("[");
const normalizedJson = jsonStart >= 0 ? stdout.slice(jsonStart) : stdout;

let report;
try {
  report = JSON.parse(normalizedJson);
} catch {
  console.error("[verify:tenant-boundary] Failed to parse eslint JSON output.");
  process.exit(1);
}

const violations = report.flatMap((file) =>
  file.messages
    .filter((message) => message.ruleId === "no-restricted-syntax")
    .map((message) => ({
      filePath: file.filePath,
      line: message.line,
      column: message.column,
      message: message.message,
    })),
);

if (violations.length > 0) {
  console.error("[verify:tenant-boundary] Critical tenant-boundary violations detected:");
  for (const violation of violations) {
    console.error(`- ${violation.filePath}:${violation.line}:${violation.column} ${violation.message}`);
  }
  process.exit(1);
}

console.log(`[verify:tenant-boundary] Passed for ${CRITICAL_ENTRYPOINTS.length} critical server entrypoints.`);
