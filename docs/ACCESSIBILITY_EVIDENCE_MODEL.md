# Accessibility evidence model (AROS)

This document describes what the product **actually stores** today. It is not a compliance certification.

## Layers

1. **Scan run** (`ScanRun`): one execution of the automated scanner for a site. Has `status` (`PENDING` | `RUNNING` | `COMPLETED` | `FAILED`), timestamps, and counters.
2. **Raw violation** (`RawViolation`): one axe rule hit on one page inside a scan. Stores selector, HTML snippet, WCAG tags, fingerprint, optional failure summary (`elementContext`).
3. **Canonical finding** (`CanonicalFinding`): deduplicated finding per site fingerprint (rule + selector signature + element shape). Aggregates occurrence count and remediation state.
4. **Finding occurrence** (`FindingOccurrence`): one row per (canonical finding, page). Links to the latest raw row via `lastRawViolationId` for evidence drill-down.

## Evidence source

`CanonicalFinding.evidenceSource`:

- `AUTOMATED_AXE` — produced by the worker scan job (axe-core).
- `MANUAL_REVIEW` — reserved for human-entered or review-backed findings (not yet written by default flows).
- `IMPORTED` — reserved for external imports.

Automated findings set `lastVerifiedAt` and `lastScanRunId` when the worker records a hit.

## Severity and “confidence”

- **Severity** (`impact`): mapped from axe impact (`CRITICAL` | `SERIOUS` | `MODERATE` | `MINOR`). This is scanner-reported, not a legal severity.
- **Confidence** on remediation *suggestions* is a separate float on `RemediationSuggestion`, not on the finding itself. Do not treat suggestion confidence as WCAG certainty.

## Stale vs current (automated only)

For `evidenceSource === AUTOMATED_AXE`, the UI compares `lastVerifiedAt` to the latest **completed** `ScanRun` in the organization. If a newer completed scan exists, automated evidence is labeled **stale** until this finding is touched again by a scan. If job pipelines are degraded, evidence is treated as potentially stale.

Manual/imported findings do not use this comparison.

## Adding a new scanner

1. Write violations into `RawViolation` (or a parallel table if the shape differs materially).
2. Upsert `CanonicalFinding` with a stable `fingerprint` and set `evidenceSource` to a distinct enum value (extend `EvidenceSource` in Prisma if needed).
3. Upsert `FindingOccurrence` with `@@unique([canonicalFindingId, pageId])`.
4. Update worker health / pipeline messaging if the scanner depends on optional services.

Verification: `npm run db:generate`, run worker scan job against a test site, confirm list/detail show source and raw linkage.
