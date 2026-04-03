# Go-live readiness checklist

Last updated: 2026-04-03.

## Product-system checks

- [ ] Findings list surfaces proof completeness and recurring family summary.
- [ ] Site scan history surfaces proof snapshot and violation delta.
- [ ] Report export includes proof summary + completeness totals.
- [ ] Public claims avoid conformance guarantees and match implementation.

## Commercial checks

- [ ] Paid-only routes fail-closed server-side.
- [ ] Billing page shows status and actionable next steps.
- [ ] Plan/limit language matches current subscription fields.

## Reliability + trust checks

- [ ] Platform degradation banners appear when dependencies are unhealthy.
- [ ] No empty states imply “healthy” when data is unavailable.
- [ ] Tenant-scoped queries are used for dashboard, findings, and site routes.

## Verification gate

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`

If any check fails, classify as pre-existing vs introduced before release decision.
