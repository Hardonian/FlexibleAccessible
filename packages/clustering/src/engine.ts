import { createDomFingerprint, normalizeSelector, selectorSimilarity } from '@aros/shared';

export interface ClusterInput {
  id: string;
  ruleId: string;
  selector: string;
  elementHtml: string;
  pageUrl: string;
}

export interface ClusterOutput {
  signature: string;
  selectorPattern: string;
  members: ClusterInput[];
}

/**
 * Groups findings into clusters based on structural similarity.
 *
 * Clustering strategy:
 * 1. Group by rule ID
 * 2. Within each rule group, compare DOM structure fingerprints
 * 3. Use selector similarity as secondary signal
 * 4. Merge groups with similarity > threshold
 */
export function clusterFindings(
  findings: ClusterInput[],
  options: { similarityThreshold?: number } = {}
): ClusterOutput[] {
  const threshold = options.similarityThreshold ?? 0.7;
  const clusters: ClusterOutput[] = [];

  // Group by rule ID
  const byRule = new Map<string, ClusterInput[]>();
  for (const f of findings) {
    const group = byRule.get(f.ruleId) ?? [];
    group.push(f);
    byRule.set(f.ruleId, group);
  }

  for (const [, group] of byRule) {
    const assigned = new Set<string>();

    for (let i = 0; i < group.length; i++) {
      if (assigned.has(group[i].id)) continue;

      const cluster: ClusterOutput = {
        signature: createDomFingerprint(group[i].elementHtml),
        selectorPattern: normalizeSelector(group[i].selector),
        members: [group[i]],
      };
      assigned.add(group[i].id);

      const refFp = cluster.signature;
      const refSelector = normalizeSelector(group[i].selector);

      for (let j = i + 1; j < group.length; j++) {
        if (assigned.has(group[j].id)) continue;

        const candidateFp = createDomFingerprint(group[j].elementHtml);
        const candidateSelector = normalizeSelector(group[j].selector);

        const domMatch = refFp === candidateFp;
        const selSim = selectorSimilarity(refSelector, candidateSelector);

        if (domMatch || selSim >= threshold) {
          cluster.members.push(group[j]);
          assigned.add(group[j].id);
        }
      }

      // Find common selector pattern
      if (cluster.members.length > 1) {
        const selectors = cluster.members.map((m) => normalizeSelector(m.selector));
        cluster.selectorPattern = extractCommonPattern(selectors);
      }

      clusters.push(cluster);
    }
  }

  return clusters;
}

function extractCommonPattern(selectors: string[]): string {
  if (selectors.length === 0) return '';
  if (selectors.length === 1) return selectors[0];

  const parts = selectors[0].split(/\s+/);
  const common: string[] = [];

  for (const part of parts) {
    if (selectors.every((s) => s.includes(part))) {
      common.push(part);
    }
  }

  return common.join(' > ') || selectors[0];
}
