/**
 * Remediation lifecycle for canonical findings (matches Prisma FindingStatus).
 * Single source of truth for allowed transitions and reopen behavior.
 */

export const FINDING_STATUSES = [
  'OPEN',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'RESOLVED',
  'MITIGATED',
  'FALSE_POSITIVE',
  'WONT_FIX',
] as const;

export type FindingStatusValue = (typeof FINDING_STATUSES)[number];

/** Transitions the product allows operators to apply from each state. */
export const OPERATOR_ALLOWED_TRANSITIONS: Record<FindingStatusValue, FindingStatusValue[]> = {
  OPEN: ['ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'MITIGATED', 'FALSE_POSITIVE', 'WONT_FIX'],
  ACKNOWLEDGED: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'MITIGATED', 'FALSE_POSITIVE', 'WONT_FIX'],
  IN_PROGRESS: ['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'MITIGATED', 'FALSE_POSITIVE', 'WONT_FIX'],
  RESOLVED: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'MITIGATED', 'FALSE_POSITIVE', 'WONT_FIX'],
  MITIGATED: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'FALSE_POSITIVE', 'WONT_FIX'],
  FALSE_POSITIVE: ['OPEN', 'ACKNOWLEDGED'],
  WONT_FIX: ['OPEN', 'ACKNOWLEDGED'],
};

export function canOperatorTransition(
  from: FindingStatusValue,
  to: FindingStatusValue
): boolean {
  if (from === to) return true;
  return OPERATOR_ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

/** When automated scan detects the issue again, reopen unless closed as FP or accepted risk. */
export function shouldReopenOnAutomatedDetection(status: FindingStatusValue): boolean {
  return status !== 'FALSE_POSITIVE' && status !== 'WONT_FIX';
}

export type AutomationEvidenceFreshness =
  | 'current'
  | 'stale_newer_scan_exists'
  | 'never_autoverified'
  | 'no_completed_scan'
  | 'pipeline_degraded';

export function deriveAutomationEvidenceFreshness(input: {
  lastVerifiedAt: Date | null;
  latestCompletedScanCompletedAt: Date | null;
  jobPipelinesHealthy: boolean;
}): AutomationEvidenceFreshness {
  if (!input.jobPipelinesHealthy) {
    return 'pipeline_degraded';
  }
  if (!input.latestCompletedScanCompletedAt) {
    return 'no_completed_scan';
  }
  if (!input.lastVerifiedAt) {
    return 'never_autoverified';
  }
  if (input.lastVerifiedAt.getTime() < input.latestCompletedScanCompletedAt.getTime()) {
    return 'stale_newer_scan_exists';
  }
  return 'current';
}
