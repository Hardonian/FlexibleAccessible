export interface PlanConfig {
  name: string;
  tier: 'FREE' | 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE';
  maxDomains: number;
  maxPagesPerCrawl: number;
  maxScansPerMonth: number;
  maxSeats: number;
  features: string[];
  priceMonthly: number;
}

export const PLANS: Record<string, PlanConfig> = {
  FREE: {
    name: 'Free',
    tier: 'FREE',
    maxDomains: 1,
    maxPagesPerCrawl: 50,
    maxScansPerMonth: 3,
    maxSeats: 1,
    features: ['Basic scanning', 'Findings dashboard', 'CSV export'],
    priceMonthly: 0,
  },
  STARTER: {
    name: 'Starter',
    tier: 'STARTER',
    maxDomains: 3,
    maxPagesPerCrawl: 200,
    maxScansPerMonth: 10,
    maxSeats: 3,
    features: [
      'Everything in Free',
      'Component clustering',
      'AI remediation suggestions',
      'GitHub integration',
    ],
    priceMonthly: 49,
  },
  PROFESSIONAL: {
    name: 'Professional',
    tier: 'PROFESSIONAL',
    maxDomains: 10,
    maxPagesPerCrawl: 1000,
    maxScansPerMonth: 50,
    maxSeats: 10,
    features: [
      'Everything in Starter',
      'Scheduled scans',
      'Review workflows',
      'Evidence reports',
      'Jira integration',
      'Priority support',
    ],
    priceMonthly: 149,
  },
  ENTERPRISE: {
    name: 'Enterprise',
    tier: 'ENTERPRISE',
    maxDomains: 100,
    maxPagesPerCrawl: 10000,
    maxScansPerMonth: 500,
    maxSeats: 100,
    features: [
      'Everything in Professional',
      'Unlimited scans',
      'Custom integrations',
      'SSO',
      'Dedicated support',
      'SLA',
    ],
    priceMonthly: 499,
  },
};
