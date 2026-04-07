# Verification Gate Tiers

## Tier 1 — Core deterministic gate (`npm run verify:core`)

Runs in this exact order:
1. `npm run prisma:check` (fails if generated Prisma client is missing/drifted from `packages/db/prisma/schema.prisma`)
2. `npm run prisma:imports` (fails if any package/app imports `@prisma/client` directly outside `packages/db`)
3. `npm run lint` (workspace lint, warnings allowed)
4. `npm run typecheck` (workspace typecheck)
5. `npm run test` (workspace unit tests; `apps/web` excludes `*.integration.test.ts`)
6. `npm run build` (production web build)

## Tier 2 — Release gate (`npm run verify:release`)

Includes Tier 1 and adds release-blocking tenant isolation + launch-critical truth checks + env-bound integration tests:
- `npm run verify:tenant-boundary` (fails if critical server entrypoints regress with tenant-boundary lint violations, including high-risk dashboard server actions listed in `scripts/check-tenant-boundary-critical.mjs`)
- `npm run test:launch-critical` (targeted suites for public-scan validity/expiry truth and canonical org-boundary regression checks on critical routes)
- `npm run test:integration` (currently `apps/web` Vitest integration suite)

## Tier 3 — Browser/system gate (CI + optional local)

Not included in `verify`:
- `npm run test:e2e` (Playwright requires browser + seeded DB/Redis + app runtime)

## Notes

- `npm run verify` maps to Tier 1 to keep deterministic local checks fast and explicit.
- CI (`.github/workflows/ci.yml`) runs Tier 2 (`npm run verify:release`) and then Tier 3 (`npm run test:e2e`).
