# Paywall & Entitlement Truth Memo

**Status:** CURRENT STATE + RECOMMENDED  
**Purpose:** Ensure commercialization claims map to real gate paths.  
**Scope:** Access control, billing assumptions, failure states, trust boundaries.

## Current Truth
- Paid entitlement is required for most private pages/APIs.
- Billing settings pages remain reachable for recovery even when paid entitlement is absent.
- Webhook updates subscription status and limits idempotently.
- Past-due/cancelled/nonexistent subscription states intentionally block paid access.

## Billing Assumptions and Constraints
- Stripe is a required external dependency for full production subscription lifecycle.
- If Stripe env vars are missing, billing UI can render but checkout/portal actions are disabled.
- Webhook must be online and validated for entitlement activation timing.

## Recommended Policy / Model
- Public claims should state: "Premium access unlocks after webhook confirmation" (not instantly after checkout redirect).
- Define explicit customer communication for delayed webhook propagation.
- Keep entitlement reasons user-visible and operator-visible.

## Monetization Risks
- Entitlement mismatch (Starter AI) can create charge disputes.
- If any paid route bypass exists, tenant and monetization trust degrade simultaneously.
- Development fallback granting credits must be blocked from production paths.

## Next Actions
- Add automated test coverage asserting published plan matrix == enforcement matrix.
- Add production guard to disable dev credit grant behavior outside non-prod environments.
