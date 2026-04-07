# Pricing + packaging matrix (single canonical internal doc)

Last validated: 2026-04-07.

This file merges code-aligned limits with enforcement posture. **Do not maintain a second pricing matrix**; update this file and the code sources below together.

## Plan truth source

- Canonical plan limits/features: `packages/config/src/plans.ts`
- Billing UI cards: `apps/web/src/lib/billing.ts`
- Public pricing cards: `apps/web/src/lib/public-packaging.ts` (drives `/docs/plans-and-limits` and marketing)
- Stripe entitlement sync: `apps/web/src/lib/stripe-webhook.ts`

## Current public/commercial tiers

| Tier | Price/mo | Sites | Pages/crawl | Scans/mo | Seats | AI |
|---|---:|---:|---:|---:|---:|---|
| Free | $0 | 1 | 50 | 3 | 1 | No |
| Starter | $49 | 3 | 200 | 10 | 3 | No |
| Professional | $149 | 10 | 1,000 | 50 | 10 | Yes (100,000 tokens/mo) |
| Enterprise | $499 | 100 | 10,000 | 500 | 100 | Yes (1,000,000 tokens/mo) |

## Plan model vs buyer (enforcement reality)

| Package | Intended buyer | Enforced capabilities | Limits surfaced in billing UI |
| --- | --- | --- | --- |
| Free / Trial | Evaluation, single operator | No paid-only routes (`requirePaid`) | Domains, pages per crawl, scans per month, seats |
| Paid | Team operations | Reports export, remediation + AI-gated workflows, billing controls | Same limits with higher ceilings |
| Enterprise | Procurement/security review | Same server-enforced paid capabilities + contract controls outside app | Contractual overrides represented by subscription fields |

## Feature-to-entitlement mapping

- **Reports export API** (`/api/reports`) is paid-only and fail-closed.
- **VPAT export** (`/api/reports/vpat`) is paid-only; each successful response records `UsageRecord` metric `report.vpat_export` (quantity 1) when the org subscription has Stripe period bounds.
- **Findings report export** records `UsageRecord` metric `report.export` (quantity 1 per download). **Billing UI** surfaces the sum for the current period on `/settings/billing` (operator visibility for margin; not a customer-facing hard cap unless product adds enforcement).
- **Audit log export** (`GET /api/org/{organizationId}/audit-log`) requires `audit:view` + paid org; JSON or `format=csv`.
- **AI copilot** (`/api/ai-copilot`) requires Professional+ and `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`; returns `503` with `AI_UNAVAILABLE` if neither is set.
- **Remediation worker AI path** uses the same keys; without them the worker continues with **rule-based** suggestions only (`apps/worker/src/jobs/remediation.ts`).
- **Billing visibility** shows active status, cancellation window, and limits so downgrade risk is operator-visible.

## Guardrails

- Do **not** claim "unlimited scans" publicly unless config + enforcement both move to unlimited.
- Unknown Stripe `price_id` must not grant paid access.
- Paid-route gating is server-side and fail-closed via auth guard checks.

## Packaging truth constraints

- Public copy must describe evidence as **testing evidence**, not legal conformance guarantee.
- Claims about proof lineage must map to canonical finding provenance + evidence summary fields.
- “Automation freshness” claims must reflect platform truth flags and scan recency.

## Release checklist before pricing changes

1. Update `packages/config/src/plans.ts`.
2. Update Stripe price env mapping (`STRIPE_PRICE_*`) and validate in staging.
3. Run billing + webhook tests and full `npm run verify`.
4. Confirm public pricing (`/docs/plans-and-limits`, home pricing section) reflects new limits.

## Gaps to close next

1. Metered usage events for proof export volume (if pricing depends on exports).
2. Explicit grace-period UX language tied to subscription status enum everywhere users hit walls.
3. Keep the public pricing table generated from `PLANS` / `getPublicPlanCards()` (already the case for docs pages).
