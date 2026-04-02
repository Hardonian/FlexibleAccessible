# Onboarding Architecture, First-30-Minutes Plan, and SOP

**Status:** RECOMMENDED  
**Purpose:** Standardize customer path to first value with realistic operator interventions.  
**Scope:** Self-serve and assisted onboarding, milestones, handoffs.

## Current Truth
- Signup creates user + org + workspace + free subscription.
- Free org is redirected to billing upgrade context.
- Private workflow value requires active paid entitlement.

## First 30 Minutes Experience Plan
1. **Minute 0–5:** account + org creation confirmation, billing expectation set.
2. **Minute 5–10:** plan selection and checkout (if paid path chosen).
3. **Minute 10–20:** create first site, validate domain input, queue first crawl.
4. **Minute 20–30:** trigger first scan, inspect findings summary, define first remediation task.

## First-Value Milestone Map
- M1: Paid entitlement active.
- M2: First site created and crawl completed.
- M3: First scan completed with actionable finding cluster.
- M4: First remediation action exported or tracked.

## Customer Onboarding SOP (operator)
- Confirm org role and billing permissions.
- Verify Stripe activation (if checkout succeeded but locked, check webhook status).
- Confirm crawl and scan workers are healthy.
- Guide customer to first high-severity finding and remediation path.
- Log onboarding outcome and blockers.

## Self-Serve vs Assisted Boundary
- **Self-serve now:** signup, billing, site creation, basic dashboard navigation.
- **Assisted now:** recovery from webhook/payment anomalies, complex integration setup, first remediation workflow coaching.

## Friction Points (expected)
- Webhook lag after checkout.
- Crawl/scan queue availability in lower-reliability environments.
- Confusion between public scan and private paid workflows.

## Next Actions
- Add in-app progress checklist mapped to M1–M4 milestones.
