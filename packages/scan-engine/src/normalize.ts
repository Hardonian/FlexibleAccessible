import { createFingerprint } from '@aros/shared';
import { getRuleInfo } from './rules';

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
  normalizedRuleKey: string;
  ruleVersion: string;
  evaluationKind: 'DETERMINISTIC' | 'HEURISTIC' | 'MODEL_ASSISTED';
  wcagVersion: string | null;
  wcagCriteria: string[];
  impact: 'CRITICAL' | 'SERIOUS' | 'MODERATE' | 'MINOR';
  confidence: number;
  description: string;
  explainability: string;
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
      const rule = getRuleInfo(violation.id, {
        tags: violation.tags,
        impact: violation.impact as 'critical' | 'serious' | 'moderate' | 'minor' | null,
      });

      results.push({
        ruleId: violation.id,
        normalizedRuleKey: rule.normalizedKey,
        ruleVersion: rule.version,
        evaluationKind: rule.evaluationKind,
        wcagVersion: rule.wcagVersion,
        wcagCriteria: rule.wcagCriteria,
        impact: mapAxeImpact(violation.impact),
        confidence: rule.confidence,
        description: violation.help || violation.description,
        explainability: rule.explainability,
        helpUrl: violation.helpUrl,
        wcagTags: mapAxeTags(violation.tags),
        selector,
        elementHtml: elementHtml.slice(0, 2000),
        elementContext: node.failureSummary ?? '',
        fingerprint: createFingerprint({
          ruleId: violation.id,
          selector,
          siteId,
          elementSignature: extractElementSignature(elementHtml),
        }),
      });
    }
  }

  return results;
}

function extractElementSignature(html: string): string {
  const tagMatch = html.match(/<(\w+)/);
  const roleMatch = html.match(/role="([^"]*)"/);
  const typeMatch = html.match(/type="([^"]*)"/);
  const tag = tagMatch?.[1]?.toLowerCase() ?? 'unknown';
  const role = roleMatch?.[1] ?? '';
  const type = typeMatch?.[1] ?? '';
  return `${tag}${role ? `[role=${role}]` : ''}${type ? `[type=${type}]` : ''}`;
}
