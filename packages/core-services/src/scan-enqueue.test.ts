import { describe, expect, it, vi, beforeEach } from 'vitest';
import { enqueueSiteScan } from './scan-enqueue';
import type { PrismaClient } from '@aros/db';

function mockPrisma(overrides: Record<string, unknown> = {}) {
  return {
    site: { findFirst: vi.fn() },
    page: { count: vi.fn() },
    scanRun: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    ...overrides,
  } as unknown as PrismaClient;
}

describe('enqueueSiteScan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queues when site has pages and queue succeeds', async () => {
    const add = vi.fn().mockResolvedValue({ id: 'job' });
    const close = vi.fn().mockResolvedValue(undefined);
    const prisma = mockPrisma();
    vi.mocked(prisma.site.findFirst).mockResolvedValue({ id: 's1' } as never);
    vi.mocked(prisma.page.count).mockResolvedValue(2 as never);
    vi.mocked(prisma.scanRun.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.scanRun.create).mockResolvedValue({ id: 'sr1' } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const result = await enqueueSiteScan(
      { prisma, queue: { add, close } },
      { siteId: 's1', organizationId: 'o1', trigger: 'operator', userId: 'u1' }
    );

    expect(result).toEqual({
      ok: true,
      kind: 'queued',
      scanRunId: 'sr1',
      bullmqJobId: 'scanRun:sr1',
    });
    expect(add).toHaveBeenCalledWith(
      'scan',
      { scanRunId: 'sr1', siteId: 's1' },
      expect.objectContaining({ jobId: 'scanRun:sr1' })
    );
    expect(close).not.toHaveBeenCalled();
  });

  it('returns invalid_target when site not in org', async () => {
    const prisma = mockPrisma();
    vi.mocked(prisma.site.findFirst).mockResolvedValue(null);

    const result = await enqueueSiteScan(
      { prisma, queue: { add: vi.fn(), close: vi.fn() } },
      { siteId: 's1', organizationId: 'o1', trigger: 'operator' }
    );

    expect(result).toEqual({ ok: false, kind: 'invalid_target', reason: 'site_not_found' });
  });

  it('returns invalid_target when no pages', async () => {
    const prisma = mockPrisma();
    vi.mocked(prisma.site.findFirst).mockResolvedValue({ id: 's1' } as never);
    vi.mocked(prisma.page.count).mockResolvedValue(0 as never);

    const result = await enqueueSiteScan(
      { prisma, queue: { add: vi.fn(), close: vi.fn() } },
      { siteId: 's1', organizationId: 'o1', trigger: 'operator' }
    );

    expect(result).toEqual({ ok: false, kind: 'invalid_target', reason: 'no_pages' });
  });

  it('dedupes when crawl already has completed scan', async () => {
    const prisma = mockPrisma();
    vi.mocked(prisma.site.findFirst).mockResolvedValue({ id: 's1' } as never);
    vi.mocked(prisma.page.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.scanRun.findFirst).mockResolvedValue({ id: 'prev' } as never);

    const result = await enqueueSiteScan(
      { prisma, queue: { add: vi.fn(), close: vi.fn() } },
      { siteId: 's1', organizationId: 'o1', crawlRunId: 'c1', trigger: 'crawl.completed' }
    );

    expect(result).toEqual({
      ok: true,
      kind: 'deduped',
      reason: 'crawl_already_scanned',
      scanRunId: 'prev',
    });
  });

  it('coalesces when pending scan exists for site (operator, no crawlRunId)', async () => {
    const prisma = mockPrisma();
    vi.mocked(prisma.site.findFirst).mockResolvedValue({ id: 's1' } as never);
    vi.mocked(prisma.page.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.scanRun.findFirst).mockResolvedValue({ id: 'active', status: 'PENDING' } as never);

    const result = await enqueueSiteScan(
      { prisma, queue: { add: vi.fn(), close: vi.fn() } },
      { siteId: 's1', organizationId: 'o1', trigger: 'operator' }
    );

    expect(result).toEqual({
      ok: true,
      kind: 'already_active',
      scanRunId: 'active',
      status: 'PENDING',
    });
  });

  it('marks scan failed and returns queue_unavailable when add throws', async () => {
    const add = vi.fn().mockRejectedValue(new Error('Redis down'));
    const close = vi.fn().mockResolvedValue(undefined);
    const prisma = mockPrisma();
    vi.mocked(prisma.site.findFirst).mockResolvedValue({ id: 's1' } as never);
    vi.mocked(prisma.page.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.scanRun.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.scanRun.create).mockResolvedValue({ id: 'sr-fail' } as never);
    const update = vi.fn().mockResolvedValue({} as never);
    vi.mocked(prisma.scanRun.update).mockImplementation(update);

    const result = await enqueueSiteScan(
      { prisma, queue: { add, close } },
      { siteId: 's1', organizationId: 'o1', trigger: 'operator' }
    );

    expect(result).toMatchObject({
      ok: false,
      kind: 'queue_unavailable',
      scanRunId: 'sr-fail',
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'sr-fail' },
        data: expect.objectContaining({
          status: 'FAILED',
          enqueueFailureCode: 'QUEUE_UNAVAILABLE',
        }),
      })
    );
  });

  it('allows a new operator scan when only a completed scan exists for the site', async () => {
    const add = vi.fn().mockResolvedValue({ id: 'job' });
    const prisma = mockPrisma();
    vi.mocked(prisma.site.findFirst).mockResolvedValue({ id: 's1' } as never);
    vi.mocked(prisma.page.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.scanRun.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.scanRun.create).mockResolvedValue({ id: 'sr-new' } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);

    const result = await enqueueSiteScan(
      { prisma, queue: { add, close: vi.fn() } },
      { siteId: 's1', organizationId: 'o1', trigger: 'operator' }
    );

    expect(result).toMatchObject({ ok: true, kind: 'queued', scanRunId: 'sr-new' });
    expect(add).toHaveBeenCalled();
  });
});
