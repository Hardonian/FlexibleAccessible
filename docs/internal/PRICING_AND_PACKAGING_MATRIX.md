# AccessibleMadeFlexible pricing and packaging matrix (implementation-aligned)

Last updated: 2026-04-03.

## Canonical enforcement source

- Server-side entitlement gates are enforced through `requireOrgAccess(..., { requirePaid: true })` and `getEntitlementState(...)`.
- UI upsell messaging uses `EntitlementWall`, but client rendering is not the source of truth.

## Plan model (current code reality)

| Package | Intended buyer | Enforced capabilities | Limits surfaced in billing UI |
| --- | --- | --- | --- |
| Free / Trial | Evaluation, single operator | No paid-only routes (`requirePaid`) | Domains, pages per crawl, scans per month, seats |
| Paid | Team operations | Reports export, remediation + AI workflows, billing controls | Same limits with higher ceilings |
| Enterprise | Procurement/security review | Same server-enforced paid capabilities + contract controls outside app | Contractual overrides currently represented by subscription fields |

## Feature-to-entitlement mapping

- **Reports export API** (`/api/reports`) is paid-only and fail-closed.
- **AI copilot + remediation actions** are paid-only.
- **Billing visibility** shows active status, cancellation window, and limits, so downgrade risk is operator-visible.

## Packaging truth constraints

- Public copy must describe evidence as **testing evidence**, not legal conformance guarantee.
- Any claim about proof lineage must map to canonical finding provenance + evidence summary fields.
- Any “automation freshness” claim must reflect platform truth flags and scan recency.

## Gaps to close next

1. Add metered usage events for proof export volume (if pricing depends on exports).
2. Add explicit grace-period UX language tied to subscription status enum.
3. Publish externally-visible pricing table only from this mapping file (or generated derivative).
