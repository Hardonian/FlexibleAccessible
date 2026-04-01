import { chromium } from "playwright";
import { normalizeViolations } from "@aros/scan-engine";

interface WatchOptions {
  url: string;
  interval: number;
  threshold: number;
}

export async function run(args: string[]) {
  const options = parseArgs(args);

  if (!options.url) {
    console.error("Usage: aros watch <url> [--interval 30] [--threshold 90]");
    process.exit(1);
  }

  console.log(`\n  AROS Watch Mode`);
  console.log(`  Target:    ${options.url}`);
  console.log(`  Interval:  ${options.interval}s`);
  console.log(`  Threshold: ${options.threshold}/100`);
  console.log(`  Press Ctrl+C to stop\n`);

  let lastScore = 100;

  async function runScan() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    try {
      const page = await context.newPage();
      await page.goto(options.url, {
        waitUntil: "networkidle",
        timeout: 30000,
      });
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

      const normalized = normalizeViolations(results.violations, "cli-watch");
      let critical = 0,
        serious = 0,
        moderate = 0,
        minor = 0;

      for (const v of normalized) {
        if (v.impact === "CRITICAL") critical++;
        else if (v.impact === "SERIOUS") serious++;
        else if (v.impact === "MODERATE") moderate++;
        else minor++;
      }

      const penalty = critical * 10 + serious * 5 + moderate * 2 + minor * 0.5;
      const score = Math.max(0, Math.round(100 - penalty * 2));

      const timestamp = new Date().toLocaleTimeString();
      const delta = score - lastScore;
      const deltaStr = delta > 0 ? `+${delta}` : String(delta);

      const icon = score >= options.threshold ? "✅" : "❌";
      console.log(
        `  ${icon} [${timestamp}] Score: ${score}/100 (${deltaStr}) — Issues: ${normalized.length} (C:${critical} S:${serious} M:${moderate} m:${minor})`,
      );

      lastScore = score;
    } catch (err) {
      console.error(
        `  ❌ [${new Date().toLocaleTimeString()}] Scan failed: ${err instanceof Error ? err.message : err}`,
      );
    } finally {
      await browser.close();
    }
  }

  await runScan();

  setInterval(() => {
    void runScan();
  }, options.interval * 1000);
}

function parseArgs(args: string[]): WatchOptions {
  const options: WatchOptions = { url: "", interval: 30, threshold: 90 };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      options.url = arg;
    } else if (arg === "--interval" && args[i + 1]) {
      options.interval = parseInt(args[++i], 10);
    } else if (arg === "--threshold" && args[i + 1]) {
      options.threshold = parseInt(args[++i], 10);
    }
  }

  return options;
}
