import { describe, expect, it, vi, beforeEach } from 'vitest';
import { updateAutoScanAfterCrawlAction } from './actions';

vi.mock('@/lib/db', () => ({
  prisma: {
    crawlConfig: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/auth-guard', () => ({
  requireSiteAccess: vi.fn(),
}));

import { prisma } from '@/lib/db';
import { requireSiteAccess } from '@/lib/auth-guard';

describe('updateAutoScanAfterCrawlAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSiteAccess).mockResolvedValue({
      user: { id: 'u1', email: 'a@b.c', name: null },
      organizationId: 'o1',
      role: 'ADMIN',
      siteId: 's1',
      workspaceId: 'w1',
    } as never);
    vi.mocked(prisma.crawlConfig.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
  });

  it('persists automation settings with cadence off', async () => {
    const fd = new FormData();
    fd.set('siteId', 's1');
    fd.set('scheduleCron', 'off');
    const result = await updateAutoScanAfterCrawlAction(undefined, fd);
    expect(result).toEqual({ ok: true });
    expect(prisma.crawlConfig.updateMany).toHaveBeenCalledWith({
      where: { siteId: 's1', site: { workspace: { organizationId: 'o1' } } },
      data: { autoScanAfterCrawl: false, scheduleCron: null },
    });
  });

  it('persists autoScanAfterCrawl true and supported cadence', async () => {
    const fd = new FormData();
    fd.set('siteId', 's1');
    fd.set('autoScanAfterCrawl', 'on');
    fd.set('scheduleCron', '@weekly');
    const result = await updateAutoScanAfterCrawlAction(undefined, fd);
    expect(result).toEqual({ ok: true });
    expect(prisma.crawlConfig.updateMany).toHaveBeenCalledWith({
      where: { siteId: 's1', site: { workspace: { organizationId: 'o1' } } },
      data: { autoScanAfterCrawl: true, scheduleCron: '@weekly' },
    });
  });

  it('rejects unsupported cadence strings', async () => {
    const fd = new FormData();
    fd.set('siteId', 's1');
    fd.set('scheduleCron', '0 0 * * *');
    const result = await updateAutoScanAfterCrawlAction(undefined, fd);
    expect(result).toEqual({ ok: false, error: 'Unsupported scan cadence.' });
    expect(prisma.crawlConfig.updateMany).not.toHaveBeenCalled();
  });
});
