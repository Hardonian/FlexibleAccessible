import { describe, expect, it } from 'vitest';
import { buildOnboardingStatus } from './onboarding-status';

describe('buildOnboardingStatus', () => {
  it('returns blocked first scan when billing is inactive', () => {
    const status = buildOnboardingStatus({
      sitesCount: 1,
      crawlRunsCount: 0,
      findingsCount: 0,
      entitlement: { hasPaidAccess: false, reason: 'free_plan' },
      workerRunning: true,
      jobPipelinesHealthy: true,
    });

    expect(status.stage).toBe('collecting_data');
    expect(status.nextStep.id).toBe('run_first_scan');
    expect(status.nextStep.blocked).toBe(true);
    expect(status.nextStep.blockerReason).toContain('paid subscription');
  });

  it('returns first value reached once findings exist and report export is available', () => {
    const status = buildOnboardingStatus({
      sitesCount: 2,
      crawlRunsCount: 3,
      findingsCount: 5,
      entitlement: { hasPaidAccess: true, reason: 'active_paid' },
      workerRunning: true,
      jobPipelinesHealthy: true,
    });

    expect(status.stage).toBe('first_value_reached');
    expect(status.stages.every((step) => step.complete)).toBe(true);
  });
});
