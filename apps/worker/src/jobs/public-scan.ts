import { PUBLIC_SCAN_EVIDENCE_TTL_MS } from "@aros/config";
import { Job } from "bullmq";
import { prisma } from "@aros/db";
import { chromium, type Browser } from "playwright";
import { normalizeViolations } from "@aros/scan-engine";

interface PublicScanJobData {
  publicScanResultId: string;
  domain: string;
  url: string;
  maxPages: number;
}

/**
 * Handles anonymous public scans from the landing page.
 * Crawls up to maxPages (default 5), runs axe-core, stores aggregate results.
 * No authentication or tenant scoping required.
 */
export async function handlePublicScanJob(job: Job<PublicScanJobData>) {
  const { publicScanResultId, url, maxPages } = job.data;

  console.log(
    `[PublicScan] Starting public scan ${publicScanResultId} for ${url}`,
  );

  await prisma.publicScanResult.update({
    where: { id: publicScanResultId },
    data: { status: "RUNNING" },
  });

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    // Discover URLs: start from base URL, try sitemap, then limit
    const urlsToScan = await discoverUrls(context, url, maxPages);

    let pagesScanned = 0;
    let totalViolations = 0;
    let criticalCount = 0;
    let seriousCount = 0;
    let moderateCount = 0;
    let minorCount = 0;
    const allViolations: Record<string, unknown>[] = [];

    for (const pageUrl of urlsToScan) {
      try {
        const page = await context.newPage();
        await page.goto(pageUrl, {
          waitUntil: "networkidle",
          timeout: 20000,
        });
        await page.waitForTimeout(500);

        const axeSource = require("axe-core").source;
        await page.evaluate(axeSource);

        const results = await page.evaluate(async () => {
          // @ts-expect-error axe is injected
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

        const normalized = normalizeViolations(
          results.violations,
          "public-scan",
        );

        for (const v of normalized) {
          totalViolations++;
          if (v.impact === "CRITICAL") criticalCount++;
          else if (v.impact === "SERIOUS") seriousCount++;
          else if (v.impact === "MODERATE") moderateCount++;
          else minorCount++;

          const existing = allViolations.find(
            (av) => av.ruleId === v.ruleId && av.selector === v.selector,
          );
          if (existing) {
            existing.count = ((existing.count as number) ?? 1) + 1;
          } else {
            allViolations.push({
              ruleId: v.ruleId,
              impact: v.impact,
              description: v.description,
              helpUrl: v.helpUrl,
              selector: v.selector,
              elementHtml: v.elementHtml.slice(0, 200),
              count: 1,
            });
          }
        }

        pagesScanned++;
        await page.close();
      } catch (err) {
        console.error(`[PublicScan] Error scanning ${pageUrl}:`, err);
      }
    }

    // Compute score: start at 100, deduct weighted violations
    const penalty =
      criticalCount * 10 +
      seriousCount * 5 +
      moderateCount * 2 +
      minorCount * 0.5;
    const maxPenalty = Math.max(penalty, 1);
    const score = Math.max(
      0,
      Math.round(100 - (penalty / Math.max(pagesScanned, 1)) * 2),
    );

    // Sort violations by severity then count
    const severityOrder: Record<string, number> = {
      CRITICAL: 0,
      SERIOUS: 1,
      MODERATE: 2,
      MINOR: 3,
    };
    allViolations.sort(
      (a, b) =>
        (severityOrder[a.impact as string] ?? 4) -
          (severityOrder[b.impact as string] ?? 4) ||
        ((b.count as number) ?? 0) - ((a.count as number) ?? 0),
    );

    const completedAt = new Date();
    await prisma.publicScanResult.update({
      where: { id: publicScanResultId },
      data: {
        status: "COMPLETED",
        score,
        totalViolations,
        criticalCount,
        seriousCount,
        moderateCount,
        minorCount,
        pagesScanned,
        violations: allViolations.slice(0, 50) as any,
        completedAt,
        expiresAt: new Date(completedAt.getTime() + PUBLIC_SCAN_EVIDENCE_TTL_MS),
      },
    });

    console.log(
      `[PublicScan] Completed ${publicScanResultId}: score=${score}, ${totalViolations} violations across ${pagesScanned} pages`,
    );
  } catch (err) {
    console.error(`[PublicScan] Failed ${publicScanResultId}:`, err);
    const failedAt = new Date();
    await prisma.publicScanResult.update({
      where: { id: publicScanResultId },
      data: {
        status: "FAILED",
        completedAt: failedAt,
        expiresAt: new Date(failedAt.getTime() + PUBLIC_SCAN_EVIDENCE_TTL_MS),
      },
    });
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Discover URLs to scan: try sitemap.xml first, fall back to base URL only.
 */
async function discoverUrls(
  context: import("playwright").BrowserContext,
  baseUrl: string,
  maxPages: number,
): Promise<string[]> {
  const urls: string[] = [baseUrl];

  try {
    const sitemapUrl = new URL("/sitemap.xml", baseUrl).href;
    const page = await context.newPage();
    const response = await page.goto(sitemapUrl, { timeout: 10000 });

    if (response?.ok()) {
      const content = await page.content();
      const locMatches = content.matchAll(/<loc>([^<]+)<\/loc>/g);
      for (const match of locMatches) {
        if (urls.length >= maxPages) break;
        const loc = match[1].trim();
        if (loc.startsWith(baseUrl) && !urls.includes(loc)) {
          urls.push(loc);
        }
      }
    }
    await page.close();
  } catch {
    // No sitemap - just scan the base URL
  }

  return urls.slice(0, maxPages);
}
