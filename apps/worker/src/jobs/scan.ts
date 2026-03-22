import { Job, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@aros/db';
import { chromium, type Browser } from 'playwright';
import { createFingerprint } from '@aros/shared';

interface ScanJobData {
  scanRunId: string;
  siteId: string;
  pageId?: string;
  pageUrl?: string;
}

const connection = new IORedis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

const clusterQueue = new Queue('cluster', { connection });

export async function handleScanJob(job: Job<ScanJobData>) {
  const { scanRunId, siteId } = job.data;

  console.log(`[Scan] Starting scan ${scanRunId} for site ${siteId}`);

  await prisma.scanRun.update({
    where: { id: scanRunId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  const pages = await prisma.page.findMany({
    where: { siteId },
    select: { id: true, url: true },
  });

  await prisma.scanRun.update({
    where: { id: scanRunId },
    data: { totalPages: pages.length },
  });

  let browser: Browser | null = null;
  let pagesScanned = 0;
  let totalViolations = 0;

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

        // Process violations
        for (const violation of results.violations) {
          for (const node of violation.nodes) {
            const selector = node.target?.join(' > ') ?? '';
            const elementHtml = node.html ?? '';

            const fingerprint = createFingerprint({
              ruleId: violation.id,
              selector,
              siteId,
              elementSignature: extractElementSignature(elementHtml),
            });

            const severityMap: Record<string, 'CRITICAL' | 'SERIOUS' | 'MODERATE' | 'MINOR'> = {
              critical: 'CRITICAL',
              serious: 'SERIOUS',
              moderate: 'MODERATE',
              minor: 'MINOR',
            };

            const impact = severityMap[violation.impact ?? 'moderate'] ?? 'MODERATE';

            // Store raw violation
            await prisma.rawViolation.create({
              data: {
                scanRunId,
                pageId: pageRecord.id,
                ruleId: violation.id,
                impact,
                description: violation.description ?? violation.help ?? '',
                helpUrl: violation.helpUrl,
                wcagTags: violation.tags?.filter((t: string) => t.startsWith('wcag')) ?? [],
                selector,
                elementHtml: elementHtml.slice(0, 2000),
                elementContext: node.failureSummary ?? '',
                fingerprint,
              },
            });

            // Upsert canonical finding
            await prisma.canonicalFinding.upsert({
              where: { fingerprint },
              create: {
                siteId,
                ruleId: violation.id,
                impact,
                description: violation.help ?? violation.description ?? '',
                helpUrl: violation.helpUrl,
                wcagTags: violation.tags?.filter((t: string) => t.startsWith('wcag')) ?? [],
                fingerprint,
                status: 'OPEN',
                occurrenceCount: 1,
              },
              update: {
                lastSeenAt: new Date(),
                occurrenceCount: { increment: 1 },
              },
            });

            // Upsert occurrence
            const canonicalFinding = await prisma.canonicalFinding.findUnique({
              where: { fingerprint },
            });

            if (canonicalFinding) {
              await prisma.findingOccurrence.upsert({
                where: {
                  id: `${canonicalFinding.id}-${pageRecord.id}`,
                },
                create: {
                  canonicalFindingId: canonicalFinding.id,
                  pageId: pageRecord.id,
                  selector,
                  elementHtml: elementHtml.slice(0, 2000),
                },
                update: {
                  lastSeenAt: new Date(),
                  resolved: false,
                },
              }).catch(() => {
                // May fail on unique constraint for new occurrences; use create as fallback
                return prisma.findingOccurrence.create({
                  data: {
                    canonicalFindingId: canonicalFinding.id,
                    pageId: pageRecord.id,
                    selector,
                    elementHtml: elementHtml.slice(0, 2000),
                  },
                }).catch(() => {
                  // Already exists, skip
                });
              });
            }

            totalViolations++;
          }
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

function extractElementSignature(html: string): string {
  const tagMatch = html.match(/<(\w+)/);
  const roleMatch = html.match(/role="([^"]*)"/);
  const typeMatch = html.match(/type="([^"]*)"/);
  const tag = tagMatch?.[1]?.toLowerCase() ?? 'unknown';
  const role = roleMatch?.[1] ?? '';
  const type = typeMatch?.[1] ?? '';
  return `${tag}${role ? `[role=${role}]` : ''}${type ? `[type=${type}]` : ''}`;
}
