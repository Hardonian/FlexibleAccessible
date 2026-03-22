import { Job } from 'bullmq';
import { prisma } from '@aros/db';
import { createDomFingerprint, selectorSimilarity, normalizeSelector } from '@aros/shared';

interface ClusterJobData {
  siteId: string;
  scanRunId: string;
}

export async function handleClusterJob(job: Job<ClusterJobData>) {
  const { siteId, scanRunId } = job.data;

  console.log(`[Cluster] Starting clustering for site ${siteId} after scan ${scanRunId}`);

  // Get all open findings for this site with their occurrences
  const findings = await prisma.canonicalFinding.findMany({
    where: {
      siteId,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
    },
    include: {
      occurrences: {
        include: { page: { select: { url: true } } },
        take: 100,
      },
    },
  });

  if (findings.length === 0) {
    console.log(`[Cluster] No findings to cluster for site ${siteId}`);
    return;
  }

  // Group findings by rule ID first
  const ruleGroups = new Map<string, typeof findings>();
  for (const finding of findings) {
    const group = ruleGroups.get(finding.ruleId) ?? [];
    group.push(finding);
    ruleGroups.set(finding.ruleId, group);
  }

  // For each rule group, cluster by structural similarity
  for (const [ruleId, ruleFindings] of ruleGroups) {
    if (ruleFindings.length < 2) continue;

    const clusters = clusterByStructure(ruleFindings);

    for (const cluster of clusters) {
      if (cluster.members.length < 2) continue;

      // Determine cluster properties
      const representative = cluster.members[0];
      const allPages = new Set<string>();
      for (const member of cluster.members) {
        for (const occ of member.occurrences) {
          allPages.add(occ.page.url);
        }
      }

      const severity = cluster.members.reduce((worst, m) => {
        const order = { CRITICAL: 0, SERIOUS: 1, MODERATE: 2, MINOR: 3 };
        return order[m.impact] < order[worst] ? m.impact : worst;
      }, 'MINOR' as 'CRITICAL' | 'SERIOUS' | 'MODERATE' | 'MINOR');

      // Build a human-readable cluster name
      const ruleDescription = representative.description;
      const clusterName = `${ruleDescription} (${allPages.size} pages)`;

      // Get representative selector pattern
      const selectors = cluster.members
        .flatMap((m) => m.occurrences.map((o) => o.selector))
        .slice(0, 5);
      const selectorPattern = findCommonPattern(selectors);

      // Get DOM fingerprint from first occurrence's HTML
      const firstOccurrence = cluster.members[0].occurrences[0];
      const domFingerprint = firstOccurrence
        ? createDomFingerprint(firstOccurrence.elementHtml)
        : null;

      const clusterDescription = `${ruleId}: Affects ${allPages.size} pages with similar component structure.`;
      const updatePayload = {
        name: clusterName,
        description: clusterDescription,
        componentSignature: cluster.signature,
        selectorPattern,
        domFingerprint: domFingerprint ?? undefined,
        pageCount: allPages.size,
        findingCount: cluster.members.length,
        severity,
      };

      let dbCluster;
      if (cluster.existingClusterId) {
        dbCluster = await prisma.issueCluster.update({
          where: { id: cluster.existingClusterId },
          data: updatePayload,
        });
      } else if (domFingerprint) {
        const existing = await prisma.issueCluster.findFirst({
          where: { siteId, domFingerprint },
        });
        dbCluster = existing
          ? await prisma.issueCluster.update({
              where: { id: existing.id },
              data: updatePayload,
            })
          : await prisma.issueCluster.create({
              data: {
                siteId,
                ...updatePayload,
              },
            });
      } else {
        dbCluster = await prisma.issueCluster.create({
          data: {
            siteId,
            ...updatePayload,
          },
        });
      }

      // Link findings to cluster
      await prisma.canonicalFinding.updateMany({
        where: { id: { in: cluster.members.map((m) => m.id) } },
        data: { clusterId: dbCluster.id },
      });
    }
  }

  console.log(`[Cluster] Clustering complete for site ${siteId}`);
}

interface FindingWithOccurrences {
  id: string;
  ruleId: string;
  impact: 'CRITICAL' | 'SERIOUS' | 'MODERATE' | 'MINOR';
  description: string;
  clusterId: string | null;
  occurrences: Array<{
    selector: string;
    elementHtml: string;
    page: { url: string };
  }>;
}

interface ClusterResult {
  signature: string;
  existingClusterId?: string;
  members: FindingWithOccurrences[];
}

function clusterByStructure(findings: FindingWithOccurrences[]): ClusterResult[] {
  const clusters: ClusterResult[] = [];
  const assigned = new Set<string>();

  for (let i = 0; i < findings.length; i++) {
    if (assigned.has(findings[i].id)) continue;

    const cluster: ClusterResult = {
      signature: '',
      existingClusterId: findings[i].clusterId ?? undefined,
      members: [findings[i]],
    };
    assigned.add(findings[i].id);

    const refSelectors = findings[i].occurrences.map((o) => normalizeSelector(o.selector));
    const refHtml = findings[i].occurrences[0]?.elementHtml ?? '';
    const refFingerprint = createDomFingerprint(refHtml);

    for (let j = i + 1; j < findings.length; j++) {
      if (assigned.has(findings[j].id)) continue;

      const candidateSelectors = findings[j].occurrences.map((o) =>
        normalizeSelector(o.selector)
      );
      const candidateHtml = findings[j].occurrences[0]?.elementHtml ?? '';
      const candidateFingerprint = createDomFingerprint(candidateHtml);

      // Check structural similarity
      const domSimilar = refFingerprint === candidateFingerprint;
      const selectorSim = maxSelectorSimilarity(refSelectors, candidateSelectors);

      if (domSimilar || selectorSim > 0.7) {
        cluster.members.push(findings[j]);
        assigned.add(findings[j].id);
        if (!cluster.existingClusterId && findings[j].clusterId) {
          cluster.existingClusterId = findings[j].clusterId ?? undefined;
        }
      }
    }

    cluster.signature = refFingerprint;
    clusters.push(cluster);
  }

  return clusters;
}

function maxSelectorSimilarity(a: string[], b: string[]): number {
  let maxSim = 0;
  for (const sa of a) {
    for (const sb of b) {
      const sim = selectorSimilarity(sa, sb);
      if (sim > maxSim) maxSim = sim;
    }
  }
  return maxSim;
}

function findCommonPattern(selectors: string[]): string {
  if (selectors.length === 0) return '';
  if (selectors.length === 1) return normalizeSelector(selectors[0]);

  const normalized = selectors.map(normalizeSelector);
  const parts = normalized[0].split(/\s*>\s*|\s+/);

  const commonParts: string[] = [];
  for (const part of parts) {
    if (normalized.every((s) => s.includes(part))) {
      commonParts.push(part);
    }
  }

  return commonParts.join(' > ') || normalized[0];
}
