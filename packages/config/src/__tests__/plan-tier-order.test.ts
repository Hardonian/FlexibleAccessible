import { describe, expect, it } from 'vitest';
import { planMeetsMinimum, planTierRank, PLAN_TIER_ORDER } from '../plan-tier-order';
import type { PlanTier } from '../plans';

describe('planTierRank', () => {
  it('returns sequential ranks starting at 0 for known tiers', () => {
    expect(planTierRank('FREE')).toBe(0);
    expect(planTierRank('STARTER')).toBe(1);
    expect(planTierRank('PROFESSIONAL')).toBe(2);
    expect(planTierRank('ENTERPRISE')).toBe(3);
  });

  it('ranks tiers in ascending order', () => {
    expect(planTierRank('FREE')).toBeLessThan(planTierRank('STARTER'));
    expect(planTierRank('STARTER')).toBeLessThan(planTierRank('PROFESSIONAL'));
    expect(planTierRank('PROFESSIONAL')).toBeLessThan(planTierRank('ENTERPRISE'));
  });

  it('returns 0 for unknown tiers', () => {
    // @ts-expect-error - testing invalid input
    expect(planTierRank('INVALID_TIER')).toBe(0);
  });
});

describe('planMeetsMinimum', () => {
  it.each([
    // [actual, minimum, expected]
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
  ] as Array<[PlanTier, PlanTier, boolean]>)(
    'returns %3$s when actual=%1$s and minimum=%2$s',
    (actual, minimum, expected) => {
      expect(planMeetsMinimum(actual, minimum)).toBe(expected);
    }
  );
});
