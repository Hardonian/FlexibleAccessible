"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import type { MemberRole, SubscriptionStatus } from "@aros/db";
import { ApiError } from "@aros/shared";
import { resolveOperatorScopedMembership } from "@/lib/operator-org-resolution";

const ACTIVE_ORG_COOKIE = "aros_active_org";

const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;
const DAYS_90_MS = 90 * 24 * 60 * 60 * 1000;
const DAYS_7_MS = 7 * 24 * 60 * 60 * 1000;

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

async function requireOperatorAccess(): Promise<{
  user: { id: string; email: string; name: string | null };
  organizationId: string;
  role: MemberRole;
}> {
  const user = await requireSession();

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    select: { organizationId: true, role: true, createdAt: true },
  });

  if (memberships.length === 0) {
    throw ApiError.forbidden("No organization membership found");
  }

  const cookieStore = await cookies();
  const preferredOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  const resolved = resolveOperatorScopedMembership(
    memberships.map((m) => ({
      organizationId: m.organizationId,
      role: m.role,
      createdAt: m.createdAt,
    })),
    preferredOrgId ?? undefined,
    "org:system:view",
  );

  if (!resolved) {
    throw ApiError.forbidden("Missing permission: org:system:view");
  }

  return {
    user,
    organizationId: resolved.organizationId,
    role: resolved.role,
  };
}

export async function getOperatorHealthData(): Promise<OperatorHealthPayload> {
  const ctx = await requireOperatorAccess();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - DAYS_30_MS);
  const ninetyDaysAgo = new Date(now.getTime() - DAYS_90_MS);
  const sevenDaysAgo = new Date(now.getTime() - DAYS_7_MS);
  const thirtyDaysFromNow = new Date(now.getTime() + DAYS_30_MS);

  const [
    staleSitesData,
    criticalFindingsData,
    subsData,
    failedRunsData,
    clustersData,
  ] = await Promise.all([
    // Stale sites (no scan in 30+ days)
    prisma.site.findMany({
      where: {
        workspace: { organizationId: ctx.organizationId },
        OR: [
          { scanRuns: { none: {} } },
          {
            scanRuns: {
              every: { completedAt: { lt: thirtyDaysAgo } },
            },
          },
        ],
      },
      include: {
        workspace: { select: { organizationId: true } },
        scanRuns: { orderBy: { completedAt: "desc" }, take: 1 },
        canonicalFindings: {
          where: { status: "OPEN" },
          select: { id: true, impact: true },
        },
      },
    }),

    // Critical findings open > 90 days
    prisma.canonicalFinding.findMany({
      where: {
        site: { workspace: { organizationId: ctx.organizationId } },
        status: "OPEN",
        impact: "CRITICAL",
        firstSeenAt: { lt: ninetyDaysAgo },
      },
      include: {
        site: { select: { id: true, name: true, domain: true } },
      },
      orderBy: [
        { distinctScanRunsObserved: "desc" },
        { reopenedCount: "desc" },
        { firstSeenAt: "asc" },
      ],
      take: 50,
    }),

    // Subscription data for renewal/expiry tracking
    prisma.organization.findUnique({
      where: { id: ctx.organizationId },
      include: {
        subscription: true,
        workspaces: {
          include: {
            _count: { select: { sites: true } },
          },
        },
        _count: { select: { memberships: true } },
      },
    }),

    // Failed runs in last 7 days
    prisma.$transaction([
      prisma.crawlRun.findMany({
        where: {
          site: { workspace: { organizationId: ctx.organizationId } },
          status: "FAILED",
          createdAt: { gte: sevenDaysAgo },
        },
        include: { site: { select: { id: true, name: true, domain: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.scanRun.findMany({
        where: {
          site: { workspace: { organizationId: ctx.organizationId } },
          status: "FAILED",
          createdAt: { gte: sevenDaysAgo },
        },
        include: { site: { select: { id: true, name: true, domain: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]),

    // High impact clusters
    prisma.issueCluster.findMany({
      where: {
        site: { workspace: { organizationId: ctx.organizationId } },
        impactScore: { gte: 50 },
      },
      include: {
        site: { select: { id: true, name: true, domain: true } },
        impact: true,
      },
      orderBy: { impactScore: "desc" },
      take: 20,
    }),
  ]);

  // Process stale sites
  const staleSites: StaleSite[] = staleSitesData.map((site) => {
    const lastScanAt = site.scanRuns[0]?.completedAt ?? null;
    const daysStale = lastScanAt
      ? Math.floor(
          (now.getTime() - lastScanAt.getTime()) / (24 * 60 * 60 * 1000),
        )
      : 999;
    const criticalFindings = site.canonicalFindings.filter(
      (f) => f.impact === "CRITICAL",
    ).length;

    return {
      id: site.id,
      name: site.name,
      domain: site.domain,
      lastScanAt,
      daysStale,
      openFindings: site.canonicalFindings.length,
      criticalFindings,
    };
  });

  // Process critical findings
  const criticalFindings: AgedFinding[] = criticalFindingsData.map((f) => ({
    id: f.id,
    ruleId: f.ruleId,
    impact: f.impact,
    description: f.description,
    siteId: f.site.id,
    siteName: f.site.name,
    siteDomain: f.site.domain,
    daysOpen: Math.floor(
      (now.getTime() - f.firstSeenAt.getTime()) / (24 * 60 * 60 * 1000),
    ),
    occurrenceCount: f.occurrenceCount,
    distinctScanRunsObserved: f.distinctScanRunsObserved,
  }));

  // Process subscriptions
  const org = subsData;
  const totalSites =
    org?.workspaces.reduce((sum, w) => sum + w._count.sites, 0) ?? 0;
  const seatCount = org?._count.memberships ?? 0;

  const subsNearRenewal: OrgWithSubscription[] = [];
  const pastDue: OrgWithSubscription[] = [];
  const approachingLimits: OrgWithSubscription[] = [];

  if (org?.subscription) {
    const sub = org.subscription;
    const daysToRenewal = sub.currentPeriodEnd
      ? Math.floor(
          (sub.currentPeriodEnd.getTime() - now.getTime()) /
            (24 * 60 * 60 * 1000),
        )
      : null;

    const orgSub: OrgWithSubscription = {
      id: org.id,
      name: org.name,
      slug: org.slug,
      siteCount: totalSites,
      subscription: {
        status: sub.status,
        plan: sub.plan,
        currentPeriodEnd: sub.currentPeriodEnd,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      },
      daysToRenewal,
      usagePercent: Math.min(
        100,
        Math.round(
          ((totalSites / Math.max(1, sub.maxDomains)) * 0.5 +
            (seatCount / Math.max(1, sub.maxSeats)) * 0.5) *
            100,
        ),
      ),
    };

    if (sub.status === "PAST_DUE") {
      pastDue.push(orgSub);
    } else if (daysToRenewal !== null && daysToRenewal <= 30) {
      subsNearRenewal.push(orgSub);
    }

    if (totalSites >= sub.maxDomains * 0.8 || seatCount >= sub.maxSeats * 0.8) {
      approachingLimits.push(orgSub);
    }
  }

  // Process failed runs
  const [failedCrawls, failedScans] = failedRunsData;
  const failedRuns: FailedRun[] = [
    ...failedCrawls.map((c) => ({
      id: c.id,
      type: "crawl" as const,
      siteId: c.site.id,
      siteName: c.site.name,
      siteDomain: c.site.domain,
      errorMessage: c.errorMessage,
      failedAt: c.createdAt,
    })),
    ...failedScans.map((s) => ({
      id: s.id,
      type: "scan" as const,
      siteId: s.site.id,
      siteName: s.site.name,
      siteDomain: s.site.domain,
      errorMessage: s.errorMessage,
      failedAt: s.createdAt,
    })),
  ].sort((a, b) => b.failedAt.getTime() - a.failedAt.getTime());

  // Process high impact clusters
  const highImpactClusters: HighImpactCluster[] = clustersData.map((c) => ({
    id: c.id,
    name: c.name,
    siteId: c.site.id,
    siteName: c.site.name,
    siteDomain: c.site.domain,
    severity: c.severity,
    impactScore: Math.round(c.impactScore),
    findingCount: c.findingCount,
    pageCount: c.pageCount,
  }));

  // Build work queue
  const workQueueItems: WorkQueueItem[] = [];

  // New sites needing onboarding (created in last 7 days)
  const newSites = await prisma.site.findMany({
    where: {
      workspace: { organizationId: ctx.organizationId },
      createdAt: { gte: sevenDaysAgo },
    },
    include: { workspace: { include: { organization: true } } },
  });

  for (const site of newSites) {
    workQueueItems.push({
      id: `onboarding-${site.id}`,
      type: "onboarding",
      priority: "medium",
      title: "New site needs onboarding",
      description: `${site.name} (${site.domain}) was added recently. Verify crawl config and run initial scan.`,
      orgId: site.workspace.organizationId,
      orgName: site.workspace.organization.name,
      entityId: site.id,
      entityName: site.name,
      createdAt: site.createdAt,
      actionLabel: "Configure",
      actionHref: `/sites/${site.id}/settings`,
    });
  }

  // Sites needing attention (stale with many findings)
  for (const site of staleSites.filter((s) => s.openFindings > 10)) {
    workQueueItems.push({
      id: `attention-${site.id}`,
      type: "attention",
      priority: site.criticalFindings > 0 ? "high" : "medium",
      title: `Site needs attention: ${site.name}`,
      description: `${site.openFindings} open findings (${site.criticalFindings} critical), ${site.daysStale} days since last scan.`,
      orgId: ctx.organizationId,
      orgName: org?.name ?? "",
      entityId: site.id,
      entityName: site.name,
      createdAt: now,
      actionLabel: "Review",
      actionHref: `/sites/${site.id}/findings`,
    });
  }

  // Orgs with no sites (churn risk)
  const orgsWithNoSites = await prisma.organization.findMany({
    where: {
      id: ctx.organizationId,
      workspaces: { every: { sites: { none: {} } } },
    },
  });

  for (const o of orgsWithNoSites) {
    workQueueItems.push({
      id: `churn-${o.id}`,
      type: "churn-risk",
      priority: "high",
      title: "No sites configured",
      description: `${o.name} has no sites set up. Reach out to help them get started.`,
      orgId: o.id,
      orgName: o.name,
      createdAt: now,
      actionLabel: "Add site",
      actionHref: "/sites/new",
    });
  }

  // Sort work queue by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  workQueueItems.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
  );

  return {
    accountHealth: {
      staleSites,
      staleSitesCount: staleSites.length,
      criticalFindingsCount: criticalFindings.length,
      criticalFindings,
      subsNearRenewal,
      subsNearRenewalCount: subsNearRenewal.length,
      failedRuns: failedRuns.slice(0, 20),
      failedRunsCount: failedRuns.length,
    },
    workQueue: {
      items: workQueueItems.slice(0, 50),
      highPriorityCount: workQueueItems.filter((i) => i.priority === "high")
        .length,
      mediumPriorityCount: workQueueItems.filter((i) => i.priority === "medium")
        .length,
      onboardingCount: workQueueItems.filter((i) => i.type === "onboarding")
        .length,
    },
    renewalWatchlist: {
      pastDue,
      failedPayment: pastDue.filter(
        (o) => o.subscription?.status === "PAST_DUE",
      ),
      approachingLimits,
      totalAtRisk: pastDue.length + approachingLimits.length,
    },
    exceptionRouting: {
      criticalAgedFindings: criticalFindings.filter((f) => f.daysOpen > 30),
      highImpactClusters,
      totalExceptions:
        criticalFindings.filter((f) => f.daysOpen > 30).length +
        highImpactClusters.length,
    },
    generatedAt: now,
  };
}

export async function dismissWorkQueueItem(itemId: string): Promise<void> {
  const ctx = await requireOperatorAccess();

  // In a real implementation, this would persist dismissed items
  // For now, we just validate access and return
  await prisma.auditLog.create({
    data: {
      organizationId: ctx.organizationId,
      userId: ctx.user.id,
      action: "operator.dismiss_work_item",
      entityType: "WorkQueueItem",
      entityId: itemId,
    },
  });
}
