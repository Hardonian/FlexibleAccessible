import type { SubscriptionStatus } from "@aros/db";

export interface StaleSite {
  id: string;
  name: string;
  domain: string;
  lastScanAt: Date | null;
  daysStale: number;
  openFindings: number;
  criticalFindings: number;
}

export interface OrgWithSubscription {
  id: string;
  name: string;
  slug: string;
  siteCount: number;
  subscription: {
    status: SubscriptionStatus;
    plan: string;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
  } | null;
  daysToRenewal: number | null;
  usagePercent: number;
}

export interface FailedRun {
  id: string;
  type: "crawl" | "scan";
  siteId: string;
  siteName: string;
  siteDomain: string;
  errorMessage: string | null;
  failedAt: Date;
}

export interface AgedFinding {
  id: string;
  ruleId: string;
  impact: string;
  description: string;
  siteId: string;
  siteName: string;
  siteDomain: string;
  daysOpen: number;
  occurrenceCount: number;
  /** Distinct completed scan runs where this fingerprint was re-detected. */
  distinctScanRunsObserved: number;
}

export interface HighImpactCluster {
  id: string;
  name: string;
  siteId: string;
  siteName: string;
  siteDomain: string;
  severity: string;
  impactScore: number;
  findingCount: number;
  pageCount: number;
}

export interface WorkQueueItem {
  id: string;
  type: "onboarding" | "attention" | "churn-risk";
  priority: "high" | "medium" | "low";
  title: string;
  description: string;
  orgId: string;
  orgName: string;
  entityId?: string;
  entityName?: string;
  createdAt: Date;
  actionLabel: string;
  actionHref: string;
}

export interface AccountHealthRollup {
  staleSites: StaleSite[];
  staleSitesCount: number;
  criticalFindingsCount: number;
  criticalFindings: AgedFinding[];
  subsNearRenewal: OrgWithSubscription[];
  subsNearRenewalCount: number;
  failedRuns: FailedRun[];
  failedRunsCount: number;
}

export interface CustomerWorkQueue {
  items: WorkQueueItem[];
  highPriorityCount: number;
  mediumPriorityCount: number;
  onboardingCount: number;
}

export interface RenewalWatchlist {
  pastDue: OrgWithSubscription[];
  failedPayment: OrgWithSubscription[];
  approachingLimits: OrgWithSubscription[];
  totalAtRisk: number;
}

export interface ExceptionRouting {
  criticalAgedFindings: AgedFinding[];
  highImpactClusters: HighImpactCluster[];
  totalExceptions: number;
}

export interface OperatorHealthPayload {
  accountHealth: AccountHealthRollup;
  workQueue: CustomerWorkQueue;
  renewalWatchlist: RenewalWatchlist;
  exceptionRouting: ExceptionRouting;
  generatedAt: Date;
}
