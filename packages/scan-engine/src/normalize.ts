import { createFingerprint } from '@aros/shared';

export interface AxeViolation {
  id: string;
  impact: string;
  description: string;
  help: string;
  helpUrl: string;
  tags: string[];
  nodes: Array<{
    target: string[];
    html: string;
    failureSummary?: string;
    any: unknown[];
    all: unknown[];
    none: unknown[];
  }>;
}

export interface NormalizedViolation {
  ruleId: string;
  impact: 'CRITICAL' | 'SERIOUS' | 'MODERATE' | 'MINOR';
  description: string;
  helpUrl: string;
  wcagTags: string[];
  selector: string;
  elementHtml: string;
  elementContext: string;
  fingerprint: string;
}

export function mapAxeImpact(
  impact: string
): 'CRITICAL' | 'SERIOUS' | 'MODERATE' | 'MINOR' {
  const map: Record<string, 'CRITICAL' | 'SERIOUS' | 'MODERATE' | 'MINOR'> = {
    critical: 'CRITICAL',
    serious: 'SERIOUS',
    moderate: 'MODERATE',
    minor: 'MINOR',
  };
  return map[impact] ?? 'MODERATE';
}

export function mapAxeTags(tags: string[]): string[] {
  return tags.filter(
    (t) =>
      t.startsWith('wcag') ||
      t.startsWith('best-practice') ||
      t.startsWith('section508')
  );
}

export function normalizeViolations(
  violations: AxeViolation[],
  siteId: string
): NormalizedViolation[] {
  const results: NormalizedViolation[] = [];

  for (const violation of violations) {
    for (const node of violation.nodes) {
      const selector = node.target?.join(' > ') ?? '';
      const elementHtml = node.html ?? '';

      results.push({
        ruleId: violation.id,
        impact: mapAxeImpact(violation.impact),
        description: violation.help || violation.description,
        helpUrl: violation.helpUrl,
        wcagTags: mapAxeTags(violation.tags),
        selector,
        elementHtml: elementHtml.slice(0, 2000),
        elementContext: node.failureSummary ?? '',
        fingerprint: createFingerprint({
          ruleId: violation.id,
          selector,
          siteId,
        }),
      });
    }
  }

  return results;
}
