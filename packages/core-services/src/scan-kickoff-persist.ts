import type { PostCrawlScanKickoffStatus, PrismaClient, ScanEnqueueFailureCode } from '@aros/db';
import { classifyScanEnqueueFailure } from './scan-enqueue-failure-code';
import type { EnqueueSiteScanResult } from './scan-enqueue';

export const POST_CRAWL_KICKOFF_FAILURE_STATUSES: PostCrawlScanKickoffStatus[] = [
  'QUEUE_UNAVAILABLE',
  'QUEUE_REJECTED',
  'DISPATCH_UNAVAILABLE',
  'KICKOFF_FAILED_UNKNOWN',
];

/**
 * Persists canonical post-crawl scan kickoff outcome on the crawl run (worker + operator retry share this).
 */
export async function persistPostCrawlScanKickoffAfterEnqueue(
  prisma: PrismaClient,
  crawlRunId: string,
  result: EnqueueSiteScanResult
): Promise<void> {
  if (result.ok) {
    await prisma.crawlRun.update({
      where: { id: crawlRunId },
      data: {
        postCrawlScanKickoffStatus: 'ENQUEUED',
        postCrawlScanKickoffScanRunId: result.scanRunId,
        postCrawlScanKickoffReasonCode: null,
        postCrawlScanKickoffDetail: null,
      },
    });
    return;
  }

  if (result.kind === 'invalid_target') {
    const detail =
      result.reason === 'no_pages'
        ? 'No pages in database to verify.'
        : 'Site could not be resolved for scan enqueue.';
    await prisma.crawlRun.update({
      where: { id: crawlRunId },
      data: {
        postCrawlScanKickoffStatus: 'NOT_REQUESTED',
        postCrawlScanKickoffDetail: detail,
        postCrawlScanKickoffReasonCode: null,
        postCrawlScanKickoffScanRunId: null,
      },
    });
    return;
  }

  if (result.kind === 'queue_unavailable') {
    const reasonCode: ScanEnqueueFailureCode = classifyScanEnqueueFailure(result.message);
    await prisma.crawlRun.update({
      where: { id: crawlRunId },
      data: {
        postCrawlScanKickoffStatus: 'QUEUE_UNAVAILABLE',
        postCrawlScanKickoffReasonCode: reasonCode,
        postCrawlScanKickoffDetail: result.message,
        postCrawlScanKickoffScanRunId: result.scanRunId,
      },
    });
    return;
  }

  await prisma.crawlRun.update({
    where: { id: crawlRunId },
    data: {
      postCrawlScanKickoffStatus: 'KICKOFF_FAILED_UNKNOWN',
      postCrawlScanKickoffReasonCode: 'KICKOFF_FAILED_UNKNOWN',
      postCrawlScanKickoffDetail: result.message,
      postCrawlScanKickoffScanRunId: null,
    },
  });
}
