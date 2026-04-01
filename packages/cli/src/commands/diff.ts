import { chromium } from "playwright";
import { normalizeViolations } from "@aros/scan-engine";

interface DiffOptions {
  url: string;
  baseline: string;
}

export async function run(args: string[]) {
  const options = parseArgs(args);

  if (!options.url) {
    console.error("Usage: aros diff <url> --baseline <file.json>");
    process.exit(1);
  }

  const fs = await import("fs");
  const path = await import("path");

  const baselinePath = path.resolve(options.baseline);
  if (!fs.existsSync(baselinePath)) {
    console.error(`Baseline file not found: ${baselinePath}`);
    process.exit(1);
  }

  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf-8")) as {
    findings: Array<{ ruleId: string; count?: number }>;
  };

  console.log(`\n  AROS Diff Scan`);
  console.log(`  Target:    ${options.url}`);
  console.log(`  Baseline:  ${baselinePath}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();
  await page.goto(options.url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(500);

  const axeSource = require("axe-core").source;
  await page.evaluate(axeSource);

  const results = await page.evaluate(async () => {
    // @ts-expect-error axe injected
    return await window.axe.run(document, {
      reporter: "v2",
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"],
      },
    });
  });

  await browser.close();

  const normalized = normalizeViolations(results.violations, "cli-diff");
  const currentMap = new Map<string, number>();
  for (const v of normalized) {
    currentMap.set(v.ruleId, (currentMap.get(v.ruleId) ?? 0) + 1);
  }

  const baselineMap = new Map<string, number>();
  for (const f of baseline.findings) {
    baselineMap.set(f.ruleId, f.count ?? 1);
  }

  const allRuleIds = new Set([...currentMap.keys(), ...baselineMap.keys()]);
  const changes: Array<{
    ruleId: string;
    before: number;
    after: number;
    delta: number;
  }> = [];

  for (const ruleId of allRuleIds) {
    const before = baselineMap.get(ruleId) ?? 0;
    const after = currentMap.get(ruleId) ?? 0;
    if (before !== after) {
      changes.push({ ruleId, before, after, delta: after - before });
    }
  }

  changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  console.log("  Changes:");
  console.log("  " + "─".repeat(60));

  if (changes.length === 0) {
    console.log("  No changes detected.");
  } else {
    for (const c of changes) {
      const icon = c.delta > 0 ? "❌ +" : "✅ ";
      console.log(
        `  ${icon}${c.delta}  ${c.ruleId}  (${c.before} → ${c.after})`,
      );
    }
  }

  const newIssues = [...currentMap.keys()].filter((r) => !baselineMap.has(r));
  const resolvedIssues = [...baselineMap.keys()].filter(
    (r) => !currentMap.has(r),
  );

  if (newIssues.length > 0) {
    console.log(`\n  New issues: ${newIssues.join(", ")}`);
  }
  if (resolvedIssues.length > 0) {
    console.log(`  Resolved:   ${resolvedIssues.join(", ")}`);
  }

  console.log("");
  process.exit(newIssues.length > 0 ? 1 : 0);
}

function parseArgs(args: string[]): DiffOptions {
  const options: DiffOptions = { url: "", baseline: "" };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      options.url = arg;
    } else if (arg === "--baseline" && args[i + 1]) {
      options.baseline = args[++i];
    }
  }

  return options;
}
