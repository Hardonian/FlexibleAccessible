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
  ]);

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
    staleAutomationCount,
    automationFreshnessNote,
  };
}
