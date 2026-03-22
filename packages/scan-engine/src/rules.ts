export interface RuleInfo {
  id: string;
  description: string;
  wcagCriteria: string[];
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  automatable: boolean;
  suggestable: boolean;
}

export const RULE_METADATA: Record<string, RuleInfo> = {
  'image-alt': {
    id: 'image-alt',
    description: 'Images must have alternate text',
    wcagCriteria: ['1.1.1'],
    impact: 'critical',
    automatable: true,
    suggestable: true,
  },
  'button-name': {
    id: 'button-name',
    description: 'Buttons must have discernible text',
    wcagCriteria: ['4.1.2'],
    impact: 'critical',
    automatable: true,
    suggestable: true,
  },
  'link-name': {
    id: 'link-name',
    description: 'Links must have discernible text',
    wcagCriteria: ['4.1.2', '2.4.4'],
    impact: 'serious',
    automatable: true,
    suggestable: true,
  },
  'label': {
    id: 'label',
    description: 'Form elements must have labels',
    wcagCriteria: ['1.3.1', '3.3.2'],
    impact: 'critical',
    automatable: true,
    suggestable: true,
  },
  'color-contrast': {
    id: 'color-contrast',
    description: 'Elements must have sufficient color contrast',
    wcagCriteria: ['1.4.3'],
    impact: 'serious',
    automatable: true,
    suggestable: false,
  },
  'heading-order': {
    id: 'heading-order',
    description: 'Heading levels should increase by one',
    wcagCriteria: ['1.3.1'],
    impact: 'moderate',
    automatable: true,
    suggestable: true,
  },
  'html-has-lang': {
    id: 'html-has-lang',
    description: 'HTML must have a lang attribute',
    wcagCriteria: ['3.1.1'],
    impact: 'serious',
    automatable: true,
    suggestable: true,
  },
  'region': {
    id: 'region',
    description: 'Content must be contained in landmarks',
    wcagCriteria: ['1.3.1'],
    impact: 'moderate',
    automatable: true,
    suggestable: true,
  },
  'document-title': {
    id: 'document-title',
    description: 'Documents must have a title element',
    wcagCriteria: ['2.4.2'],
    impact: 'serious',
    automatable: true,
    suggestable: true,
  },
  'duplicate-id': {
    id: 'duplicate-id',
    description: 'ID attribute values must be unique',
    wcagCriteria: ['4.1.1'],
    impact: 'minor',
    automatable: true,
    suggestable: false,
  },
};
