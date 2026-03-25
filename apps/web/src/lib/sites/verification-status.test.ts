import { describe, expect, it, vi } from 'vitest';
import {
  getPostCrawlScanEnqueueFailureHint,
  getSiteVerificationStatus,
  postCrawlKickoffOperatorSummary,
} from './verification-status';
import type { PrismaClient } from '@aros/db';

function mockPrisma(scanRun: { findFirst: ReturnType<typeof vi.fn> }) {
  return { scanRun } as unknown as PrismaClient;
}

describe('postCrawlKickoffOperatorSummary', () => {
  it('describes skipped by setting', () => {
    const s = postCrawlKickoffOperatorSummary('SKIPPED_BY_SETTING', null, null);
    expect(s).toContain('disabled');
  });

  it('describes queue unavailable with reason', () => {
    const s = postCrawlKickoffOperatorSummary('QUEUE_UNAVAILABLE', 'QUEUE_UNAVAILABLE', 'ECONNREFUSED');
    expect(s).toContain('could not be queued');
    expect(s).toContain('ECONNREFUSED');
  });
});

describe('getSiteVerificationStatus', () => {
  it('returns pending when latest active scan is PENDING', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: 'sr1',
      status: 'PENDING',
      createdAt: new Date('2025-01-01T00:00:00Z'),
    });
    const row = await getSiteVerificationStatus(mockPrisma({ findFirst }), {
      siteId: 's1',
      organizationId: 'o1',
    });
    expect(row).toMatchObject({ status: 'pending', scanRunId: 'sr1' });
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it('returns failed_enqueue when enqueueFailureCode is set', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'sr-fail',
        createdAt: new Date('2025-01-02T00:00:00Z'),
        errorMessage: 'Queue unavailable: Redis down',
        enqueueFailureCode: 'QUEUE_UNAVAILABLE',
      });
    const row = await getSiteVerificationStatus(mockPrisma({ findFirst }), {
      siteId: 's1',
      organizationId: 'o1',
    });
    expect(row).toMatchObject({
      status: 'failed_enqueue',
      scanRunId: 'sr-fail',
      enqueueFailureCode: 'QUEUE_UNAVAILABLE',
      errorDetail: 'Redis down',
    });
  });

  it('returns idle when no active or failed-enqueue rows', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const row = await getSiteVerificationStatus(mockPrisma({ findFirst }), {
      siteId: 's1',
      organizationId: 'o1',
    });
    expect(row).toEqual({
      status: 'idle',
      scanRunId: null,
      createdAt: null,
      enqueueFailureCode: null,
      errorDetail: null,
    });
    expect(findFirst).toHaveBeenCalledTimes(2);
  });
});

describe('getPostCrawlScanEnqueueFailureHint', () => {
  it('shows hint when latest crawl has canonical kickoff failure and no recovery', async () => {
    const completedAt = new Date('2025-01-10T12:00:00Z');
    const prisma = {
      crawlRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'c1',
          completedAt,
          postCrawlScanKickoffStatus: 'QUEUE_UNAVAILABLE',
          postCrawlScanKickoffReasonCode: 'QUEUE_UNAVAILABLE',
          postCrawlScanKickoffDetail: 'ECONNREFUSED',
        }),
      },
      scanRun: {
        findFirst: vi.fn().mockResolvedValueOnce(null),
      },
    } as unknown as PrismaClient;

    const hint = await getPostCrawlScanEnqueueFailureHint(prisma, {
      siteId: 's1',
      organizationId: 'o1',
    });
    expect(hint.show).toBe(true);
    expect(hint.kickoffStatus).toBe('QUEUE_UNAVAILABLE');
    expect(hint.message).toContain('could not be queued');
  });

  it('hides hint when kickoff succeeded', async () => {
    const prisma = {
      crawlRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'c1',
          completedAt: new Date(),
          postCrawlScanKickoffStatus: 'ENQUEUED',
          postCrawlScanKickoffReasonCode: null,
          postCrawlScanKickoffDetail: null,
        }),
      },
    } as unknown as PrismaClient;

    const hint = await getPostCrawlScanEnqueueFailureHint(prisma, {
      siteId: 's1',
      organizationId: 'o1',
    });
    expect(hint.show).toBe(false);
  });

  it('hides hint when a newer completed scan exists', async () => {
    const completedAt = new Date('2025-01-10T12:00:00Z');
    const prisma = {
      crawlRun: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'c1',
          completedAt,
          postCrawlScanKickoffStatus: 'QUEUE_UNAVAILABLE',
          postCrawlScanKickoffReasonCode: 'QUEUE_UNAVAILABLE',
          postCrawlScanKickoffDetail: null,
        }),
      },
      scanRun: {
        findFirst: vi.fn().mockResolvedValueOnce({ id: 'sr-ok' }),
      },
    } as unknown as PrismaClient;

    const hint = await getPostCrawlScanEnqueueFailureHint(prisma, {
      siteId: 's1',
      organizationId: 'o1',
    });
    expect(hint.show).toBe(false);
  });
});
