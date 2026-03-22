export type WcagLevel = 'A' | 'AA' | 'AAA';

interface WcagCriterion {
  id: string;
  name: string;
  level: WcagLevel;
  principle: string;
}

export const wcagCriteriaMap: Record<string, WcagCriterion> = {
  'wcag111': { id: '1.1.1', name: 'Non-text Content', level: 'A', principle: 'Perceivable' },
  'wcag121': { id: '1.2.1', name: 'Audio-only and Video-only', level: 'A', principle: 'Perceivable' },
  'wcag131': { id: '1.3.1', name: 'Info and Relationships', level: 'A', principle: 'Perceivable' },
  'wcag132': { id: '1.3.2', name: 'Meaningful Sequence', level: 'A', principle: 'Perceivable' },
  'wcag133': { id: '1.3.3', name: 'Sensory Characteristics', level: 'A', principle: 'Perceivable' },
  'wcag141': { id: '1.4.1', name: 'Use of Color', level: 'A', principle: 'Perceivable' },
  'wcag142': { id: '1.4.2', name: 'Audio Control', level: 'A', principle: 'Perceivable' },
  'wcag143': { id: '1.4.3', name: 'Contrast (Minimum)', level: 'AA', principle: 'Perceivable' },
  'wcag144': { id: '1.4.4', name: 'Resize Text', level: 'AA', principle: 'Perceivable' },
  'wcag145': { id: '1.4.5', name: 'Images of Text', level: 'AA', principle: 'Perceivable' },
  'wcag211': { id: '2.1.1', name: 'Keyboard', level: 'A', principle: 'Operable' },
  'wcag212': { id: '2.1.2', name: 'No Keyboard Trap', level: 'A', principle: 'Operable' },
  'wcag221': { id: '2.2.1', name: 'Timing Adjustable', level: 'A', principle: 'Operable' },
  'wcag222': { id: '2.2.2', name: 'Pause Stop Hide', level: 'A', principle: 'Operable' },
  'wcag231': { id: '2.3.1', name: 'Three Flashes', level: 'A', principle: 'Operable' },
  'wcag241': { id: '2.4.1', name: 'Bypass Blocks', level: 'A', principle: 'Operable' },
  'wcag242': { id: '2.4.2', name: 'Page Titled', level: 'A', principle: 'Operable' },
  'wcag243': { id: '2.4.3', name: 'Focus Order', level: 'A', principle: 'Operable' },
  'wcag244': { id: '2.4.4', name: 'Link Purpose (In Context)', level: 'A', principle: 'Operable' },
  'wcag246': { id: '2.4.6', name: 'Headings and Labels', level: 'AA', principle: 'Operable' },
  'wcag247': { id: '2.4.7', name: 'Focus Visible', level: 'AA', principle: 'Operable' },
  'wcag251': { id: '2.5.1', name: 'Pointer Gestures', level: 'A', principle: 'Operable' },
  'wcag252': { id: '2.5.2', name: 'Pointer Cancellation', level: 'A', principle: 'Operable' },
  'wcag253': { id: '2.5.3', name: 'Label in Name', level: 'A', principle: 'Operable' },
  'wcag311': { id: '3.1.1', name: 'Language of Page', level: 'A', principle: 'Understandable' },
  'wcag312': { id: '3.1.2', name: 'Language of Parts', level: 'AA', principle: 'Understandable' },
  'wcag321': { id: '3.2.1', name: 'On Focus', level: 'A', principle: 'Understandable' },
  'wcag322': { id: '3.2.2', name: 'On Input', level: 'A', principle: 'Understandable' },
  'wcag331': { id: '3.3.1', name: 'Error Identification', level: 'A', principle: 'Understandable' },
  'wcag332': { id: '3.3.2', name: 'Labels or Instructions', level: 'A', principle: 'Understandable' },
  'wcag411': { id: '4.1.1', name: 'Parsing', level: 'A', principle: 'Robust' },
  'wcag412': { id: '4.1.2', name: 'Name Role Value', level: 'A', principle: 'Robust' },
  'wcag413': { id: '4.1.3', name: 'Status Messages', level: 'AA', principle: 'Robust' },
};

export function getWcagLevel(tags: string[]): WcagLevel | null {
  for (const tag of tags) {
    const normalized = tag.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const criterion = wcagCriteriaMap[normalized];
    if (criterion) return criterion.level;
  }
  return null;
}
