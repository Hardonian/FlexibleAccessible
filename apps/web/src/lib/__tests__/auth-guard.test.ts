import { describe, expect, it } from 'vitest';
import { getEntitlementState } from '../auth-guard';

describe('getEntitlementState', () => {
  const base = {
    maxDomains: 3,
    maxPagesPerCrawl: 200,
    maxScansPerMonth: 10,
    maxSeats: 3,
    aiEnabled: false,
    aiTokenLimit: 0,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
  };

  it('treats TRIALING as paid access', () => {
    const s = getEntitlementState({
      ...base,
      plan: 'STARTER',
      status: 'TRIALING',
    });
    expect(s.hasPaidAccess).toBe(true);
    expect(s.reason).toBe('active_paid');
  });

  it('denies PAST_DUE even on a paid plan tier', () => {
    const s = getEntitlementState({
      ...base,
      plan: 'PROFESSIONAL',
      status: 'PAST_DUE',
    });
    expect(s.hasPaidAccess).toBe(false);
    expect(s.reason).toBe('past_due');
  });
});
