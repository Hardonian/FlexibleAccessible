import { prisma } from "@/lib/db";
import type {
  AgedFinding,
  CustomerWorkQueue,
  ExceptionRouting,
  FailedRun,
  HighImpactCluster,
  OperatorHealthPayload,
  OrgWithSubscription,
  RenewalWatchlist,
  StaleSite,
  WorkQueueItem,
} from "@/lib/operator-console-types";

const DAYS_30_MS = 30 * 24 * 60 * 60 * 1000;
const DAYS_90_MS = 90 * 24 * 60 * 60 * 1000;
const DAYS_7_MS = 7 * 24 * 60 * 60 * 1000;

export async function fetchOperatorHealthPayload(
  organizationId: string,
): Promise<OperatorHealthPayload> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - DAYS_30_MS);
  const ninetyDaysAgo = new Date(now.getTime() - DAYS_90_MS);
  const sevenDaysAgo = new Date(now.getTime() - DAYS_7_MS);

  const [
    staleSitesData,
    criticalFindingsData,
    subsData,
    failedRunsData,
    clustersData,
  ] = await Promise.all([
    prisma.site.findMany({
      where: {
        workspace: { organizationId },
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

    prisma.canonicalFinding.findMany({
      where: {
        site: { workspace: { organizationId } },
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

    prisma.organization.findUnique({
      where: { id: organizationId },
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

    prisma.$transaction([
      prisma.crawlRun.findMany({
        where: {
          site: { workspace: { organizationId } },
          status: "FAILED",
          createdAt: { gte: sevenDaysAgo },
        },
        include: { site: { select: { id: true, name: true, domain: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.scanRun.findMany({
        where: {
          site: { workspace: { organizationId } },
          status: "FAILED",
          createdAt: { gte: sevenDaysAgo },
        },
        include: { site: { select: { id: true, name: true, domain: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]),

    prisma.issueCluster.findMany({
      where: {
        site: { workspace: { organizationId } },
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

  const workQueueItems: WorkQueueItem[] = [];

  const newSites = await prisma.site.findMany({
    where: {
      workspace: { organizationId },
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

  for (const site of staleSites.filter((s) => s.openFindings > 10)) {
    workQueueItems.push({
      id: `attention-${site.id}`,
      type: "attention",
      priority: site.criticalFindings > 0 ? "high" : "medium",
      title: `Site needs attention: ${site.name}`,
      description: `${site.openFindings} open findings (${site.criticalFindings} critical), ${site.daysStale} days since last scan.`,
      orgId: organizationId,
      orgName: org?.name ?? "",
      entityId: site.id,
      entityName: site.name,
      createdAt: now,
      actionLabel: "Review",
      actionHref: `/sites/${site.id}/findings`,
    });
  }

  const orgsWithNoSites = await prisma.organization.findMany({
    where: {
      id: organizationId,
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

  const priorityOrder = { high: 0, medium: 1, low: 2 };
  workQueueItems.sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority],
  );

  const renewalWatchlist: RenewalWatchlist = {
    pastDue,
    failedPayment: pastDue.filter((o) => o.subscription?.status === "PAST_DUE"),
    approachingLimits,
    totalAtRisk: pastDue.length + approachingLimits.length,
  };

  const exceptionRouting: ExceptionRouting = {
    criticalAgedFindings: criticalFindings.filter((f) => f.daysOpen > 30),
    highImpactClusters,
    totalExceptions:
      criticalFindings.filter((f) => f.daysOpen > 30).length +
      highImpactClusters.length,
  };

  const workQueue: CustomerWorkQueue = {
    items: workQueueItems.slice(0, 50),
    highPriorityCount: workQueueItems.filter((i) => i.priority === "high").length,
    mediumPriorityCount: workQueueItems.filter((i) => i.priority === "medium")
      .length,
    onboardingCount: workQueueItems.filter((i) => i.type === "onboarding").length,
  };

  const accountHealth = {
    staleSites,
    staleSitesCount: staleSites.length,
    criticalFindingsCount: criticalFindings.length,
    criticalFindings,
    subsNearRenewal,
    subsNearRenewalCount: subsNearRenewal.length,
    failedRuns: failedRuns.slice(0, 20),
    failedRunsCount: failedRuns.length,
  };

  return {
    accountHealth,
    workQueue,
    renewalWatchlist,
    exceptionRouting,
    generatedAt: now,
  };
}

export async function createOperatorDismissAudit(input: {
  organizationId: string;
  userId: string;
  itemId: string;
}) {
  return prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      action: "operator.dismiss_work_item",
      entityType: "WorkQueueItem",
      entityId: input.itemId,
    },
  });
}
