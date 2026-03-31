import type { EvidenceSource } from '@aros/db';
import {
  deriveAutomationEvidenceFreshness,
  type AutomationEvidenceFreshness,
} from '@aros/shared';

export interface AutomationEvidenceFreshnessDescriptor {
  freshness: AutomationEvidenceFreshness;
  badgeLabel: string;
  detail: string;
  tone: 'success' | 'warning' | 'neutral';
}

export function getAutomationEvidenceFreshnessDescriptor(input: {
  evidenceSource: EvidenceSource;
  lastVerifiedAt: Date | null;
  latestCompletedScanCompletedAt: Date | null;
  jobPipelinesHealthy: boolean;
}): AutomationEvidenceFreshnessDescriptor | null {
  if (input.evidenceSource !== 'AUTOMATED_AXE') {
    return null;
  }

  const freshness = deriveAutomationEvidenceFreshness({
    lastVerifiedAt: input.lastVerifiedAt,
    latestCompletedScanCompletedAt: input.latestCompletedScanCompletedAt,
    jobPipelinesHealthy: input.jobPipelinesHealthy,
  });

  switch (freshness) {
    case 'current':
      return {
        freshness,
        badgeLabel: 'current',
        detail: 'Automated evidence is aligned with the latest completed scan.',
        tone: 'success',
      };
    case 'stale_newer_scan_exists':
      return {
        freshness,
        badgeLabel: 'stale',
        detail:
          "A newer completed scan exists than this finding's last verification timestamp.",
        tone: 'warning',
      };
    case 'never_autoverified':
      return {
        freshness,
        badgeLabel: 'unverified',
        detail:
          'This automated finding has not been verified by a completed scan yet.',
        tone: 'neutral',
      };
    case 'no_completed_scan':
      return {
        freshness,
        badgeLabel: 'no scan baseline',
        detail:
          'No completed scan exists for this organization yet, so freshness cannot be compared.',
        tone: 'neutral',
      };
    case 'pipeline_degraded':
      return {
        freshness,
        badgeLabel: 'pipeline degraded',
        detail:
          'Workers or queues are degraded, so automation freshness cannot be trusted right now.',
        tone: 'warning',
      };
  }
}
