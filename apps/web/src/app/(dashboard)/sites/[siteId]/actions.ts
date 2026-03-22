'use server';

import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/session';
import { prisma } from '@/lib/db';
import { crawlQueue, type CrawlJobData } from '@/lib/queue';

export async function startCrawlAction(formData: FormData) {
  const user = await requireSession();
  const siteId = formData.get('siteId') as string;

  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: {
      crawlConfig: true,
      workspace: {
        include: {
          organization: {
            include: {
              memberships: { where: { userId: user.id }, take: 1 },
              subscription: true,
            },
          },
        },
      },
    },
  });

  if (!site || site.workspace.organization.memberships.length === 0) {
    throw new Error('Site not found');
  }

  // Check for running crawl
  const runningCrawl = await prisma.crawlRun.findFirst({
    where: { siteId, status: { in: ['PENDING', 'RUNNING'] } },
  });
  if (runningCrawl) {
    redirect(`/sites/${siteId}`);
  }

  const config = site.crawlConfig;
  const crawlRun = await prisma.crawlRun.create({
    data: { siteId, status: 'PENDING' },
  });

  await prisma.auditLog.create({
    data: {
      organizationId: site.workspace.organizationId,
      userId: user.id,
      action: 'crawl.started',
      entityType: 'CrawlRun',
      entityId: crawlRun.id,
    },
  });

  try {
    const jobData: CrawlJobData = {
      crawlRunId: crawlRun.id,
      siteId,
      config: {
        sitemapUrl: config?.sitemapUrl ?? undefined,
        maxDepth: config?.maxDepth ?? 5,
        maxPages: config?.maxPages ?? 100,
        includePatterns: config?.includePatterns ?? [],
        excludePatterns: config?.excludePatterns ?? [],
        respectRobots: config?.respectRobots ?? true,
        renderJavaScript: config?.renderJavaScript ?? true,
        viewports: (config?.viewports as Array<{ width: number; height: number }>) ?? [
          { width: 1280, height: 720 },
        ],
      },
    };
    await crawlQueue.add('crawl', jobData, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    });
  } catch {
    // Will be picked up by worker polling
  }

  redirect(`/sites/${siteId}`);
}
