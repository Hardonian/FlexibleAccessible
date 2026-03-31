import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AgentOrchestrator } from './orchestrator';
import { ScannerAgent } from './scanner-agent';
import { RemediationAgent } from './remediation-agent';
import { ReporterAgent } from './reporter-agent';
import { prisma } from '@aros/db';

// Mock the individual agents
vi.mock('./scanner-agent');
vi.mock('./remediation-agent');
vi.mock('./reporter-agent');

vi.mock('@aros/db', () => ({
  prisma: {
    canonicalFinding: { findMany: vi.fn() },
  },
}));

describe('AgentOrchestrator', () => {
  const mockContext = { siteId: 'site-abc', organizationId: 'org-xyz', metadata: {} };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should run the full pipeline sequentially and batch remediations', async () => {
    // Arrange
    const orchestrator = new AgentOrchestrator();
    const onEvent = vi.fn();
    // Pass the mock event handler to capture lifecycle events
    (orchestrator as any).onEvent = onEvent;

    (ScannerAgent.prototype.execute as any).mockResolvedValue({ success: true, output: 'scan-output' });
    (ReporterAgent.prototype.execute as any).mockResolvedValue({ success: true, output: 'report-output' });
    
    // Mock 2 open findings to trigger 2 remediation agent executions
    (prisma.canonicalFinding.findMany as any).mockResolvedValue([{ id: 'finding-1' }, { id: 'finding-2' }]);
    (RemediationAgent.prototype.execute as any).mockResolvedValue({ success: true, output: 'remediation-output' });

    // Act
    const result = await orchestrator.runFullPipeline(mockContext);

    // Assert
    expect(ScannerAgent.prototype.execute).toHaveBeenCalledWith(mockContext);
    expect(ReporterAgent.prototype.execute).toHaveBeenCalledWith(mockContext);
    
    // Remediation agent should be instantiated and executed for each finding
    expect(RemediationAgent.prototype.execute).toHaveBeenCalledTimes(2);

    // Check the structure of the returned composite result
    expect(result.scan.output).toBe('scan-output');
    expect(result.report.output).toBe('report-output');
    expect(result.remediation.length).toBe(2);
    expect(result.remediation[0].output).toBe('remediation-output');

    // Verify events were emitted bridging the boundaries
    expect(onEvent).toHaveBeenCalledWith({ type: 'step_start', step: 'orchestrator:scan' });
    expect(onEvent).toHaveBeenCalledWith({ type: 'step_start', step: 'orchestrator:remediation' });
    expect(onEvent).toHaveBeenCalledWith({ type: 'step_start', step: 'orchestrator:report' });
  });
});