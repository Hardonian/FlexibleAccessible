import { prisma } from "@aros/db";
import { RULE_METADATA } from "@aros/scan-engine";

export interface ClusterImpactResult {
  clusterId: string;
  impactScore: number;
  estimatedTraffic: bigint;
  pagesAffected: number;
  severityWeight: number;
  paretoRank: number;
  issuePercentage: number;
  estimatedHours: number;
  estimatedCost: number;
}

const SEVERITY_WEIGHTS: Record<string, number> = {
  CRITICAL: 10,
  SERIOUS: 5,
  MODERATE: 2,
  MINOR: 0.5,
};

const AVG_DEV_HOURLY_RATE = 75; // USD

const FIX_COMPLEXITY_HOURS: Record<string, number> = {
  ALT_TEXT: 0.1,
  BUTTON_LABEL: 0.15,
  LINK_TEXT: 0.1,
  FORM_LABEL: 0.25,
  HEADING_FIX: 0.1,
  SEMANTIC_HTML: 0.5,
  ARIA_CLEANUP: 0.3,
  COLOR_CONTRAST: 1.0,
  CUSTOM_SNIPPET: 0.5,
};

/**
 * Computes impact scores for all clusters in a site.
 * Called after clustering completes.
 */
export async function computeClusterImpacts(
  siteId: string,
): Promise<ClusterImpactResult[]> {
  const clusters = await prisma.issueCluster.findMany({
    where: { siteId },
    include: {
      findings: {
        select: {
          id: true,
          impact: true,
          occurrenceCount: true,
          ruleId: true,
        },
      },
    },
  });

  if (clusters.length === 0) return [];

  // Get total findings across site for percentage calculation
  const totalFindings = await prisma.canonicalFinding.count({
    where: { siteId },
  });

  // Get total pages for traffic estimation
  const totalPages = await prisma.page.count({
    where: { siteId },
  });

  // Estimate traffic per page (evenly distributed for v1)
  const estimatedSiteTraffic = BigInt(totalPages) * BigInt(1000); // 1K impressions per page estimate

  const results: ClusterImpactResult[] = clusters.map((cluster) => {
    const maxImpact = cluster.findings.reduce((max, f) => {
      const weight = SEVERITY_WEIGHTS[f.impact] ?? 1;
      return weight > max ? weight : max;
    }, 0);

    const totalOccurrences = cluster.findings.reduce(
      (sum, f) => sum + f.occurrenceCount,
      0,
    );

    const pagesAffected = cluster.pageCount;

    // Impact = severity_weight × log(occurrences) × log(pages_affected + 1)
    const impactScore =
      maxImpact *
      Math.log2(totalOccurrences + 1) *
      Math.log2(pagesAffected + 1);

    // Estimate hours based on finding types
    const avgHours =
      cluster.findings.reduce((sum, f) => {
        const ruleMeta = RULE_METADATA[f.ruleId];
        const fixType = ruleMeta?.suggestionType ?? "CUSTOM_SNIPPET";
        return sum + (FIX_COMPLEXITY_HOURS[fixType] ?? 0.5);
      }, 0) / Math.max(cluster.findings.length, 1);

    const estimatedHours = avgHours * cluster.findingCount;
    const estimatedCost = estimatedHours * AVG_DEV_HOURLY_RATE;

    const issuePercentage =
      totalFindings > 0 ? (cluster.findingCount / totalFindings) * 100 : 0;

    // Traffic estimate proportional to pages affected
    const trafficShare = totalPages > 0 ? pagesAffected / totalPages : 0;
    const estimatedTraffic = BigInt(
      Math.round(Number(estimatedSiteTraffic) * trafficShare),
    );

    return {
      clusterId: cluster.id,
      impactScore,
      estimatedTraffic,
      pagesAffected,
      severityWeight: maxImpact,
      paretoRank: 0, // Set after sorting
      issuePercentage,
      estimatedHours,
      estimatedCost,
    };
  });

  // Sort by impact descending and assign Pareto ranks
  results.sort((a, b) => b.impactScore - a.impactScore);
  results.forEach((r, i) => {
    r.paretoRank = i + 1;
  });

  // Persist to DB
  await prisma.$transaction(
    results.map((r) =>
      prisma.clusterImpact.upsert({
        where: { clusterId: r.clusterId },
        create: {
          clusterId: r.clusterId,
          impactScore: r.impactScore,
          estimatedTraffic: r.estimatedTraffic,
          pagesAffected: r.pagesAffected,
          severityWeight: r.severityWeight,
          paretoRank: r.paretoRank,
          issuePercentage: r.issuePercentage,
          estimatedHours: r.estimatedHours,
          estimatedCost: r.estimatedCost,
        },
        update: {
          impactScore: r.impactScore,
          estimatedTraffic: r.estimatedTraffic,
          pagesAffected: r.pagesAffected,
          severityWeight: r.severityWeight,
          paretoRank: r.paretoRank,
          issuePercentage: r.issuePercentage,
          estimatedHours: r.estimatedHours,
          estimatedCost: r.estimatedCost,
          computedAt: new Date(),
        },
      }),
    ),
  );

  // Update cached impactScore on IssueCluster for sorting
  await prisma.$transaction(
    results.map((r) =>
      prisma.issueCluster.update({
        where: { id: r.clusterId },
        data: { impactScore: r.impactScore },
      }),
    ),
  );

  return results;
}

/**
 * Get Pareto analysis: the top N% of clusters that account for ~80% of impact.
 */
export async function getParetoAnalysis(siteId: string) {
  const impacts = await prisma.clusterImpact.findMany({
    where: { cluster: { siteId } },
    orderBy: { impactScore: "desc" },
    include: {
      cluster: {
        select: {
          id: true,
          name: true,
          severity: true,
          findingCount: true,
          pageCount: true,
        },
      },
    },
  });

  if (impacts.length === 0)
    return { clusters: [], totalImpact: 0, paretoCut: 0 };

  const totalImpact = impacts.reduce((sum, i) => sum + i.impactScore, 0);
  let cumulative = 0;
  let paretoCut = 0;

  const clusters = impacts.map((impact, index) => {
    cumulative += impact.impactScore;
    const cumulativePct = (cumulative / totalImpact) * 100;

    if (cumulativePct >= 80 && paretoCut === 0) {
      paretoCut = index + 1;
    }

    return {
      ...impact.cluster,
      impactScore: impact.impactScore,
      paretoRank: impact.paretoRank,
      issuePercentage: impact.issuePercentage,
      estimatedHours: impact.estimatedHours,
      estimatedCost: impact.estimatedCost,
      estimatedTraffic: impact.estimatedTraffic.toString(),
      cumulativePercentage: cumulativePct,
    };
  });

  return { clusters, totalImpact, paretoCut };
}
