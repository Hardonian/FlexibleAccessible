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
- **family multi-run count**: findings in that rule family with `distinctScanRunsObserved > 1` (see below)

Per-finding proof summary remains canonicalized via `buildFindingProofSummary`, which now includes:

- **comparison basis**: automated fingerprint path vs explicit not-comparable paths for manual/imported sources
- **recurrence**: `distinctScanRunsObserved` and `distinctScanRunsAbsentWhenOpen` (durable counters on `CanonicalFinding`)
- **change signal**: `newly_detected`, `regressed`, `persistent`, `improved_open_backlog`, `not_comparable`, or `unknown` with documented rules

List ordering uses severity first, then reopen count, distinct scan-run observation count, and occurrence count (deterministic, not a black box).

### Finding detail (`/findings/[id]`)

A **Cross-run history & comparison** panel surfaces the same contract as the list (limits, recurrence counts, deterministic triage score + reasons).

### Report export (`GET /api/reports`)

JSON export includes `proofSummary` (extended), `triagePriority` (score + string reasons), `familySummary` (including `recurringAcrossScanRunsFindings`), and `summary.recurringAcrossScanRuns`.

CSV export adds triage and recurrence columns:

- `Change Signal` (replaces the narrower prior label; values are machine-stable enums)
- `Comparison Basis`
- `Scan Runs Observed`, `Absent While Open (runs)`
- `Triage Score`, `Triage Reasons`
- `Family Multi-Run`

Legacy columns for proof completeness and family active/regressed are retained.

## Data model (durable recurrence)

On `canonical_findings`:

- `distinctScanRunsObserved`: number of **distinct** completed scan runs where a `SCAN_RECHECK` verification **failed** (fingerprint still observed) for this finding. Incremented once per scan run on first failed recheck in that run.
- `distinctScanRunsAbsentWhenOpen`: distinct completed scan runs where finalize created a **passed** recheck with `metadata.reason = fingerprint_absent_from_scan` while workflow status was still an “open backlog” status (not resolved/mitigated/false positive/won’t fix). Incremented once per scan run on first such row.

These counters are **backfilled** from `finding_verification_runs` for automated scan findings where the SQL predicates apply; historical rows may use **current** workflow status as a proxy for the absent-while-open dimension where status-at-run was not stored.

## Canonical contracts

- Per-finding proof / comparison contract: `apps/web/src/lib/findings/proof-summary.ts`
- Recurring-family contract: `apps/web/src/lib/findings/family-summary.ts`
- Deterministic triage helper: `apps/web/src/lib/findings/finding-priority.ts`

If another page needs family or proof semantics, it should consume these contracts rather than reconstructing interpretation locally.

## Known limitations (explicit)

- Family grouping is keyed by `ruleId`; it does not yet cluster by richer normalized signatures across rule variants.
- Fingerprint identity is engine-defined; DOM or selector drift can split or merge what operators consider “the same” issue.
- `distinctScanRunsAbsentWhenOpen` is only meaningful for automated scan findings and open-backlog workflow states at finalize time.
- CSV remains a flat artifact; it does not include nested evidence records.
- No automated buyer-facing PDF narrative layer exists yet; reports are factual data exports.
