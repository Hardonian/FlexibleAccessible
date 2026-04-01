import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BaseAgent } from './base-agent.js';
import type { AgentContext, AgentResult } from './types.js';
import { prisma } from '@aros/db';

// Mock DB for usage logging
vi.mock('@aros/db', () => ({
  prisma: {
    aiUsageLog: { create: vi.fn() }
  }
}));

// Create a concrete implementation for testing the abstract class
class TestAgent extends BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    this.context = context;
    this.startTime = Date.now();
    this.tokensUsed = 150; // Mock tokens

    try {
      const res = await this.runStep('mock_step', async () => 'test-output');
      return this.createSuccessResult(res);
    } catch (err) {
      return this.createFailureResult(err);
    }
  }

  async executeFailure(context: AgentContext): Promise<AgentResult> {
    this.context = context;
    this.startTime = Date.now();

    try {
      await this.runStep('failing_step', async () => { throw new Error('simulated failure'); });
      return this.createSuccessResult('should not reach');
    } catch (err) {
      return this.createFailureResult(err);
    }
  }
}

describe('BaseAgent', () => {
  const mockContext: AgentContext = { organizationId: 'org-1', metadata: {} };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should execute a step, track duration, and return a success result', async () => {
    const agent = new TestAgent();
    const result = await agent.execute(mockContext);

    expect(result.success).toBe(true);
    expect(result.output).toBe('test-output');
    expect(result.steps.length).toBe(1);
    
    const step = result.steps[0];
    expect(step.name).toBe('mock_step');
    expect(step.status).toBe('completed');
    expect(step.output).toBe('test-output');
    expect(step.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should catch errors in a step and return a failure result', async () => {
    const agent = new TestAgent();
    const result = await agent.executeFailure(mockContext);

    expect(result.success).toBe(false);
    expect(result.error).toBe('simulated failure');
    expect(result.steps[0].status).toBe('failed');
    expect(result.steps[0].error).toBe('simulated failure');
  });

  it('should emit events during execution', async () => {
    const handler = vi.fn();
    const agent = new TestAgent(handler);
    await agent.execute(mockContext);

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'step_start', step: 'mock_step' }));
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ type: 'step_complete', step: 'mock_step', output: 'test-output' }));
  });
});