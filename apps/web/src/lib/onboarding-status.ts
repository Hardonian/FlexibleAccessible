import type { EntitlementState } from './auth-guard';

export interface OnboardingStatusInput {
  sitesCount: number;
  crawlRunsCount: number;
  findingsCount: number;
  entitlement: EntitlementState;
  workerRunning: boolean;
  jobPipelinesHealthy: boolean;
}

export type OnboardingStageId =
  | 'connect_site'
  | 'run_first_scan'
  | 'triage_findings'
  | 'export_report';

export interface OnboardingStage {
  id: OnboardingStageId;
  label: string;
  complete: boolean;
  blocked: boolean;
  blockerReason: string | null;
  href: string;
}

export interface OnboardingStatus {
  stage: 'not_started' | 'collecting_data' | 'first_value_reached';
  nextStep: OnboardingStage;
  stages: OnboardingStage[];
}

export function buildOnboardingStatus(
  input: OnboardingStatusInput,
): OnboardingStatus {
  const hasPaidAccess = input.entitlement.hasPaidAccess;
  const hasSites = input.sitesCount > 0;
  const hasScans = input.crawlRunsCount > 0;
  const hasFindings = input.findingsCount > 0;

  const scanBlockedReason = !hasPaidAccess
    ? 'Private scans are blocked until a paid subscription is active.'
    : !input.workerRunning || !input.jobPipelinesHealthy
      ? 'Scan workers or queues are degraded. Restore background processing to run scans.'
      : null;

  const stages: OnboardingStage[] = [
    {
      id: 'connect_site',
      label: 'Add your first site',
      complete: hasSites,
      blocked: false,
      blockerReason: null,
      href: '/sites/new',
    },
    {
      id: 'run_first_scan',
      label: 'Run your first private scan',
      complete: hasScans,
      blocked: !hasSites || scanBlockedReason != null,
      blockerReason:
        !hasSites
          ? 'Add at least one site before running scans.'
          : scanBlockedReason,
      href: '/sites',
    },
    {
      id: 'triage_findings',
      label: 'Triage findings in backlog',
      complete: hasFindings,
      blocked: !hasScans,
      blockerReason: !hasScans
        ? 'Complete at least one scan before finding triage is available.'
        : null,
      href: '/findings',
    },
    {
      id: 'export_report',
      label: 'Export proof report for stakeholders',
      complete: hasFindings,
      blocked: !hasFindings || !hasPaidAccess,
      blockerReason: !hasFindings
        ? 'Findings must exist before exporting a meaningful report.'
        : !hasPaidAccess
          ? 'Paid access is required for dashboard report exports.'
          : null,
      href: '/reports',
    },
  ];

  const nextStep = stages.find((stage) => !stage.complete) ?? stages[stages.length - 1];

  const completeCount = stages.filter((s) => s.complete).length;
  const stage: OnboardingStatus['stage'] =
    completeCount === 0
      ? 'not_started'
      : completeCount < stages.length
        ? 'collecting_data'
        : 'first_value_reached';

  return {
    stage,
    nextStep,
    stages,
  };
}
