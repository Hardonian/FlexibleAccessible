# Product Truth & Capability Envelope

**Status:** CURRENT STATE  
**Purpose:** Define what FlexibleAccessible can and cannot credibly claim today.  
**Scope:** Access model, billing, entitlements, onboarding readiness, trust boundaries.

## Current Truth
### Proven by implementation
- Multi-tenant authorization model with org-scoped checks and role permissions.
- Paid-gated private dashboard/application surfaces with billing route exception for recovery.
- Stripe-based subscription checkout and billing portal handoff.
- Stripe webhook signature verification and idempotent event handling.
- Plan limit fields persisted per-organization subscription (domains, pages/crawl, scans/month, seats, AI flags).
- Public scan and public report-oriented endpoints remain available without paid subscription.

### Not proven / must not be claimed as done
- Guaranteed WCAG compliance outcome.
- Full automated revenue recognition pipeline.
- Automated tax/sales-tax compliance.
- Contract-grade enterprise controls (SOC2 attestation, SSO/SAML enforcement, custom SLA automation) unless explicitly built and audited.
- Fully accurate AI token usage charging for value-based billing.

## Recommended Policy / Model
- Treat public messaging claims as requiring direct evidence from code paths + tests.
- Maintain explicit separation between:
  - **Product-enforced controls** (server-side gates/limits)
  - **Contractual controls** (MSA/SOW/manual process)
- Use conservative wording where implementation exists but operational evidence is still maturing.

## Risks / Caveats
- Plan feature copy currently diverges from webhook entitlement mapping for AI on Starter.
- Credit-pack purchase flow has development-mode grant fallback; this should never be externally presented as production billing behavior.

## Dependencies
- Alignment work in pricing and entitlement docs.
- Instrumentation hardening for usage-based monetization.

## Next Actions
1. Align plan copy and webhook mapping as a single source of truth.
2. Define production-only behavior guardrails for credit grants.
3. Extend evidence artifacts for enterprise procurement claims.
