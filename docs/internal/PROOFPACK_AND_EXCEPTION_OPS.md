# Proofpack + Recurring Exception Operations (Current Implementation)

## Scope

This document describes **implemented** behavior in the dashboard and report API as of this pass. It is intentionally narrow so support/sales do not over-claim.

## Implemented truth surfaces

### Findings backlog (`/findings`)

Each finding row now carries family-level context derived from canonical findings sharing the same `ruleId` inside the active organization scope:

- family total vs active count
- family regressed count (`reopenedCount > 0`)
- family trend split (new vs persistent)
- family first-seen and last-seen timestamps

Per-finding proof summary remains canonicalized via `buildFindingProofSummary`.

### Report export (`GET /api/reports`)

JSON export now includes `familySummary` per finding using the same canonical family aggregator as the findings list.

CSV export now includes trust/triage columns:

- `Truth Status`
- `Changed Since Last Run`
- `Proof Completeness` score
- `Family Active`
- `Family Regressed`

This makes the CSV useful for stakeholder triage, not just raw defect dumping.

## Canonical contracts

- Per-finding proof contract: `apps/web/src/lib/findings/proof-summary.ts`
- Recurring-family contract: `apps/web/src/lib/findings/family-summary.ts`

If another page needs family or proof semantics, it should consume these contracts rather than reconstructing interpretation locally.

## Known limitations (explicit)

- Family grouping is keyed by `ruleId`; it does not yet cluster by richer normalized signatures across rule variants.
- CSV remains a flat artifact; it does not include nested evidence records.
- No automated buyer-facing PDF narrative layer exists yet; reports are factual data exports.
