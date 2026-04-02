# Gap Analysis: Business-System Closure Pass

**Status:** CURRENT STATE + RECOMMENDED  
**Purpose:** Identify commercialization and operating-system gaps in the current repo and define closure artifacts.  
**Scope:** Docs, pricing, monetization, finance controls, onboarding, support, GTM trust, operator cadence.

## Current Truth
- Product has real multi-tenant primitives (org/workspace/membership), RBAC, and tenant-scoped query patterns.
- Private routes and most org APIs are hard-gated by paid entitlement checks (`requirePaid: true`).
- Billing stack exists: Stripe checkout + billing portal + webhook processing + idempotency table.
- Plan limits exist in subscription fields and are partially enforced (domains, monthly scans, paid-only access).
- Public surface exists independent of paid access (`/`, `/scan/*`, `/api/public-scan`, health/badge).

## Fundamental Gaps Found

| Category | Gap | Risk if unaddressed | Closure in this pass |
|---|---|---|---|
| Product truth | No internal capability envelope that separates current reality from future claims | Overpromising in sales/onboarding | `product-truth-capability-envelope.md` |
| Pricing | No unified pricing policy tied to enforced entitlement reality | Tier confusion, churn, support debt | `pricing-strategy.md`, `packaging-entitlements-matrix.md` |
| Monetization | No model for service revenue / credit packs / expansion paths | Revenue dependency on one path | `monetization-models-and-expansion.md` |
| Entitlements | Inconsistency: Starter plan copy suggests AI, webhook mapping sets `aiEnabled=false` | Trust break and customer dispute risk | `paywall-and-entitlement-truth-memo.md` |
| Finance controls | No month-end close, reconciliation, rev-rec assumptions, or failed payment policy | Cash/revenue blind spots, audit weakness | `finance-accounting-controls-pack.md` |
| Metrics | No KPI definitions with data-source ownership | Decision drift and vanity metrics | `kpi-metrics-dictionary.md` |
| Onboarding | No first-30-min plan, milestone map, or handoff SOP | Low activation and manual firefighting | `onboarding-architecture-and-sop.md` |
| Support/CX | No severity matrix, churn playbook, objection handling | Slow response and preventable churn | `support-and-customer-success-playbook.md` |
| GTM trust | No internal messaging house and proof requirements | Unsupported claims in market | `internal-messaging-and-gtm-pack.md`, `trust-faq-procurement-proof.md` |
| Operator system | No recurring founder/ops cadence or release-to-revenue gate | Inconsistent execution and regressions | `operator-cadence-and-checklists.md`, launch/release checklist |

## Dependencies / Constraints
- Legal, tax, and accounting policies require external professional sign-off.
- Usage-based billing beyond subscriptions requires additional implementation (usage metering + invoicing semantics).
- AI usage accounting currently logs zero token counts in some paths; usage monetization remains partially inferred.

## Next Actions
1. Adopt docs in this folder as the internal source of truth.
2. Resolve Starter-plan AI entitlement mismatch before external pricing publication.
3. Add instrumentation gaps called out in KPI and finance docs.
