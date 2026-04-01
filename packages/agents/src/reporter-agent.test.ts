import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ReporterAgent } from './reporter-agent.js';
import { prisma } from '@aros/db';

// Mock dependencies
vi.mock('@aros/db', () => ({
  prisma: {
    canonicalFinding: { findMany: vi.fn() },
    issueCluster: { findMany: vi.fn() },
    scanRun: { findMany: vi.fn() },
    remediationSuggestion: { findMany: vi.fn() },
    report: { create: vi.fn() },
    aiUsageLog: { create: vi.fn() },
  },
}));

describe('ReporterAgent', () => {
  const mockContext = { siteId: 'site-abc', organizationId: 'org-xyz', metadata: {} };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should aggregate data, compute metrics, and generate a report', async () => {
    // Arrange: Mock the database queries
    (prisma.canonicalFinding.findMany as any).mockResolvedValue([
      { ruleId: 'image-alt', impact: 'SERIOUS', status: 'OPEN' }, // Auto-fixable
      { ruleId: 'color-contrast', impact: 'MODERATE', status: 'RESOLVED' } // Not auto-fixable
    ]);
    (prisma.issueCluster.findMany as any).mockResolvedValue([{ name: 'Nav', severity: 'SERIOUS', pageCount: 10 }]);
    (prisma.scanRun.findMany as any).mockResolvedValue([{ id: 'scan-1' }]);
    (prisma.remediationSuggestion.findMany as any).mockResolvedValue([
      { status: 'APPROVED', confidence: 0.9, type: 'CODE' },
      { status: 'PENDING', confidence: 0.8, type: 'CODE' }
    ]);
    (prisma.report.create as any).mockResolvedValue({ id: 'report-123', summary: 'Mock Summary' });

    const agent = new ReporterAgent();

    // Act
    const result = await agent.execute(mockContext);

    // Assert
    expect(result.success).toBe(true);
    
    const metrics = (result.output as any).metrics;
    expect(metrics.totalFindings).toBe(2);
    expect(metrics.resolvedFindings).toBe(1);
    expect(metrics.resolutionRate).toBe(50); // 1 out of 2 resolved
    expect(metrics.autoFixableFindings).toBe(1); // 'image-alt' is auto-fixable
    
    expect(prisma.report.create).toHaveBeenCalledOnce();
    expect(result.steps.length).toBe(3); // Should execute aggregate, compute_metrics, and generate_report
  });

  it('should handle failure when siteId is missing', async () => {
    const agent = new ReporterAgent();
    const result = await agent.execute({ organizationId: 'org-xyz', metadata: {} });
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('siteId required');
  });
});