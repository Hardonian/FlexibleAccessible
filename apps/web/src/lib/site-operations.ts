import type { EntitlementState } from '@/lib/auth-guard';
import {
  nextScheduleRunAt,
  scheduleBlockedReason,
  scheduleCadenceLabel,
} from '@aros/core-services';

export type SiteOperationalStatus =
  | 'activation_required'
  | 'scan_attention_required'
  | 'automation_degraded'
  | 'evidence_stale'
  | 'healthy';

export interface SiteOpsInput {
  pagesCount: number;
  openFindings: number;
  latestCrawlStatus: string | null;
  latestScanStatus: string | null;
  latestScanCompletedAt: Date | null;
  scheduleCron: string | null;
  entitlement: EntitlementState;
  workerRunning: boolean;
  jobPipelinesHealthy: boolean;
}

export interface SiteOpsSummary {
  status: SiteOperationalStatus;
  statusLabel: string;
  statusReason: string;
  nextAction: {
    label: string;
    href: string;
  };
  freshnessLabel: string;
  cadenceLabel: string;
  nextScheduledRunLabel: string;
}

export interface OrgSiteOpsRollup {
  activationRequired: number;
  scanAttentionRequired: number;
  automationDegraded: number;
  evidenceStale: number;
  healthy: number;
}

function freshnessLabelFromScan(completedAt: Date | null): string {
  if (!completedAt) return 'No verification yet';
  const ageHours = (Date.now() - completedAt.getTime()) / (1000 * 60 * 60);
  if (ageHours <= 24) return 'Verified ≤24h';
  if (ageHours <= 72) return 'Fresh ≤72h';
  return 'Stale >72h';
}

function scheduledRunLabel(scheduleCron: string | null): string {
  const blocked = scheduleBlockedReason(scheduleCron);
  if (blocked) return `Blocked (${blocked})`;
  const next = nextScheduleRunAt(scheduleCron, new Date());
  if (!next) return 'Not scheduled';
  return next.toLocaleString();
}

export function summarizeSiteOperations(input: SiteOpsInput): SiteOpsSummary {
  const freshness = freshnessLabelFromScan(input.latestScanCompletedAt);
  const cadence = scheduleCadenceLabel(input.scheduleCron);
  const nextScheduled = scheduledRunLabel(input.scheduleCron);

  if (input.pagesCount === 0 || input.latestCrawlStatus == null) {
    return {
      status: 'activation_required',
      statusLabel: 'Activation required',
      statusReason: 'Run the first crawl to discover pages and establish a verification baseline.',
      nextAction: { label: 'Start first crawl', href: '/sites' },
      freshnessLabel: freshness,
      cadenceLabel: cadence,
      nextScheduledRunLabel: nextScheduled,
    };
  }

  if (input.latestScanStatus === 'FAILED') {
    return {
      status: 'scan_attention_required',
      statusLabel: 'Scan failed',
      statusReason: 'The most recent verification scan failed. Inspect the run and retry once queue dependencies are healthy.',
      nextAction: { label: 'Inspect latest run', href: '/system' },
      freshnessLabel: freshness,
      cadenceLabel: cadence,
      nextScheduledRunLabel: nextScheduled,
    };
  }

  if (!input.entitlement.hasPaidAccess) {
    return {
      status: 'automation_degraded',
      statusLabel: 'Upgrade required',
      statusReason: 'Private verification automation is blocked until billing is active for this organization.',
      nextAction: { label: 'Open billing', href: '/settings/billing' },
      freshnessLabel: freshness,
      cadenceLabel: cadence,
      nextScheduledRunLabel: nextScheduled,
    };
  }

  if (!input.workerRunning || !input.jobPipelinesHealthy) {
    return {
      status: 'automation_degraded',
      statusLabel: 'Automation degraded',
      statusReason: 'Workers or job queues are degraded, so scheduled crawls and verification rechecks may not complete.',
      nextAction: { label: 'Open system status', href: '/system' },
      freshnessLabel: freshness,
      cadenceLabel: cadence,
      nextScheduledRunLabel: nextScheduled,
    };
  }

  if (!input.latestScanCompletedAt || freshness.startsWith('Stale')) {
    return {
      status: 'evidence_stale',
      statusLabel: 'Evidence stale',
      statusReason: 'Recent accessibility evidence is stale. Run a new crawl + verification to restore confidence.',
      nextAction: { label: 'Queue verification', href: '/sites' },
      freshnessLabel: freshness,
      cadenceLabel: cadence,
      nextScheduledRunLabel: nextScheduled,
    };
  }

  return {
    status: 'healthy',
    statusLabel: 'Healthy',
    statusReason:
      input.openFindings > 0
        ? `Automation and evidence are healthy; ${input.openFindings} open findings remain in backlog.`
        : 'Automation and evidence are healthy with no open findings currently detected.',
    nextAction: {
      label: input.openFindings > 0 ? 'Review findings' : 'Open site details',
      href: input.openFindings > 0 ? '/findings?status=OPEN' : '/sites',
    },
    freshnessLabel: freshness,
    cadenceLabel: cadence,
    nextScheduledRunLabel: nextScheduled,
  };
}

export function rollupSiteOperations(statuses: SiteOperationalStatus[]): OrgSiteOpsRollup {
  const rollup: OrgSiteOpsRollup = {
    activationRequired: 0,
    scanAttentionRequired: 0,
    automationDegraded: 0,
    evidenceStale: 0,
    healthy: 0,
  };

  for (const status of statuses) {
    if (status === 'activation_required') rollup.activationRequired += 1;
    if (status === 'scan_attention_required') rollup.scanAttentionRequired += 1;
    if (status === 'automation_degraded') rollup.automationDegraded += 1;
    if (status === 'evidence_stale') rollup.evidenceStale += 1;
    if (status === 'healthy') rollup.healthy += 1;
  }

  return rollup;
}
