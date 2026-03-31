import { describe, expect, it } from 'vitest';
import { normalizeViolations } from './normalize';

describe('normalizeViolations', () => {
  it('enriches violations with canonical rule metadata', () => {
    const [violation] = normalizeViolations(
      [
        {
          id: 'image-alt',
          impact: 'critical',
          description: 'Images must have alternate text',
          help: 'Images must have alternate text',
          helpUrl: 'https://dequeuniversity.com',
          tags: ['wcag111', 'wcag2a'],
          nodes: [
            {
              target: ['img.hero'],
              html: '<img class="hero" src="/hero.png">',
              failureSummary: 'Fix any of the following: Element does not have an alt attribute',
              any: [],
              all: [],
              none: [],
            },
          ],
        },
      ],
      'site-123'
    );

    expect(violation.normalizedRuleKey).toBe('content.image.alt-text.missing');
    expect(violation.ruleVersion).toBe('axe-core-v1');
    expect(violation.wcagCriteria).toEqual(['1.1.1']);
    expect(violation.evaluationKind).toBe('DETERMINISTIC');
    expect(violation.confidence).toBeGreaterThan(0.9);
  });

  it('uses element signature in the fingerprint so structurally different nodes do not collapse', () => {
    const [imageViolation] = normalizeViolations(
      [
        {
          id: 'image-alt',
          impact: 'critical',
          description: 'Images must have alternate text',
          help: 'Images must have alternate text',
          helpUrl: 'https://dequeuniversity.com',
          tags: ['wcag111'],
          nodes: [
            {
              target: ['.shared-target'],
              html: '<img class="shared-target" src="/hero.png">',
              any: [],
              all: [],
              none: [],
            },
          ],
        },
      ],
      'site-123'
    );

    const [buttonViolation] = normalizeViolations(
      [
        {
          id: 'image-alt',
          impact: 'critical',
          description: 'Images must have alternate text',
          help: 'Images must have alternate text',
          helpUrl: 'https://dequeuniversity.com',
          tags: ['wcag111'],
          nodes: [
            {
              target: ['.shared-target'],
              html: '<button class="shared-target"></button>',
              any: [],
              all: [],
              none: [],
            },
          ],
        },
      ],
      'site-123'
    );

    expect(imageViolation.fingerprint).not.toBe(buttonViolation.fingerprint);
  });
});
