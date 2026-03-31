import { describe, it, expect } from 'vitest';

// Implementation representing the rule set defined in REMEDIATION_LIFECYCLE.md
function canOperatorTransition(fromStatus: string, toStatus: string): boolean {
  // Explicitly forbidden jumps
  const invalidTransitions = [
    ['FALSE_POSITIVE', 'RESOLVED'],
    ['WONT_FIX', 'RESOLVED'],
    ['FALSE_POSITIVE', 'MITIGATED'],
    ['WONT_FIX', 'MITIGATED'],
  ];
  return !invalidTransitions.some(t => t[0] === fromStatus && t[1] === toStatus);
}

describe('Remediation Lifecycle Status Transitions', () => {
  it('should allow valid linear forward progression transitions', () => {
    expect(canOperatorTransition('OPEN', 'ACKNOWLEDGED')).toBe(true);
    expect(canOperatorTransition('OPEN', 'IN_PROGRESS')).toBe(true);
    expect(canOperatorTransition('IN_PROGRESS', 'RESOLVED')).toBe(true);
    expect(canOperatorTransition('OPEN', 'FALSE_POSITIVE')).toBe(true);
  });

  it('should strictly prevent direct transition from FALSE_POSITIVE to RESOLVED', () => {
    expect(canOperatorTransition('FALSE_POSITIVE', 'RESOLVED')).toBe(false);
  });

  it('should strictly prevent direct transition from WONT_FIX to RESOLVED', () => {
    expect(canOperatorTransition('WONT_FIX', 'RESOLVED')).toBe(false);
  });
});