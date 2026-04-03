# Support + Billing Ops Playbook

Last validated: 2026-04-03.

## Common incident classes

1. **Checkout succeeded but access not upgraded yet**
   - Cause: Stripe webhook delay/failure.
   - Operator action: verify webhook delivery + `stripeWebhookEvent` row creation.
2. **User blocked from paid feature unexpectedly**
   - Cause: subscription status `PAST_DUE`, canceled, or FREE downgrade.
   - Operator action: inspect `subscription` row and entitlement reason in app.
3. **Unknown Stripe price id seen**
   - Cause: missing env mapping or stale product price.
   - Operator action: fix env + replay event; unknown price intentionally does not grant paid access.

## Triage queries

- Subscription snapshot by org.
- Billing customer by `organizationId` / `stripeCustomerId`.
- Webhook idempotency via `stripeWebhookEvent.id`.

## Escalation criteria

- Any suspected cross-tenant data exposure.
- Any fail-open entitlement or paywall bypass.
- Any repeated webhook signature failures (possible secret mismatch).
