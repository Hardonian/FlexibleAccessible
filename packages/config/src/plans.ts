export type PlanTier = "FREE" | "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

export interface PlanConfig {
  name: string;
  tier: PlanTier;
  maxDomains: number;
  maxPagesPerCrawl: number;
  maxScansPerMonth: number;
  maxSeats: number;
  features: string[];
  priceMonthly: number;
  aiEnabled: boolean;
  aiTokenLimit: number;
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  FREE: {
    name: "Free",
    tier: "FREE",
    maxDomains: 1,
    maxPagesPerCrawl: 50,
    maxScansPerMonth: 3,
    maxSeats: 1,
    features: [
      "Public instant scan from the homepage (bounded, with caveats)",
      "Account + org shell; upgrade unlocks private workspace",
      "Paid tiers: scans, findings, exports, API, and automation",
    ],
    priceMonthly: 0,
    aiEnabled: false,
    aiTokenLimit: 0,
  },
  STARTER: {
    name: "Starter",
    tier: "STARTER",
    maxDomains: 3,
    maxPagesPerCrawl: 200,
    maxScansPerMonth: 10,
    maxSeats: 3,
    features: [
      "Full private scanning & crawl history",
      "Issue clustering (fix once, clear many pages)",
      "GitHub PR workflow for proposed fixes",
    ],
    priceMonthly: 49,
    aiEnabled: false,
    aiTokenLimit: 0,
  },
  PROFESSIONAL: {
    name: "Professional",
    tier: "PROFESSIONAL",
    maxDomains: 10,
    maxPagesPerCrawl: 1000,
    maxScansPerMonth: 50,
    maxSeats: 10,
    features: [
      "Scheduled / recurring scans",
      "Human review queues + sign-off trails",
      "Evidence-grade exports (VPAT-ready artifacts)",
      "Jira + webhook automation",
      "Bounded AI assist for draft fixes (review required)",
    ],
    priceMonthly: 149,
    aiEnabled: true,
    aiTokenLimit: 100000,
  },
  ENTERPRISE: {
    name: "Enterprise",
    tier: "ENTERPRISE",
    maxDomains: 100,
    maxPagesPerCrawl: 10000,
    maxScansPerMonth: 500,
    maxSeats: 100,
    features: [
      "Higher limits + procurement-friendly terms",
      "Custom integrations & migration support",
      "Managed accessibility operations (optional)",
      "Response-time and onboarding commitments only where agreed in writing",
    ],
    priceMonthly: 499,
    aiEnabled: true,
    aiTokenLimit: 1000000,
  },
};
