import { describe, expect, it, vi, beforeEach } from 'vitest';
import { updateAutoScanAfterCrawlAction } from './actions';

vi.mock('@/lib/db', () => ({
  prisma: {
    crawlConfig: { update: vi.fn() },
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
    vi.mocked(prisma.crawlConfig.update).mockResolvedValue({} as never);
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never);
  });

  it('persists autoScanAfterCrawl false when checkbox off', async () => {
    const fd = new FormData();
    fd.set('siteId', 's1');
    const result = await updateAutoScanAfterCrawlAction(undefined, fd);
    expect(result).toEqual({ ok: true });
    expect(prisma.crawlConfig.update).toHaveBeenCalledWith({
      where: { siteId: 's1' },
      data: { autoScanAfterCrawl: false },
    });
  });

  it('persists autoScanAfterCrawl true when checkbox on', async () => {
    const fd = new FormData();
    fd.set('siteId', 's1');
    fd.set('autoScanAfterCrawl', 'on');
    const result = await updateAutoScanAfterCrawlAction(undefined, fd);
    expect(result).toEqual({ ok: true });
    expect(prisma.crawlConfig.update).toHaveBeenCalledWith({
      where: { siteId: 's1' },
      data: { autoScanAfterCrawl: true },
    });
  });
});
