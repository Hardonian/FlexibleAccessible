export type RuleImpact = 'critical' | 'serious' | 'moderate' | 'minor';
export type RuleEvaluationKind = 'DETERMINISTIC' | 'HEURISTIC' | 'MODEL_ASSISTED';

export interface RuleInfo {
  id: string;
  normalizedKey: string;
  title: string;
  description: string;
  wcagVersion: string | null;
  wcagCriteria: string[];
  impact: RuleImpact;
  evaluationKind: RuleEvaluationKind;
  automatable: boolean;
  suggestable: boolean;
  version: string;
  explainability: string;
  confidence: number;
}

const RULE_VERSION = 'axe-core-v1';

export const RULE_METADATA: Record<string, RuleInfo> = {
  'image-alt': {
    id: 'image-alt',
    normalizedKey: 'content.image.alt-text.missing',
    title: 'Missing alternative text',
    description: 'Images must have alternate text',
    wcagVersion: 'WCAG2.1',
    wcagCriteria: ['1.1.1'],
    impact: 'critical',
    evaluationKind: 'DETERMINISTIC',
    automatable: true,
    suggestable: true,
    version: RULE_VERSION,
    explainability: 'The scan found an image element without a usable text alternative.',
    confidence: 0.98,
  },
  'button-name': {
    id: 'button-name',
    normalizedKey: 'interaction.button.accessible-name.missing',
    title: 'Button missing accessible name',
    description: 'Buttons must have discernible text',
    wcagVersion: 'WCAG2.1',
    wcagCriteria: ['4.1.2'],
    impact: 'critical',
    evaluationKind: 'DETERMINISTIC',
    automatable: true,
    suggestable: true,
    version: RULE_VERSION,
    explainability:
      'The scan found a button without discernible text or another accessible name.',
    confidence: 0.97,
  },
  'link-name': {
    id: 'link-name',
    normalizedKey: 'navigation.link.accessible-name.missing',
    title: 'Link missing accessible name',
    description: 'Links must have discernible text',
    wcagVersion: 'WCAG2.1',
    wcagCriteria: ['4.1.2', '2.4.4'],
    impact: 'serious',
    evaluationKind: 'DETERMINISTIC',
    automatable: true,
    suggestable: true,
    version: RULE_VERSION,
    explainability: 'The scan found a link without text or an equivalent accessible name.',
    confidence: 0.96,
  },
  'label': {
    id: 'label',
    normalizedKey: 'forms.control.label.missing',
    title: 'Form control missing label',
    description: 'Form elements must have labels',
    wcagVersion: 'WCAG2.1',
    wcagCriteria: ['1.3.1', '3.3.2'],
    impact: 'critical',
    evaluationKind: 'DETERMINISTIC',
    automatable: true,
    suggestable: true,
    version: RULE_VERSION,
    explainability:
      'The scan found a form control without an associated programmatic label.',
    confidence: 0.98,
  },
  'color-contrast': {
    id: 'color-contrast',
    normalizedKey: 'visual.contrast.text.insufficient',
    title: 'Insufficient color contrast',
    description: 'Elements must have sufficient color contrast',
    wcagVersion: 'WCAG2.1',
    wcagCriteria: ['1.4.3'],
    impact: 'serious',
    evaluationKind: 'HEURISTIC',
    automatable: true,
    suggestable: false,
    version: RULE_VERSION,
    explainability:
      'The scan measured foreground/background contrast below the configured threshold.',
    confidence: 0.89,
  },
  'heading-order': {
    id: 'heading-order',
    normalizedKey: 'structure.heading.order.skipped',
    title: 'Skipped heading level',
    description: 'Heading levels should increase by one',
    wcagVersion: 'WCAG2.1',
    wcagCriteria: ['1.3.1'],
    impact: 'moderate',
    evaluationKind: 'HEURISTIC',
    automatable: true,
    suggestable: true,
    version: RULE_VERSION,
    explainability:
      'The scan observed a heading sequence that appears to skip levels and may confuse navigation.',
    confidence: 0.82,
  },
  'html-has-lang': {
    id: 'html-has-lang',
    normalizedKey: 'document.language.lang-missing',
    title: 'Missing document language',
    description: 'HTML must have a lang attribute',
    wcagVersion: 'WCAG2.1',
    wcagCriteria: ['3.1.1'],
    impact: 'serious',
    evaluationKind: 'DETERMINISTIC',
    automatable: true,
    suggestable: true,
    version: RULE_VERSION,
    explainability: 'The root html element is missing a language declaration.',
    confidence: 0.99,
  },
  'region': {
    id: 'region',
    normalizedKey: 'landmarks.content.region.missing',
    title: 'Content not contained within landmarks',
    description: 'Content must be contained in landmarks',
    wcagVersion: 'WCAG2.1',
    wcagCriteria: ['1.3.1'],
    impact: 'moderate',
    evaluationKind: 'HEURISTIC',
    automatable: true,
    suggestable: true,
    version: RULE_VERSION,
    explainability:
      'The scan found content outside expected landmark regions, which may reduce navigation support.',
    confidence: 0.8,
  },
  'document-title': {
    id: 'document-title',
    normalizedKey: 'document.title.missing',
    title: 'Missing document title',
    description: 'Documents must have a title element',
    wcagVersion: 'WCAG2.1',
    wcagCriteria: ['2.4.2'],
    impact: 'serious',
    evaluationKind: 'DETERMINISTIC',
    automatable: true,
    suggestable: true,
    version: RULE_VERSION,
    explainability: 'The page is missing a descriptive document title.',
    confidence: 0.99,
  },
  'duplicate-id': {
    id: 'duplicate-id',
    normalizedKey: 'dom.id.duplicate',
    title: 'Duplicate DOM id',
    description: 'ID attribute values must be unique',
    wcagVersion: 'WCAG2.1',
    wcagCriteria: ['4.1.1'],
    impact: 'minor',
    evaluationKind: 'DETERMINISTIC',
    automatable: true,
    suggestable: false,
    version: RULE_VERSION,
    explainability:
      'The scan found repeated id attribute values that can break associations and navigation.',
    confidence: 0.95,
  },
};

function deriveCriteriaFromTags(tags: string[]): string[] {
  return tags
    .filter((tag) => /^wcag\d{3,}$/.test(tag))
    .map((tag) => tag.replace(/^wcag/, ''))
    .map((raw) => `${raw[0]}.${raw[1]}.${raw.slice(2)}`)
    .filter((criterion, index, all) => all.indexOf(criterion) === index);
}

function deriveVersionFromTags(tags: string[]): string | null {
  if (tags.some((tag) => tag.startsWith('wcag22'))) return 'WCAG2.2';
  if (tags.some((tag) => tag.startsWith('wcag21'))) return 'WCAG2.1';
  if (tags.some((tag) => tag.startsWith('wcag2'))) return 'WCAG2.0';
  return null;
}

export function getRuleInfo(
  ruleId: string,
  input?: { tags?: string[]; impact?: RuleImpact | null }
): RuleInfo {
  const known = RULE_METADATA[ruleId];
  if (known) {
    return known;
  }

  const tags = input?.tags ?? [];
  const derivedCriteria = deriveCriteriaFromTags(tags);
  const derivedVersion = deriveVersionFromTags(tags);

  return {
    id: ruleId,
    normalizedKey: `axe.${ruleId}`,
    title: ruleId,
    description: `Accessibility rule ${ruleId}`,
    wcagVersion: derivedVersion,
    wcagCriteria: derivedCriteria,
    impact: input?.impact ?? 'moderate',
    evaluationKind: 'DETERMINISTIC',
    automatable: true,
    suggestable: false,
    version: RULE_VERSION,
    explainability: 'Rule metadata came from the scanner result because no first-class definition exists yet.',
    confidence: 0.75,
  };
}
