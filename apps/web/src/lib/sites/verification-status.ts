import type {
  PostCrawlScanKickoffStatus,
  PrismaClient,
  ScanEnqueueFailureCode,
} from '@aros/db';

export type SiteVerificationRow = {
  status: 'idle' | 'pending' | 'running' | 'failed_enqueue';
  scanRunId: string | null;
  createdAt: Date | null;
  /** Canonical enqueue failure code when status is failed_enqueue */
  enqueueFailureCode: ScanEnqueueFailureCode | null;
  /** Operator-facing detail (underlying error text when available) */
  errorDetail: string | null;
};

const KICKOFF_FAILURE_STATUSES: PostCrawlScanKickoffStatus[] = [
  'QUEUE_UNAVAILABLE',
  'QUEUE_REJECTED',
  'DISPATCH_UNAVAILABLE',
  'KICKOFF_FAILED_UNKNOWN',
];

function stripQueueUnavailablePrefix(message: string): string {
  return message.replace(/^Queue unavailable:\s*/i, '').trim();
}

export function scanEnqueueFailureOperatorHint(code: ScanEnqueueFailureCode | null): string {
  switch (code) {
    case 'QUEUE_UNAVAILABLE':
      return 'The verification queue could not be reached (often Redis or network).';
    case 'QUEUE_REJECTED':
      return 'The queue rejected the job (for example policy or resource limits).';
    case 'DISPATCH_UNAVAILABLE':
      return 'Dispatch to workers failed; check worker and queue configuration.';
    case 'KICKOFF_FAILED_UNKNOWN':
    default:
      return 'Verification could not be queued for an unexpected reason.';
  }
}

export function postCrawlKickoffOperatorSummary(
  status: PostCrawlScanKickoffStatus,
  reasonCode: ScanEnqueueFailureCode | null,
  detail: string | null
): string | null {
  switch (status) {
    case 'NOT_REQUESTED':
    case 'REQUESTED':
      return null;
    case 'ENQUEUED':
      return 'After this crawl, a verification scan was queued successfully.';
    case 'SKIPPED_BY_SETTING':
      return (
        detail ??
        'Automatic verification after crawl is disabled in crawl settings; start a scan manually when ready.'
      );
    case 'QUEUE_UNAVAILABLE':
    case 'QUEUE_REJECTED':
    case 'DISPATCH_UNAVAILABLE':
    case 'KICKOFF_FAILED_UNKNOWN': {
      const base = scanEnqueueFailureOperatorHint(reasonCode);
      const tail = detail?.trim() ? ` (${detail.trim()})` : '';
      return `Crawl finished, but automatic verification could not be queued. ${base}${tail}`;
    }
    default:
      return null;
  }
}

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
      enqueueFailureCode: null,
      errorDetail: null,
    };
  }

  const failedEnqueue = await prisma.scanRun.findFirst({
    where: {
      siteId,
      status: 'FAILED',
      site: { workspace: { organizationId } },
      OR: [
        { enqueueFailureCode: { not: null } },
        { errorMessage: { startsWith: 'Queue unavailable:' } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      createdAt: true,
      errorMessage: true,
      enqueueFailureCode: true,
    },
  });

  if (failedEnqueue) {
    const code = failedEnqueue.enqueueFailureCode ?? 'QUEUE_UNAVAILABLE';
    const errorDetail = failedEnqueue.errorMessage
      ? stripQueueUnavailablePrefix(failedEnqueue.errorMessage)
      : null;
    return {
      status: 'failed_enqueue',
      scanRunId: failedEnqueue.id,
      createdAt: failedEnqueue.createdAt,
      enqueueFailureCode: code,
      errorDetail,
    };
  }

  return {
    status: 'idle',
    scanRunId: null,
    createdAt: null,
    enqueueFailureCode: null,
    errorDetail: null,
  };
}

export type PostCrawlEnqueueFailureHint = {
  show: boolean;
  message: string | null;
  kickoffStatus: PostCrawlScanKickoffStatus | null;
};

/**
 * Surface a truthful follow-up when post-crawl auto-scan kickoff failed and nothing has recovered yet.
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
    select: {
      id: true,
      completedAt: true,
      postCrawlScanKickoffStatus: true,
      postCrawlScanKickoffReasonCode: true,
      postCrawlScanKickoffDetail: true,
    },
  });

  if (!latestCrawl?.completedAt) {
    return { show: false, message: null, kickoffStatus: null };
  }

  const kickoffStatus = latestCrawl.postCrawlScanKickoffStatus;

  if (!KICKOFF_FAILURE_STATUSES.includes(kickoffStatus)) {
    return { show: false, message: null, kickoffStatus };
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
    return { show: false, message: null, kickoffStatus };
  }

  const message = postCrawlKickoffOperatorSummary(
    kickoffStatus,
    latestCrawl.postCrawlScanKickoffReasonCode,
    latestCrawl.postCrawlScanKickoffDetail
  );

  return {
    show: true,
    message:
      message ??
      'Crawl finished, but automatic verification could not be queued. Start a verification scan manually once Redis and workers are healthy.',
    kickoffStatus,
  };
}
