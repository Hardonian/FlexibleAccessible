import type { PlanTier } from './plans';

/** Lowest → highest; used for minimum-plan enforcement (self-serve). */
export const PLAN_TIER_ORDER: PlanTier[] = [
  'FREE',
  'STARTER',
  'PROFESSIONAL',
  'ENTERPRISE',
];

export function planTierRank(tier: PlanTier): number {
  const i = PLAN_TIER_ORDER.indexOf(tier);
  return i >= 0 ? i : 0;
}

/** True when `actual` is the same tier or higher than `minimum` on the self-serve ladder. */
export function planMeetsMinimum(actual: PlanTier, minimum: PlanTier): boolean {
  return planTierRank(actual) >= planTierRank(minimum);
}
