import { chromium } from "playwright";
import { normalizeViolations } from "@aros/scan-engine";

interface CiOptions {
  url: string;
  threshold: number;
  failOn?: string;
  pages: number;
}

export async function run(args: string[]) {
  const options = parseArgs(args);

  if (!options.url) {
    console.error(
      "Usage: aros ci <url> [--threshold 95] [--fail-on critical] [--pages 3]",
    );
    process.exit(1);
  }

  console.log(`\n  AROS CI Scan`);
  console.log(`  Target:    ${options.url}`);
  console.log(`  Threshold: ${options.threshold}/100`);
  console.log(`  Fail on:   ${options.failOn ?? "score below threshold"}\n`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });

  const urls = [options.url];
  let totalViolations = 0;
  let criticalCount = 0;
  let seriousCount = 0;
  let moderateCount = 0;
  let minorCount = 0;

  for (const pageUrl of urls.slice(0, options.pages)) {
    try {
      const page = await context.newPage();
      await page.goto(pageUrl, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(500);

      const axeSource = require("axe-core").source;
      await page.evaluate(axeSource);

      const results = await page.evaluate(async () => {
        // @ts-expect-error axe injected
        return await window.axe.run(document, {
          reporter: "v2",
          runOnly: {
            type: "tag",
            values: [
              "wcag2a",
              "wcag2aa",
              "wcag21a",
              "wcag21aa",
              "best-practice",
            ],
          },
        });
      });

      const normalized = normalizeViolations(results.violations, "cli-ci");

      for (const v of normalized) {
        totalViolations++;
        if (v.impact === "CRITICAL") criticalCount++;
        else if (v.impact === "SERIOUS") seriousCount++;
        else if (v.impact === "MODERATE") moderateCount++;
        else minorCount++;
      }

      await page.close();
    } catch (err) {
      console.error(
        `  Error scanning ${pageUrl}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  await browser.close();

  const penalty =
    criticalCount * 10 +
    seriousCount * 5 +
    moderateCount * 2 +
    minorCount * 0.5;
  const score = Math.max(
    0,
    Math.round(100 - (penalty / Math.max(urls.length, 1)) * 2),
  );

  console.log(`  Score: ${score}/100`);
  console.log(
    `  Issues: ${totalViolations} (C:${criticalCount} S:${seriousCount} M:${moderateCount} m:${minorCount})`,
  );

  let passed = true;

  if (score < options.threshold) {
    console.error(
      `\n  FAIL: Score ${score} is below threshold ${options.threshold}`,
    );
    passed = false;
  }

  if (options.failOn === "critical" && criticalCount > 0) {
    console.error(`\n  FAIL: ${criticalCount} critical issue(s) found`);
    passed = false;
  } else if (
    options.failOn === "serious" &&
    (criticalCount > 0 || seriousCount > 0)
  ) {
    console.error(`\n  FAIL: Critical or serious issue(s) found`);
    passed = false;
  } else if (
    options.failOn === "moderate" &&
    (criticalCount > 0 || seriousCount > 0 || moderateCount > 0)
  ) {
    console.error(`\n  FAIL: Critical, serious, or moderate issue(s) found`);
    passed = false;
  }

  if (passed) {
    console.log(`\n  PASS\n`);
  } else {
    console.log("");
  }

  process.exit(passed ? 0 : 1);
}

function parseArgs(args: string[]): CiOptions {
  const options: CiOptions = {
    url: "",
    threshold: 95,
    pages: 3,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      options.url = arg;
    } else if (arg === "--threshold" && args[i + 1]) {
      options.threshold = parseInt(args[++i], 10);
    } else if (arg === "--fail-on" && args[i + 1]) {
      options.failOn = args[++i];
    } else if (arg === "--pages" && args[i + 1]) {
      options.pages = parseInt(args[++i], 10);
    }
  }

  return options;
}
