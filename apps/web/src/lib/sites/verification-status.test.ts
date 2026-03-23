import { describe, expect, it, vi } from 'vitest';
import { getPostCrawlScanEnqueueFailureHint, getSiteVerificationStatus } from './verification-status';
import type { PrismaClient } from '@aros/db';

function mockPrisma(scanRun: { findFirst: ReturnType<typeof vi.fn> }) {
  return { scanRun } as unknown as PrismaClient;
}

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

  it('returns failed_enqueue when no active scan but queue-failed run exists', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'sr-fail',
        createdAt: new Date('2025-01-02T00:00:00Z'),
        errorMessage: 'Queue unavailable: Redis down',
      });
    const row = await getSiteVerificationStatus(mockPrisma({ findFirst }), {
      siteId: 's1',
      organizationId: 'o1',
    });
    expect(row).toMatchObject({
      status: 'failed_enqueue',
      scanRunId: 'sr-fail',
      errorHint: 'Queue unavailable: Redis down',
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
      errorHint: null,
    });
    expect(findFirst).toHaveBeenCalledTimes(2);
  });
});

describe('getPostCrawlScanEnqueueFailureHint', () => {
  it('shows hint when latest completed crawl has failed queue scan and no recovery', async () => {
    const completedAt = new Date('2025-01-10T12:00:00Z');
    const prisma = {
      crawlRun: {
        findFirst: vi.fn().mockResolvedValue({ id: 'c1', completedAt }),
      },
      scanRun: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: 'sr-bad' })
          .mockResolvedValueOnce(null),
      },
    } as unknown as PrismaClient;

    const hint = await getPostCrawlScanEnqueueFailureHint(prisma, {
      siteId: 's1',
      organizationId: 'o1',
    });
    expect(hint.show).toBe(true);
    expect(hint.message).toContain('could not be queued');
  });

  it('hides hint when a newer completed scan exists', async () => {
    const completedAt = new Date('2025-01-10T12:00:00Z');
    const prisma = {
      crawlRun: {
        findFirst: vi.fn().mockResolvedValue({ id: 'c1', completedAt }),
      },
      scanRun: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({ id: 'sr-bad' })
          .mockResolvedValueOnce({ id: 'sr-ok' }),
      },
    } as unknown as PrismaClient;

    const hint = await getPostCrawlScanEnqueueFailureHint(prisma, {
      siteId: 's1',
      organizationId: 'o1',
    });
    expect(hint.show).toBe(false);
  });
});
