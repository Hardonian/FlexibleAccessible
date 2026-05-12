import { describe, expect, it } from 'vitest';
import { planMeetsMinimum, planTierRank, PLAN_TIER_ORDER } from '../plan-tier-order';
import type { PlanTier } from '../plans';

describe('planTierRank', () => {
  it('ranks tiers in ascending order', () => {
    expect(planTierRank('FREE')).toBe(0);
    expect(planTierRank('STARTER')).toBe(1);
    expect(planTierRank('PROFESSIONAL')).toBe(2);
    expect(planTierRank('ENTERPRISE')).toBe(3);

    expect(planTierRank('FREE')).toBeLessThan(planTierRank('STARTER'));
    expect(planTierRank('STARTER')).toBeLessThan(planTierRank('PROFESSIONAL'));
    expect(planTierRank('PROFESSIONAL')).toBeLessThan(planTierRank('ENTERPRISE'));
  });

  it('returns 0 (equivalent to FREE) for unknown tiers', () => {
    expect(planTierRank('UNKNOWN_TIER' as PlanTier)).toBe(0);
    expect(planTierRank(undefined as unknown as PlanTier)).toBe(0);
    expect(planTierRank(null as unknown as PlanTier)).toBe(0);
  });
});

describe('planMeetsMinimum', () => {
  it('returns true when actual and minimum are the same tier', () => {
    for (const tier of PLAN_TIER_ORDER) {
      expect(planMeetsMinimum(tier, tier)).toBe(true);
    }
  });

  it('returns true when actual tier is higher than minimum tier', () => {
    expect(planMeetsMinimum('STARTER', 'FREE')).toBe(true);
    expect(planMeetsMinimum('PROFESSIONAL', 'FREE')).toBe(true);
    expect(planMeetsMinimum('ENTERPRISE', 'FREE')).toBe(true);

    expect(planMeetsMinimum('PROFESSIONAL', 'STARTER')).toBe(true);
    expect(planMeetsMinimum('ENTERPRISE', 'STARTER')).toBe(true);

    expect(planMeetsMinimum('ENTERPRISE', 'PROFESSIONAL')).toBe(true);
  });

  it('returns false when actual tier is lower than minimum tier', () => {
    expect(planMeetsMinimum('FREE', 'STARTER')).toBe(false);
    expect(planMeetsMinimum('FREE', 'PROFESSIONAL')).toBe(false);
    expect(planMeetsMinimum('FREE', 'ENTERPRISE')).toBe(false);

    expect(planMeetsMinimum('STARTER', 'PROFESSIONAL')).toBe(false);
    expect(planMeetsMinimum('STARTER', 'ENTERPRISE')).toBe(false);

    expect(planMeetsMinimum('PROFESSIONAL', 'ENTERPRISE')).toBe(false);
  });

  it('handles invalid actual tiers by treating them as FREE', () => {
    expect(planMeetsMinimum('INVALID_TIER' as PlanTier, 'FREE')).toBe(true); // FREE >= FREE
    expect(planMeetsMinimum('INVALID_TIER' as PlanTier, 'STARTER')).toBe(false); // FREE < STARTER
  });

  it('handles invalid minimum tiers by treating them as FREE', () => {
    expect(planMeetsMinimum('FREE', 'INVALID_TIER' as PlanTier)).toBe(true); // FREE >= FREE
    expect(planMeetsMinimum('STARTER', 'INVALID_TIER' as PlanTier)).toBe(true); // STARTER >= FREE
  });
});
