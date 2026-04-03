# Pricing + Packaging Matrix (Code-Aligned)

Last validated: 2026-04-03.

This document is intentionally derived from `packages/config/src/plans.ts` and must remain consistent with server-side entitlement enforcement and Stripe webhook mapping.

## Plan truth source

- Canonical plan limits/features: `packages/config/src/plans.ts`
- Billing UI cards: `apps/web/src/lib/billing.ts`
- Public pricing cards: `apps/web/src/lib/public-packaging.ts`
- Stripe entitlement sync: `apps/web/src/lib/stripe-webhook.ts`

## Current public/commercial tiers

| Tier | Price/mo | Sites | Pages/crawl | Scans/mo | Seats | AI |
|---|---:|---:|---:|---:|---:|---|
| Free | $0 | 1 | 50 | 3 | 1 | No |
| Starter | $49 | 3 | 200 | 10 | 3 | No |
| Professional | $149 | 10 | 1,000 | 50 | 10 | Yes (100,000 tokens/mo) |
| Enterprise | $499 | 100 | 10,000 | 500 | 100 | Yes (1,000,000 tokens/mo) |

## Guardrails

- Do **not** claim "unlimited scans" publicly unless config + enforcement both move to unlimited.
- Unknown Stripe `price_id` must not grant paid access.
- Paid-route gating is server-side and fail-closed using auth guard checks.

## Release checklist before pricing changes

1. Update `packages/config/src/plans.ts`.
2. Update Stripe price env mapping (`STRIPE_PRICE_*`) and validate in staging.
3. Run billing + webhook tests and full `npm run verify`.
4. Confirm public pricing page text reflects new limits.
