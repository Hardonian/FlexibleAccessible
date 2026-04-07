import type { FindingStatus } from '@aros/db';

export const ACTIVE_FINDING_STATUSES: FindingStatus[] = [
  'OPEN',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
];

export interface FindingFamilyAggregateInput {
  ruleId: string;
  firstSeenAt: Date;
  lastSeenAt: Date;
  reopenedCount: number;
  status: FindingStatus;
  /** From CanonicalFinding.distinctScanRunsObserved (automated scan fingerprint scope). */
  distinctScanRunsObserved?: number;
}

export interface FindingFamilySummary {
  totalFindings: number;
  activeFindings: number;
  regressedFindings: number;
  newlyDetectedFindings: number;
  persistentFindings: number;
  /** Findings with distinctScanRunsObserved > 1 (recurred across completed scan runs). */
  recurringAcrossScanRunsFindings: number;
  firstSeenAt: Date | null;
  lastSeenAt: Date | null;
}

export function summarizeFindingFamilies(
  findings: FindingFamilyAggregateInput[],
): Record<string, FindingFamilySummary> {
  const summaryByRuleId: Record<string, FindingFamilySummary> = {};

  for (const finding of findings) {
    const summary = (summaryByRuleId[finding.ruleId] ??= {
      totalFindings: 0,
      activeFindings: 0,
      regressedFindings: 0,
      newlyDetectedFindings: 0,
      persistentFindings: 0,
      recurringAcrossScanRunsFindings: 0,
      firstSeenAt: null,
      lastSeenAt: null,
    });

    summary.totalFindings += 1;

    if (ACTIVE_FINDING_STATUSES.includes(finding.status)) {
      summary.activeFindings += 1;
    }

    if (finding.reopenedCount > 0) {
      summary.regressedFindings += 1;
    }

    const scanRunsObserved = finding.distinctScanRunsObserved ?? 0;
    if (scanRunsObserved > 1) {
      summary.recurringAcrossScanRunsFindings += 1;
    }

    if (finding.firstSeenAt.getTime() === finding.lastSeenAt.getTime()) {
      summary.newlyDetectedFindings += 1;
    } else if (finding.lastSeenAt.getTime() > finding.firstSeenAt.getTime()) {
      summary.persistentFindings += 1;
    }

    if (!summary.firstSeenAt || finding.firstSeenAt < summary.firstSeenAt) {
      summary.firstSeenAt = finding.firstSeenAt;
    }

    if (!summary.lastSeenAt || finding.lastSeenAt > summary.lastSeenAt) {
      summary.lastSeenAt = finding.lastSeenAt;
    }
  }

  return summaryByRuleId;
}
