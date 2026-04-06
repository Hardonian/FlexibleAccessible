import { describe, expect, it } from 'vitest';
import { deployWebhookSubscriptionAllowed } from '../deploy-webhook-plan-gate';

describe('deployWebhookSubscriptionAllowed', () => {
  it('allows Professional active', () => {
    expect(
      deployWebhookSubscriptionAllowed({ plan: 'PROFESSIONAL', status: 'ACTIVE' }),
    ).toBe(true);
  });

  it('allows Professional trialing', () => {
    expect(
      deployWebhookSubscriptionAllowed({ plan: 'PROFESSIONAL', status: 'TRIALING' }),
    ).toBe(true);
  });

  it('denies Starter even when active', () => {
    expect(
      deployWebhookSubscriptionAllowed({ plan: 'STARTER', status: 'ACTIVE' }),
    ).toBe(false);
  });

  it('denies past due Professional', () => {
    expect(
      deployWebhookSubscriptionAllowed({ plan: 'PROFESSIONAL', status: 'PAST_DUE' }),
    ).toBe(false);
  });
});
