import { Job, Queue } from 'bullmq';
import { prisma } from '@aros/db';
import { chromium, type Browser } from 'playwright';
import {
  bullmqConnectionOptions,
} from '@aros/shared';
import { normalizeViolations } from '@aros/scan-engine';
import {
  finalizeAutomatedScanVerification,
  recordAutomatedFindingObservation,
} from '@aros/core-services';

interface ScanJobData {
  scanRunId: string;
  siteId: string;
  pageId?: string;
  pageUrl?: string;
}

const clusterQueue = new Queue('cluster', { connection: bullmqConnectionOptions() });

export async function handleScanJob(job: Job<ScanJobData>) {
  const { scanRunId, siteId } = job.data;

  console.log(`[Scan] Starting scan ${scanRunId} for site ${siteId}`);

  await prisma.scanRun.update({
    where: { id: scanRunId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  const pages = await prisma.page.findMany({
    where: { siteId },
    select: { id: true, url: true, title: true },
  });

  await prisma.scanRun.update({
    where: { id: scanRunId },
    data: { totalPages: pages.length },
  });

  let browser: Browser | null = null;
  let pagesScanned = 0;
  let totalViolations = 0;
  const observedFingerprints = new Set<string>();

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    for (const pageRecord of pages) {
      try {
        const context = await browser.newContext({
          viewport: { width: 1280, height: 720 },
        });
        const page = await context.newPage();

        await page.goto(pageRecord.url, {
          waitUntil: 'networkidle',
          timeout: 30000,
        });

        // Wait for dynamic content
        await page.waitForTimeout(1000);

        // Inject and run axe-core
        const axeSource = require('axe-core').source;
        await page.evaluate(axeSource);

        const results = await page.evaluate(async () => {
          // @ts-expect-error axe is injected
          return await window.axe.run(document, {
            reporter: 'v2',
            runOnly: {
              type: 'tag',
              values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'],
            },
          });
        });

        const normalizedViolations = normalizeViolations(results.violations, siteId);

        for (const violation of normalizedViolations) {
          const now = new Date();
          observedFingerprints.add(violation.fingerprint);

          const raw = await prisma.rawViolation.create({
            data: {
              scanRunId,
              pageId: pageRecord.id,
              ruleId: violation.ruleId,
              impact: violation.impact,
              description: violation.description,
              helpUrl: violation.helpUrl,
              wcagTags: violation.wcagTags,
              selector: violation.selector,
              elementHtml: violation.elementHtml,
              elementContext: violation.elementContext,
              fingerprint: violation.fingerprint,
            },
          });

          await recordAutomatedFindingObservation(prisma, {
            siteId,
            scanRunId,
            pageId: pageRecord.id,
            pageUrl: pageRecord.url,
            rawViolationId: raw.id,
            observedAt: now,
            pageTitle: pageRecord.title,
            violation,
          });

          totalViolations++;
        }

        pagesScanned++;
        await context.close();

        await prisma.scanRun.update({
          where: { id: scanRunId },
          data: { pagesScanned, violationsFound: totalViolations },
        });

        await job.updateProgress(Math.round((pagesScanned / pages.length) * 100));
      } catch (err) {
        console.error(`[Scan] Error scanning ${pageRecord.url}:`, err);
      }
    }

    await prisma.scanRun.update({
      where: { id: scanRunId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        pagesScanned,
        violationsFound: totalViolations,
      },
    });

    await finalizeAutomatedScanVerification(prisma, {
      siteId,
      scanRunId,
      observedFingerprints: Array.from(observedFingerprints),
      completedAt: new Date(),
    });

    // Trigger clustering after scan completes
    await clusterQueue.add('cluster', { siteId, scanRunId }, {
      delay: 5000,
    });

    console.log(`[Scan] Completed scan ${scanRunId}: ${totalViolations} violations found across ${pagesScanned} pages`);
  } catch (err) {
    console.error(`[Scan] Scan ${scanRunId} failed:`, err);
    await prisma.scanRun.update({
      where: { id: scanRunId },
      data: {
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
        completedAt: new Date(),
      },
    });
    throw err;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
