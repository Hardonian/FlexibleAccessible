import { describe, expect, it } from 'vitest';
import { planMeetsMinimum, planTierRank } from '../plan-tier-order';

describe('planMeetsMinimum', () => {
  it('ranks tiers in ascending order', () => {
    expect(planTierRank('FREE')).toBeLessThan(planTierRank('STARTER'));
    expect(planTierRank('STARTER')).toBeLessThan(planTierRank('PROFESSIONAL'));
    expect(planTierRank('PROFESSIONAL')).toBeLessThan(planTierRank('ENTERPRISE'));
  });

  it('requires same or higher tier', () => {
    expect(planMeetsMinimum('PROFESSIONAL', 'PROFESSIONAL')).toBe(true);
    expect(planMeetsMinimum('ENTERPRISE', 'PROFESSIONAL')).toBe(true);
    expect(planMeetsMinimum('STARTER', 'PROFESSIONAL')).toBe(false);
  });
});
