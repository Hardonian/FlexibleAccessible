# Problem–Solution–Value Map + Roadmap Classification

**Status:** CURRENT STATE + RECOMMENDED  
**Purpose:** Translate implemented features into customer value and roadmap categories.  
**Scope:** Feature-to-value mapping, maintenance vs leverage vs moat.

## Current Truth (Feature-to-Value)
| Capability | Customer problem addressed | Value delivered | Evidence strength |
|---|---|---|---|
| Paid server-side gating | Need to protect premium/private data | Prevents free-tier abuse of private org surfaces | High |
| Subscription limits on domain/scans | Need predictable usage envelope | Clear operating boundaries per plan | Medium-High |
| Stripe checkout/portal/webhook | Need real payment lifecycle | Subscription lifecycle can update entitlements | High |
| Public scan route | Need low-friction evaluation | Top-of-funnel acquisition path | Medium |
| Multi-tenant auth/RBAC | Need tenant-safe collaboration | Access control and role segmentation | High |

## Roadmap Classification
### Maintenance (must-do reliability)
- Resolve entitlement mismatch (Starter AI copy vs actual entitlement flag).
- Harden billing reconciliation and failed-payment state transitions.
- Improve AI usage metering data quality.

### Leverage (near-term revenue lift)
- Enforce seat limits in member-invite flow.
- Add self-serve trial control toggles tied to entitlement fields.
- Add upgrade prompts tied to exact blocked action context.

### Moat (long-term differentiation)
- Evidence-grade remediation lifecycle analytics linked to conversion/renewal outcomes.
- Agency multi-client operating views with strict tenant partitioning.
- Deeper source mapping and closed-loop “issue fixed and re-verified” reporting.

## Risks / Caveats
- Avoid listing roadmap items as active plan entitlements until enforcement exists.

## Next Actions
- Use this map in sales/proof docs and launch checklist to avoid claim drift.
