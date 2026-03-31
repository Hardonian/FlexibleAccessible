import { chromium } from "playwright";

interface ScanOptions {
  url: string;
  format: "json" | "csv";
  output?: string;
  ci: boolean;
  threshold: string;
  apiKey?: string;
  apiUrl: string;
}

export async function run(args: string[]) {
  const options = parseArgs(args);

  if (!options.url) {
    console.error("Usage: aros scan <url>");
    process.exit(1);
  }

  console.log(`[AROS] Scanning ${options.url}...`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();

  try {
    await page.goto(options.url, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1000);

    // Inject axe-core
    const axeSource = require("axe-core").source;
    await page.evaluate(axeSource);

    const results = await page.evaluate(async () => {
      // @ts-expect-error axe is injected
      return await window.axe.run(document, {
        reporter: "v2",
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
      });
    });

    const violations = results.violations.map((v: any) => ({
      ruleId: v.id,
      impact: v.impact,
      description: v.description,
      helpUrl: v.helpUrl,
      wcagTags: v.tags.filter((t: string) => t.startsWith("wcag")),
      nodes: v.nodes.map((n: any) => ({
        selector: n.target?.join(" > ") ?? "",
        html: n.html?.slice(0, 500) ?? "",
        failureSummary: n.failureSummary ?? "",
      })),
    }));

    // Filter by threshold
    const thresholdOrder: Record<string, number> = {
      critical: 0,
      serious: 1,
      moderate: 2,
      minor: 3,
    };
    const maxThreshold = thresholdOrder[options.threshold] ?? 3;
    const filtered = violations.filter(
      (v: any) => (thresholdOrder[v.impact] ?? 3) <= maxThreshold,
    );

    if (options.format === "csv") {
      const headers = [
        "Rule ID",
        "Impact",
        "Description",
        "WCAG Tags",
        "Selector",
        "Element",
      ];
      const rows = filtered.flatMap((v: any) =>
        v.nodes.map((n: any) =>
          [
            v.ruleId,
            v.impact,
            `"${v.description.replace(/"/g, '""')}"`,
            v.wcagTags.join(";"),
            n.selector,
            `"${n.html.replace(/"/g, '""')}"`,
          ].join(","),
        ),
      );
      const csv = [headers.join(","), ...rows].join("\n");

      if (options.output) {
        const fs = await import("fs");
        fs.writeFileSync(options.output, csv);
        console.log(`[AROS] Results written to ${options.output}`);
      } else {
        console.log(csv);
      }
    } else {
      const output = {
        url: options.url,
        scannedAt: new Date().toISOString(),
        totalViolations: filtered.length,
        violations: filtered,
      };

      if (options.output) {
        const fs = await import("fs");
        fs.writeFileSync(options.output, JSON.stringify(output, null, 2));
        console.log(`[AROS] Results written to ${options.output}`);
      } else {
        console.log(JSON.stringify(output, null, 2));
      }
    }

    console.log(`\n[AROS] Scan complete: ${filtered.length} violations found`);

    if (options.ci && filtered.length > 0) {
      console.error(
        `[AROS] CI mode: ${filtered.length} accessibility violations detected`,
      );
      process.exit(1);
    }
  } finally {
    await browser.close();
  }
}

function parseArgs(args: string[]): ScanOptions {
  const options: ScanOptions = {
    url: "",
    format: "json",
    ci: false,
    threshold: "minor",
    apiKey: process.env.AROS_API_KEY,
    apiUrl: process.env.AROS_API_URL ?? "https://api.aros.dev",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      options.url = arg;
    } else if (arg === "--format" && args[i + 1]) {
      options.format = args[++i] as "json" | "csv";
    } else if (arg === "--output" && args[i + 1]) {
      options.output = args[++i];
    } else if (arg === "--ci") {
      options.ci = true;
    } else if (arg === "--threshold" && args[i + 1]) {
      options.threshold = args[++i];
    } else if (arg === "--api-key" && args[i + 1]) {
      options.apiKey = args[++i];
    } else if (arg === "--api-url" && args[i + 1]) {
      options.apiUrl = args[++i];
    }
  }

  return options;
}
