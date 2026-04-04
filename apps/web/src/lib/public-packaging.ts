import { PLANS, type PlanTier } from '@aros/config';

const PUBLIC_PLAN_ORDER: PlanTier[] = ['FREE', 'STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

export type PublicPlanCard = {
  tier: PlanTier;
  name: string;
  priceMonthly: number;
  highlighted: boolean;
  bullets: string[];
};

export function getPublicPlanCards(): PublicPlanCard[] {
  return PUBLIC_PLAN_ORDER.map((tier) => {
    const plan = PLANS[tier];
    const aiLine = plan.aiEnabled
      ? `Bounded AI draft assist: ${plan.aiTokenLimit.toLocaleString()} tokens/mo (review required)`
      : 'No AI draft assist on this tier';

    return {
      tier,
      name: plan.name,
      priceMonthly: plan.priceMonthly,
      highlighted: tier === 'PROFESSIONAL',
      bullets: [
        `${plan.maxDomains} ${plan.maxDomains === 1 ? 'site' : 'sites'}`,
        `${plan.maxPagesPerCrawl.toLocaleString()} pages per crawl`,
        `${plan.maxScansPerMonth.toLocaleString()} scans per month`,
        `${plan.maxSeats} ${plan.maxSeats === 1 ? 'seat' : 'seats'}`,
        aiLine,
        ...plan.features,
      ],
    };
  });
}
