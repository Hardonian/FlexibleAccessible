import { describe, expect, it, vi } from 'vitest';
import { persistPostCrawlScanKickoffAfterEnqueue } from './scan-kickoff-persist';
import type { PrismaClient } from '@aros/db';

describe('persistPostCrawlScanKickoffAfterEnqueue', () => {
  it('sets ENQUEUED and scan run id on queued success', async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = { crawlRun: { update } } as unknown as PrismaClient;
    await persistPostCrawlScanKickoffAfterEnqueue(prisma, 'c1', {
      ok: true,
      kind: 'queued',
      scanRunId: 'sr1',
      bullmqJobId: 'x',
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: {
        postCrawlScanKickoffStatus: 'ENQUEUED',
        postCrawlScanKickoffScanRunId: 'sr1',
        postCrawlScanKickoffReasonCode: null,
        postCrawlScanKickoffDetail: null,
      },
    });
  });

  it('sets QUEUE_UNAVAILABLE with reason on queue_unavailable', async () => {
    const update = vi.fn().mockResolvedValue({});
    const prisma = { crawlRun: { update } } as unknown as PrismaClient;
    await persistPostCrawlScanKickoffAfterEnqueue(prisma, 'c1', {
      ok: false,
      kind: 'queue_unavailable',
      message: 'connect ECONNREFUSED',
      scanRunId: 'sr-fail',
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'c1' },
      data: expect.objectContaining({
        postCrawlScanKickoffStatus: 'QUEUE_UNAVAILABLE',
        postCrawlScanKickoffScanRunId: 'sr-fail',
        postCrawlScanKickoffDetail: 'connect ECONNREFUSED',
      }),
    });
  });
});
