import { vi, describe, it, expect, beforeEach } from 'vitest';
import { RemediationAgent } from './remediation-agent.js';
import { prisma } from '@aros/db';
import { generateFix, validateFix } from '@aros/remediation';

// Mock dependencies
vi.mock('@aros/db', () => ({
  prisma: {
    canonicalFinding: {
      findUnique: vi.fn(),
    },
    remediationSuggestion: {
      create: vi.fn(),
    },
    reviewTask: {
      create: vi.fn(),
    },
  },
  SuggestionType: {
    CODE: 'CODE',
  },
}));

vi.mock('@aros/remediation', () => ({
  generateFix: vi.fn(),
  validateFix: vi.fn(),
}));

describe('RemediationAgent', () => {
  const mockContext = { findingId: 'finding-123', siteId: 'site-abc', organizationId: 'org-xyz', metadata: {} };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should auto-approve a high-confidence, valid fix', async () => {
    // Arrange
    (prisma.canonicalFinding.findUnique as any).mockResolvedValue({
      id: 'finding-123',
      ruleId: 'image-alt',
      impact: 'SERIOUS',
      description: 'Image does not have an alt attribute.',
      occurrences: [{ elementHtml: '<img>', selector: 'img' }],
      cluster: null,
    });
    (generateFix as any).mockReturnValue({
      suggestedCode: '<img alt="A descriptive text">',
      confidence: 0.95,
      type: 'CODE',
      rationale: 'High confidence fix.',
    });
    (validateFix as any).mockReturnValue({ valid: true, warnings: [] });
    (prisma.remediationSuggestion.create as any).mockResolvedValue({ id: 'suggestion-456' });

    const agent = new RemediationAgent();

    // Act
    const result = await agent.execute(mockContext);

    // Assert
    expect(result.success).toBe(true);
    expect(result.output).toEqual({
      suggestionId: 'suggestion-456',
      status: 'APPROVED',
      autoApproved: true,
    });
    const suggestionCreateCall = (prisma.remediationSuggestion.create as any).mock.calls[0][0].data;
    expect(suggestionCreateCall.status).toBe('APPROVED');
    expect(prisma.reviewTask.create).not.toHaveBeenCalled();
  });

  it('should escalate a low-confidence fix to review', async () => {
    // Arrange
    (prisma.canonicalFinding.findUnique as any).mockResolvedValue({
      id: 'finding-123',
      ruleId: 'complex-rule',
      impact: 'MODERATE',
      description: 'A complex issue.',
      occurrences: [{ elementHtml: '<div></div>', selector: 'div' }],
      cluster: null,
    });
    (generateFix as any).mockReturnValue({
      suggestedCode: '<div role="region"></div>',
      confidence: 0.6,
      type: 'CODE',
      rationale: 'Low confidence fix.',
    });
    (validateFix as any).mockReturnValue({ valid: true, warnings: [] });
    (prisma.remediationSuggestion.create as any).mockResolvedValue({ id: 'suggestion-789' });

    const agent = new RemediationAgent();

    // Act
    const result = await agent.execute(mockContext);

    // Assert
    expect(result.success).toBe(true);
    expect(result.output).toEqual({
      suggestionId: 'suggestion-789',
      status: 'VALIDATED',
      autoApproved: false,
    });
    const suggestionCreateCall = (prisma.remediationSuggestion.create as any).mock.calls[0][0].data;
    expect(suggestionCreateCall.status).toBe('VALIDATED');
    expect(prisma.reviewTask.create).toHaveBeenCalledOnce();
  });

  it('should handle failure when finding is not found', async () => {
    // Arrange
    (prisma.canonicalFinding.findUnique as any).mockResolvedValue(null);
    const agent = new RemediationAgent();

    // Act
    const result = await agent.execute(mockContext);

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain('Finding finding-123 not found');
    expect(result.steps.find((s: any) => s.name === 'analyze')?.status).toBe('failed');
  });
});