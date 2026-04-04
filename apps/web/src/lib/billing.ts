import { PLANS } from '@aros/config';
import type { PlanTier } from '@aros/db';
import type { OrgSubscriptionSnapshot } from './auth-guard';

export { getAppBaseUrl } from './site-url';

export const PAID_PLAN_TIERS: PlanTier[] = [
  'STARTER',
  'PROFESSIONAL',
  'ENTERPRISE',
];

export const BILLING_PLAN_ORDER: PlanTier[] = [
  'FREE',
  'STARTER',
  'PROFESSIONAL',
  'ENTERPRISE',
];

export function getBillingPlanCards() {
  return BILLING_PLAN_ORDER.map((tier) => ({
    ...PLANS[tier],
    isPaid: tier !== 'FREE',
  }));
}

export function isStripeBillingConfigured(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_PRICE_STARTER &&
      process.env.STRIPE_PRICE_PROFESSIONAL &&
      process.env.STRIPE_PRICE_ENTERPRISE,
  );
}

export function getStripePriceIdForPlan(plan: Exclude<PlanTier, 'FREE'>): string | null {
  switch (plan) {
    case 'STARTER':
      return process.env.STRIPE_PRICE_STARTER ?? null;
    case 'PROFESSIONAL':
      return process.env.STRIPE_PRICE_PROFESSIONAL ?? null;
    case 'ENTERPRISE':
      return process.env.STRIPE_PRICE_ENTERPRISE ?? null;
    default:
      return null;
  }
}

export function currentPaidPlanTier(
  subscription: OrgSubscriptionSnapshot | null | undefined,
): Exclude<PlanTier, 'FREE'> | null {
  if (!subscription || subscription.plan === 'FREE') {
    return null;
  }

  return subscription.plan;
}
