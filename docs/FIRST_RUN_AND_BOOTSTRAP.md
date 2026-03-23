# First run and bootstrap

## What “installed” means

`PlatformState` (singleton id `platform`) must exist in PostgreSQL. The seed and `npm run bootstrap` (packages/db `ensure-platform.ts`) create this row.

## Setup checklist (in product)

The `/system` page shows **`deriveSetupChecklist(report)`**: ordered steps (database, env validation, platform row, Redis, workers, optional integrations). Blocking vs non-blocking is explicit.

## When readiness is not `ready`

- **`not_installed`**: no `PlatformState` row — run migrations, seed, and/or `npm run bootstrap`.
- **`blocked`**: a critical service or dependency is failed/unavailable/misconfigured — see diagnostics and dependency rows on `/system`.
- **`degraded`**: non-fatal pressure (for example optional integrations or elevated failed job counts) — see warnings.

## Recheck

Operators with `org:system:manage` can call **`POST /api/org/:organizationId/platform/recheck`**, which re-runs `collectPlatformHealth` synchronously and returns the full payload. There is no fake async “healing” job.
