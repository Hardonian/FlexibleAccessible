# Monetization Models & Revenue Expansion

**Status:** RECOMMENDED  
**Purpose:** Define trustworthy revenue paths grounded in current architecture.  
**Scope:** Subscription, services, usage add-ons, upsell/cross-sell.

## Current Truth
- Subscription infrastructure is the strongest and most production-ready monetization path.
- Credit pack purchase APIs exist; productionization details must be strictly controlled.

## Monetization Options (ranked)
1. **Core subscription tiers (Primary, now).**
2. **Agency/white-glove onboarding services (Now, contractual/manual).**
3. **Credit packs for remediation workflows (Near-term, with billing hardening).**
4. **Usage-based overage (Future, requires robust metering + invoice controls).**

## Attach-Rate / Upsell Ideas (grounded)
- Free → Starter: unlock private org workspace and recurring scans.
- Starter → Professional: larger scan/domain envelope and AI-enabled workflows.
- Professional → Enterprise: higher limits + contractual support add-ons.
- Add-on service: implementation sprint (setup + first triage backlog + handoff).

## Anti-patterns to Avoid
- Selling usage-based AI overages before reliable token accounting.
- Offering enterprise SLA language without on-call/process commitments.
- Bundling features that lack server-side enforcement and calling them entitlements.

## Dependencies
- Finance and reconciliation controls for non-subscription revenue.
- Clear product-vs-contract boundary in customer-facing terms.
