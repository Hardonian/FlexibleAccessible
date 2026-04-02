# Launch Readiness + Release-to-Revenue Checklist

**Status:** RECOMMENDED  
**Purpose:** Prevent shipping monetization-facing changes without control integrity.  
**Scope:** Pre-launch, release gate, post-release verification.

## Pre-Launch Readiness
- Pricing/packaging docs updated and internally approved.
- Plan-copy to entitlement mapping diff reviewed.
- Billing env vars and webhook secret configured.
- Operator escalation owner assigned.

## Release-to-Revenue Checklist
1. Verify subscription checkout start/return flow.
2. Verify webhook signature + idempotency processing.
3. Verify paid gate behavior on private routes/APIs.
4. Verify free/public route accessibility remains intact.
5. Verify plan limits (domains/scans) block correctly.
6. Verify billing portal handoff works.

## Post-Release (24h)
- Monitor entitlement errors.
- Reconcile first paid events against internal subscription state.
- Check support queue for billing friction patterns.

## Stop-Ship Conditions
- Entitlement mismatch between published packaging and actual gate behavior.
- Webhook processing failures causing entitlement drift.
- Cross-tenant data access regression.
