import { describe, expect, it } from 'vitest';
import { planMeetsMinimum, planTierRank } from '../plan-tier-order';
import type { PlanTier } from '../plans';

describe('planTierRank', () => {
  it('ranks tiers in ascending order', () => {
    expect(planTierRank('FREE')).toBeLessThan(planTierRank('STARTER'));
    expect(planTierRank('STARTER')).toBeLessThan(planTierRank('PROFESSIONAL'));
    expect(planTierRank('PROFESSIONAL')).toBeLessThan(planTierRank('ENTERPRISE'));
  });

  it('returns 0 for an unknown tier', () => {
    expect(planTierRank('UNKNOWN' as PlanTier)).toBe(0);
  });
});

describe('planMeetsMinimum', () => {

  it('requires same or higher tier', () => {
    expect(planMeetsMinimum('PROFESSIONAL', 'PROFESSIONAL')).toBe(true);
    expect(planMeetsMinimum('ENTERPRISE', 'PROFESSIONAL')).toBe(true);
    expect(planMeetsMinimum('STARTER', 'PROFESSIONAL')).toBe(false);
  });

  it.each([
    ['FREE', 'FREE', true],
    ['FREE', 'STARTER', false],
    ['FREE', 'PROFESSIONAL', false],
    ['FREE', 'ENTERPRISE', false],
    ['STARTER', 'FREE', true],
    ['STARTER', 'STARTER', true],
    ['STARTER', 'PROFESSIONAL', false],
    ['STARTER', 'ENTERPRISE', false],
    ['PROFESSIONAL', 'FREE', true],
    ['PROFESSIONAL', 'STARTER', true],
    ['PROFESSIONAL', 'PROFESSIONAL', true],
    ['PROFESSIONAL', 'ENTERPRISE', false],
    ['ENTERPRISE', 'FREE', true],
    ['ENTERPRISE', 'STARTER', true],
    ['ENTERPRISE', 'PROFESSIONAL', true],
    ['ENTERPRISE', 'ENTERPRISE', true],
  ] as const)(
    'when actual is %s and minimum is %s, it returns %s',
    (actual: PlanTier, minimum: PlanTier, expected: boolean) => {
      expect(planMeetsMinimum(actual, minimum)).toBe(expected);
    }
  );
});
