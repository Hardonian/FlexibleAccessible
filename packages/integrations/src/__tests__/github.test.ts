import { describe, it, expect } from 'vitest';
import { formatFindingAsMarkdown } from '../github';
import { AccessibilityFinding } from '../types';

describe('github integrations', () => {
  describe('formatFindingAsMarkdown', () => {
    const baseFinding: AccessibilityFinding = {
      id: 'test-123',
      url: 'https://example.com',
      element: '<button>click</button>',
      wcagCriteria: '1.1.1 Non-text Content',
      severity: 'serious',
      description: 'Button has no accessible name',
      help: 'Provide an accessible name for the button',
      impact: 'high',
      timestamp: '2023-10-27T10:00:00Z'
    };

    it('should format a finding with valid severity properly', () => {
      const markdown = formatFindingAsMarkdown(baseFinding);
      expect(markdown).toContain('🟠 **Severity:** SERIOUS');
      expect(markdown).toContain(baseFinding.description);
      expect(markdown).toContain(baseFinding.help);
      expect(markdown).toContain(baseFinding.impact);
      expect(markdown).toContain(baseFinding.url);
      expect(markdown).toContain(baseFinding.element!);
    });

    it('should format a finding with critical severity properly', () => {
      const finding = { ...baseFinding, severity: 'critical' as const };
      const markdown = formatFindingAsMarkdown(finding);
      expect(markdown).toContain('🔴 **Severity:** CRITICAL');
    });

    it('should format a finding with moderate severity properly', () => {
      const finding = { ...baseFinding, severity: 'moderate' as const };
      const markdown = formatFindingAsMarkdown(finding);
      expect(markdown).toContain('🟡 **Severity:** MODERATE');
    });

    it('should format a finding with minor severity properly', () => {
      const finding = { ...baseFinding, severity: 'minor' as const };
      const markdown = formatFindingAsMarkdown(finding);
      expect(markdown).toContain('🔵 **Severity:** MINOR');
    });

    it('should handle missing element field', () => {
      const findingWithoutElement = { ...baseFinding, element: undefined };
      const markdown = formatFindingAsMarkdown(findingWithoutElement);
      expect(markdown).toContain('| Element | N/A |');
    });

    it('should use fallback emoji for invalid or unexpected severity strings', () => {
      const invalidFinding = {
        ...baseFinding,
        severity: 'unknown_severity_level' as any,
      } as AccessibilityFinding;
      const markdown = formatFindingAsMarkdown(invalidFinding);
      expect(markdown).toContain('⚪ **Severity:** UNKNOWN_SEVERITY_LEVEL');
    });
  });
});
