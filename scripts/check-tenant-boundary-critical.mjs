#!/usr/bin/env node
import { execSync } from "node:child_process";

const CRITICAL_ENTRYPOINTS = [
  "src/app/api/comments/route.ts",
  "src/app/api/credits/route.ts",
  "src/app/api/impact/route.ts",
  "src/app/api/reports/route.ts",
  "src/app/api/reports/vpat/route.ts",
  "src/app/api/github-action/route.ts",
  "src/app/api/deploy-webhook/route.ts",
  "src/app/api/public-scan/route.ts",
  "src/app/api/public-scan/[id]/route.ts",
  "src/app/api/badge/route.ts",
];

const joined = CRITICAL_ENTRYPOINTS.join(" ");

let stdout = "[]";
try {
  stdout = execSync(`npx eslint --format json ${joined}`, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    cwd: "apps/web",
  });
} catch (error) {
  stdout = error.stdout?.toString() ?? "[]";
}

let report;
try {
  report = JSON.parse(stdout);
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
