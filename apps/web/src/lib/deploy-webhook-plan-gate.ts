import { planMeetsMinimum } from '@aros/config';
import type { PlanTier, SubscriptionStatus } from '@aros/db';

export function deployWebhookSubscriptionAllowed(
  subscription:
    | {
        plan: PlanTier;
        status: SubscriptionStatus;
      }
    | null
    | undefined,
): boolean {
  if (!subscription || subscription.plan === 'FREE') {
    return false;
  }
  const statusOk = subscription.status === 'ACTIVE' || subscription.status === 'TRIALING';
  const tierOk = planMeetsMinimum(subscription.plan, 'PROFESSIONAL');
  return statusOk && tierOk;
}
