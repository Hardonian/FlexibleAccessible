import type { PrismaClient } from '@aros/db';

export type SiteVerificationRow = {
  status: 'idle' | 'pending' | 'running' | 'failed_enqueue';
  scanRunId: string | null;
  createdAt: Date | null;
  errorHint: string | null;
};

/**
 * Operator-facing scan lifecycle from persisted ScanRun + audit (no BullMQ reads).
 */
export async function getSiteVerificationStatus(
  prisma: PrismaClient,
  params: { siteId: string; organizationId: string }
): Promise<SiteVerificationRow> {
  const { siteId, organizationId } = params;

  const active = await prisma.scanRun.findFirst({
    where: {
      siteId,
      status: { in: ['PENDING', 'RUNNING'] },
      site: { workspace: { organizationId } },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, status: true, createdAt: true },
  });

  if (active) {
    return {
      status: active.status === 'PENDING' ? 'pending' : 'running',
      scanRunId: active.id,
      createdAt: active.createdAt,
      errorHint: null,
    };
  }

  const failedEnqueue = await prisma.scanRun.findFirst({
    where: {
      siteId,
      status: 'FAILED',
      errorMessage: { startsWith: 'Queue unavailable:' },
      site: { workspace: { organizationId } },
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, createdAt: true, errorMessage: true },
  });

  if (failedEnqueue) {
    return {
      status: 'failed_enqueue',
      scanRunId: failedEnqueue.id,
      createdAt: failedEnqueue.createdAt,
      errorHint: failedEnqueue.errorMessage,
    };
  }

  return { status: 'idle', scanRunId: null, createdAt: null, errorHint: null };
}

export type PostCrawlEnqueueFailureHint = {
  show: boolean;
  message: string | null;
};

/**
 * Surface a truthful follow-up when post-crawl auto-scan enqueue failed and nothing has recovered yet.
 */
export async function getPostCrawlScanEnqueueFailureHint(
  prisma: PrismaClient,
  params: { siteId: string; organizationId: string }
): Promise<PostCrawlEnqueueFailureHint> {
  const { siteId, organizationId } = params;

  const latestCrawl = await prisma.crawlRun.findFirst({
    where: {
      siteId,
      status: 'COMPLETED',
      pagesCrawled: { gt: 0 },
      site: { workspace: { organizationId } },
    },
    orderBy: { completedAt: 'desc' },
    select: { id: true, completedAt: true },
  });

  if (!latestCrawl?.completedAt) {
    return { show: false, message: null };
  }

  const failedForCrawl = await prisma.scanRun.findFirst({
    where: {
      siteId,
      crawlRunId: latestCrawl.id,
      status: 'FAILED',
      errorMessage: { startsWith: 'Queue unavailable:' },
    },
    select: { id: true },
  });

  if (!failedForCrawl) {
    return { show: false, message: null };
  }

  const recovered = await prisma.scanRun.findFirst({
    where: {
      siteId,
      site: { workspace: { organizationId } },
      OR: [
        {
          status: 'COMPLETED',
          completedAt: { gte: latestCrawl.completedAt },
        },
        {
          status: { in: ['PENDING', 'RUNNING'] },
          createdAt: { gte: latestCrawl.completedAt },
        },
      ],
    },
    select: { id: true },
  });

  if (recovered) {
    return { show: false, message: null };
  }

  return {
    show: true,
    message:
      'Automatic verification could not be queued after the latest crawl (verification queue unavailable). Start a verification scan once Redis and workers are healthy.',
  };
}
