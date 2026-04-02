# Pricing Strategy Memo

**Status:** RECOMMENDED  
**Purpose:** Define credible initial pricing model aligned to current enforcement.  
**Scope:** Free vs paid boundaries, tier logic, trial/annual policy.

## Current Truth
- Free access is effectively public-scan + marketing + auth + billing recovery.
- Private dashboard and org-scoped premium workflows are server-gated behind paid entitlement.
- Subscription plans are already represented in code with explicit quotas.

## Recommended Policy / Model
### Initial pricing model (credible now)
- **Primary model:** Subscription by organization tier (already implemented technically).
- **Packaging axis:** Mix of feature access + hard limits (domains/scans/pages/seats).
- **Secondary monetization:** Agency onboarding/services and optional credit packs (with production controls).

### Free vs trial vs paid boundary
- **Free (CURRENT):** Public scan + basic exposure path only; no private org workflow value.
- **Trial (RECOMMENDED/FUTURE):** Time-boxed paid-equivalent entitlement in product fields, auto-expire to Free.
- **Paid (CURRENT):** Active non-free subscription unlocks private app.

### Annual plan and discounting policy
- Monthly is default.
- Annual prepay can be offered only with:
  - explicit deferred revenue tracking,
  - refund policy constraints,
  - legal/finance sign-off.
- Discount guardrail: publish standard discount bands (e.g., 0–15%) with documented approval owner.

## Risks / Caveats
- Plan pricing numbers in code are not sufficient by themselves for external publication without entitlement consistency checks.
- Do not expose annual pricing publicly before deferred revenue close process is operating.

## Dependencies
- Packaging alignment in `packaging-entitlements-matrix.md`.
- Finance controls in `../03-finance-controls/finance-accounting-controls-pack.md`.
