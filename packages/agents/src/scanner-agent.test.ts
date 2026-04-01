import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ScannerAgent } from './scanner-agent';
import { prisma } from '@aros/db';
import { getSharedScanQueue } from '@aros/shared';
import { Queue } from 'bullmq';

// Mock dependencies
vi.mock('@aros/db', () => ({
  prisma: {
    site: { findUnique: vi.fn() },
    scanRun: { findFirst: vi.fn(), create: vi.fn() },
    canonicalFinding: { findMany: vi.fn(), count: vi.fn() },
  },
}));

const mockQueue = { add: vi.fn(), addBulk: vi.fn(), close: vi.fn() };
vi.mock('@aros/shared', async (importOriginal) => {
  const original = await importOriginal<typeof import('@aros/shared')>();
  return {
    ...original,
    getSharedScanQueue: vi.fn(() => mockQueue),
    bullmqConnectionOptions: vi.fn(() => ({})),
  };
});

vi.mock('bullmq', () => ({
  Queue: vi.fn(function() { return mockQueue; }),
}));

describe('ScannerAgent', () => {
  const mockContext = { siteId: 'site-abc', organizationId: 'org-xyz', metadata: {} };

  beforeEach(() => {
    vi.resetAllMocks();
    (prisma.site.findUnique as any).mockResolvedValue({ id: 'site-abc' });
    (prisma.canonicalFinding.count as any).mockResolvedValue(10);
  });

  it('should schedule a scan if the last scan is stale', async () => {
    // Arrange
    const staleDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    (prisma.scanRun.findFirst as any).mockResolvedValue({ completedAt: staleDate });
    (prisma.scanRun.create as any).mockResolvedValue({ id: 'scan-run-123' });
    (prisma.canonicalFinding.findMany as any).mockResolvedValue([]);

    const agent = new ScannerAgent();

    // Act
    const result = await agent.execute(mockContext);

    // Assert
    expect(result.success).toBe(true);
    expect((result.output as any).schedule.action).toBe('queued');
    expect(getSharedScanQueue().add).toHaveBeenCalledWith('scan', {
      scanRunId: 'scan-run-123',
      siteId: 'site-abc',
    });
  });

  it('should skip scan if a recent scan exists', async () => {
    // Arrange
    const recentDate = new Date(); // Now
    (prisma.scanRun.findFirst as any).mockResolvedValue({ completedAt: recentDate });
    (prisma.canonicalFinding.findMany as any).mockResolvedValue([]);

    const agent = new ScannerAgent();

    // Act
    const result = await agent.execute(mockContext);

    // Assert
    expect(result.success).toBe(true);
    expect((result.output as any).schedule.action).toBe('skipped');
    expect(getSharedScanQueue().add).not.toHaveBeenCalled();
  });

  it('should trigger remediation for open findings without suggestions', async () => {
    // Arrange
    (prisma.scanRun.findFirst as any).mockResolvedValue({ completedAt: new Date() });
    const findingsToRemediate = [{ id: 'finding-1' }, { id: 'finding-2' }];
    (prisma.canonicalFinding.findMany as any).mockResolvedValue(findingsToRemediate);

    const agent = new ScannerAgent();

    // Act
    const result = await agent.execute(mockContext);

    // Assert
    expect(result.success).toBe(true);
    expect((result.output as any).remediation.remediationJobsQueued).toBe(2);
    expect(Queue).toHaveBeenCalledWith('remediation', expect.any(Object));
    expect(mockQueue.addBulk).toHaveBeenCalledWith([
      { name: 'remediation', data: { findingId: 'finding-1', siteId: 'site-abc' } },
      { name: 'remediation', data: { findingId: 'finding-2', siteId: 'site-abc' } },
    ]);
  });

  it('should handle failure when siteId is missing', async () => {
    // Arrange
    const agent = new ScannerAgent();

    // Act
    const result = await agent.execute({ organizationId: 'org-xyz', metadata: {} } as any);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain('siteId required');
  });
});