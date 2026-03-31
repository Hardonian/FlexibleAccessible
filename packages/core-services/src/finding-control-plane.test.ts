import { describe, expect, it } from 'vitest';
import { deriveFindingTruthStatus, deriveWorkflowTruthStatus } from './finding-control-plane';

describe('deriveFindingTruthStatus', () => {
  it('prefers verified fixed when verification passed', () => {
    expect(
      deriveFindingTruthStatus({
        workflowStatus: 'RESOLVED',
        latestVerificationStatus: 'PASSED',
        activeGovernanceKind: 'WAIVER',
      })
    ).toBe('VERIFIED_FIXED');
  });

  it('preserves suppression when the issue is still present', () => {
    expect(
      deriveFindingTruthStatus({
        workflowStatus: 'OPEN',
        latestVerificationStatus: 'FAILED',
        activeGovernanceKind: 'SUPPRESSION',
      })
    ).toBe('SUPPRESSED');
  });

  it('marks resolved findings as pending verification when no verification exists yet', () => {
    expect(
      deriveFindingTruthStatus({
        workflowStatus: 'RESOLVED',
        latestVerificationStatus: null,
        activeGovernanceKind: null,
      })
    ).toBe('FIXED_PENDING_VERIFICATION');
  });

  it('treats false positive or wont-fix without governance as inconclusive', () => {
    expect(
      deriveFindingTruthStatus({
        workflowStatus: 'FALSE_POSITIVE',
        latestVerificationStatus: null,
        activeGovernanceKind: null,
      })
    ).toBe('INCONCLUSIVE');
  });
});

describe('deriveWorkflowTruthStatus', () => {
  it('keeps open workflow findings waived when an active waiver exists', () => {
    expect(deriveWorkflowTruthStatus('OPEN', 'WAIVER')).toBe('WAIVED');
  });
});
