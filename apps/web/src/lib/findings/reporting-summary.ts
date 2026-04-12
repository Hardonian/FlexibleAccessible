import type { PrismaClient } from '@aros/db';

const orgFindingWhere = (organizationId: string) => ({
  occurrences: {
    some: { page: { site: { workspace: { organizationId } } } },
  },
});

export type FindingsOperationalSummary = {
  generatedAt: string;
  totals: {
    findings: number;
    open: number;
    acknowledged: number;
    inProgress: number;
    resolved: number;
    mitigated: number;
    falsePositive: number;
    wontFix: number;
    criticalOpen: number;
    seriousOpen: number;
  };
  severityCounts: { critical: number; serious: number; moderate: number; minor: number };
  evidenceSourceMix: { automatedAxe: number; manualReview: number; imported: number };
  recurrence: {
    recurringAcrossScanRuns: number;
    regressedOpenFindings: number;
    improvedOpenBacklog: number;
    topRecurringRuleHotspots: Array<{
      ruleId: string;
      recurringFindings: number;
      criticalOpenFindings: number;
    }>;
  };
  reviewQueue: {
    unresolved: number;
    overdue72h: number;
    manualAuditPending: number;
  };
  staleAutomationCount: number;
  automationFreshnessNote: string;
};

export async function buildFindingsOperationalSummary(
  prisma: PrismaClient,
  organizationId: string,
  jobPipelinesHealthy: boolean
): Promise<FindingsOperationalSummary> {
  const base = orgFindingWhere(organizationId);

  const [
    totalFindings,
    open,
    acknowledged,
    inProgress,
    resolved,
    mitigated,
    falsePositive,
    wontFix,
    criticalOpen,
    seriousOpen,
    criticalAll,
    seriousAll,
    moderateAll,
    minorAll,
    automatedAxe,
    manualReview,
    imported,
    latestScan,
    recurringAcrossScanRuns,
    regressedOpenFindings,
    improvedOpenBacklog,
    recurringHotspotsRaw,
    unresolvedReviewTasks,
    overdueReviewTasks,
    manualAuditPendingTasks,
  ] = await Promise.all([
    prisma.canonicalFinding.count({ where: base }),
    prisma.canonicalFinding.count({ where: { ...base, status: 'OPEN' } }),
    prisma.canonicalFinding.count({ where: { ...base, status: 'ACKNOWLEDGED' } }),
    prisma.canonicalFinding.count({ where: { ...base, status: 'IN_PROGRESS' } }),
    prisma.canonicalFinding.count({ where: { ...base, status: 'RESOLVED' } }),
    prisma.canonicalFinding.count({ where: { ...base, status: 'MITIGATED' } }),
    prisma.canonicalFinding.count({ where: { ...base, status: 'FALSE_POSITIVE' } }),
    prisma.canonicalFinding.count({ where: { ...base, status: 'WONT_FIX' } }),
    prisma.canonicalFinding.count({
      where: { ...base, status: 'OPEN', impact: 'CRITICAL' },
    }),
    prisma.canonicalFinding.count({
      where: { ...base, status: 'OPEN', impact: 'SERIOUS' },
    }),
    prisma.canonicalFinding.count({ where: { ...base, impact: 'CRITICAL' } }),
    prisma.canonicalFinding.count({ where: { ...base, impact: 'SERIOUS' } }),
    prisma.canonicalFinding.count({ where: { ...base, impact: 'MODERATE' } }),
    prisma.canonicalFinding.count({ where: { ...base, impact: 'MINOR' } }),
    prisma.canonicalFinding.count({ where: { ...base, evidenceSource: 'AUTOMATED_AXE' } }),
    prisma.canonicalFinding.count({ where: { ...base, evidenceSource: 'MANUAL_REVIEW' } }),
    prisma.canonicalFinding.count({ where: { ...base, evidenceSource: 'IMPORTED' } }),
    prisma.scanRun.findFirst({
      where: {
        status: 'COMPLETED',
        completedAt: { not: null },
        site: { workspace: { organizationId } },
      },
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
    }),
    prisma.canonicalFinding.count({
      where: { ...base, distinctScanRunsObserved: { gt: 1 } },
    }),
    prisma.canonicalFinding.count({
      where: {
        ...base,
        reopenedCount: { gt: 0 },
        status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
      },
    }),
    prisma.canonicalFinding.count({
      where: {
        ...base,
        distinctScanRunsAbsentWhenOpen: { gt: 0 },
        status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] },
      },
    }),
    prisma.canonicalFinding.groupBy({
      by: ['ruleId'],
      where: {
        ...base,
        distinctScanRunsObserved: { gt: 1 },
      },
      _count: { _all: true },
      orderBy: {
        _count: { ruleId: 'desc' },
      },
      take: 5,
    }),
    prisma.reviewTask.count({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        suggestion: {
          OR: [
            {
              finding: {
                site: { workspace: { organizationId } },
              },
            },
            {
              cluster: {
                site: { workspace: { organizationId } },
              },
            },
          ],
        },
      },
    }),
    prisma.reviewTask.count({
      where: {
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        createdAt: { lt: new Date(Date.now() - 72 * 3_600_000) },
        suggestion: {
          OR: [
            {
              finding: {
                site: { workspace: { organizationId } },
              },
            },
            {
              cluster: {
                site: { workspace: { organizationId } },
              },
            },
          ],
        },
      },
    }),
    prisma.reviewTask.count({
      where: {
        type: 'MANUAL_AUDIT',
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        suggestion: {
          OR: [
            {
              finding: {
                site: { workspace: { organizationId } },
              },
            },
            {
              cluster: {
                site: { workspace: { organizationId } },
              },
            },
          ],
        },
      },
    }),
  ]);

  const criticalOpenByRule = await prisma.canonicalFinding.groupBy({
    by: ['ruleId'],
    where: {
      ...base,
      impact: 'CRITICAL',
      status: 'OPEN',
      ruleId: { in: recurringHotspotsRaw.map((row) => row.ruleId) },
    },
    _count: { _all: true },
  });
  const criticalOpenByRuleMap = new Map(
    criticalOpenByRule.map((row) => [row.ruleId, row._count._all]),
  );

  let staleAutomationCount = 0;
  if (latestScan?.completedAt && jobPipelinesHealthy) {
    staleAutomationCount = await prisma.canonicalFinding.count({
      where: {
        ...base,
        evidenceSource: 'AUTOMATED_AXE',
        OR: [{ lastVerifiedAt: null }, { lastVerifiedAt: { lt: latestScan.completedAt } }],
      },
    });
  } else if (!jobPipelinesHealthy) {
    staleAutomationCount = await prisma.canonicalFinding.count({
      where: { ...base, evidenceSource: 'AUTOMATED_AXE' },
    });
  }

  const automationFreshnessNote = !jobPipelinesHealthy
    ? 'Job pipelines are degraded; automated evidence may be stale until workers and queues are healthy.'
    : !latestScan?.completedAt
      ? 'No completed scan run found for this organization; automated verification timestamps may be missing.'
      : staleAutomationCount > 0
        ? `${staleAutomationCount} finding(s) have not been re-verified by the latest completed scan.`
        : 'Automated findings are at least as fresh as the latest completed scan, where lastVerifiedAt is set.';

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      findings: totalFindings,
      open,
      acknowledged,
      inProgress,
      resolved,
      mitigated,
      falsePositive,
      wontFix,
      criticalOpen,
      seriousOpen,
    },
    severityCounts: {
      critical: criticalAll,
      serious: seriousAll,
      moderate: moderateAll,
      minor: minorAll,
    },
    evidenceSourceMix: { automatedAxe, manualReview, imported },
    recurrence: {
      recurringAcrossScanRuns,
      regressedOpenFindings,
      improvedOpenBacklog,
      topRecurringRuleHotspots: recurringHotspotsRaw.map((row) => ({
        ruleId: row.ruleId,
        recurringFindings: row._count._all,
        criticalOpenFindings: criticalOpenByRuleMap.get(row.ruleId) ?? 0,
      })),
    },
    reviewQueue: {
      unresolved: unresolvedReviewTasks,
      overdue72h: overdueReviewTasks,
      manualAuditPending: manualAuditPendingTasks,
    },
    staleAutomationCount,
    automationFreshnessNote,
  };
}
