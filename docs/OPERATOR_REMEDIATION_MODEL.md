# Operator remediation model

## Diagnostic layer

`derivePlatformDiagnostics(report, parsedFlags)` in `@aros/core-services` builds **`PlatformDiagnosticIssue[]`** from the same `PlatformHealthReport` produced by `collectPlatformHealth`. It is not hand-maintained marketing copy.

Each issue includes:

- Stable `id` (for acknowledgements) and `code`
- `severity`, `stateCategory`, `blocksReadiness`
- User and operator impact strings
- `recommendedNextStep` (aligned with service `nextStep` where applicable)
- `remediationType`, `fixInProduct`, `requiresDeployOrInfra`, `retrySafe`, `whoShouldAct`
- `evidence` (non-secret strings only)
- `acknowledged` / `suppressedFromBanner` from `PlatformState.productFlags`

Dependency failures (Postgres, Redis, session stack) emit **`dep:*`** issues so they are not duplicated on individual service cards.

## Control plane summary

`ControlPlaneSummary` buckets issues into critical blockers, recoverable/high, warnings, optional, and acknowledged — used on `/system`.

## Adding a new actionable diagnostic

1. Register the service in `CORE_SERVICES` and implement checks in `collectPlatformHealth` (`orchestrator.ts`).
2. If the failure mode is a raw dependency, prefer a `dep:*` issue in `dependencyIssues()` inside `operator-diagnostics.ts` **or** skip duplicate service rows via the early-return guards in `issueFromService`.
3. Tune `remediationForService` if the default classification is wrong for the new id.
