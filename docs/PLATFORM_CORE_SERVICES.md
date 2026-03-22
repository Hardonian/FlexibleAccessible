# Platform core services (AROS)

This document matches the code in `@aros/core-services`, not aspirational architecture.

## Canonical service registry

Services are defined in `packages/core-services/src/registry.ts`. Runtime state is computed in `collectPlatformHealth()` (`orchestrator.ts`) from:

- PostgreSQL (`$queryRaw` ping + `platform_state` row)
- Redis (`PING` + BullMQ queue job counts for `crawl`, `scan`, `cluster`, `remediation`)
- Process environment (`parseEnvDiagnostics` — **no secret values** in summaries)
- Worker liveness (`platform_state.workerLastHeartbeatAt`, updated every 30s by `apps/worker`)

States are explicit: `unavailable`, `disabled`, `misconfigured`, `ready`, `running`, `degraded`, `failed`.

## Configuration lifecycle

| Layer | Mechanism |
| --- | --- |
| Deploy/runtime env | `packages/config/src/env.ts` (`envSchema`, `getEnv()`, `parseEnvDiagnostics`) |
| Install marker | `platform_state` singleton row (id `platform`) |
| Mutable product flags | `platform_state.productFlags` (JSON, non-secret; extend as needed) |

Root scripts:

- `npm run db:migrate` — apply Prisma migrations (includes `platform_state`)
- `npm run db:seed` — demo data **and** ensures `platform_state` exists
- `npm run bootstrap` — idempotent `platform_state` upsert only (`packages/db/scripts/ensure-platform.ts`)

## Health endpoints

- `GET /api/health` — **unauthenticated** coarse readiness for load balancers; **503** when DB/Redis/session prerequisites or worker/pipelines checks fail. No env keys or secrets.
- `GET /api/org/:organizationId/platform/health` — full operator JSON; requires session + `org:system:view` (OWNER/ADMIN).

## Operator UI

- Route: `/system` (dashboard layout). Visible in the sidebar only if the user has `org:system:view`.

## Worker heartbeat

`apps/worker` calls `recordWorkerHeartbeat(prisma)` on startup and every 30 seconds. If the row is missing, the upsert creates it (bootstrap version 1).

## Adding a service

1. Add a row to `CORE_SERVICES` in `registry.ts`.
2. Extend the `switch` in `orchestrator.ts` with real checks (or map to existing dependency checks).
3. Adjust `toPublicHealthSummary` if the new service should affect public readiness.
4. Add tests under `packages/core-services/src/*.test.ts`.

## Verification

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

With Docker Postgres/Redis and a valid `.env`, run `npm run db:migrate`, `npm run db:seed`, `npm run dev` and `npm run dev:worker`, then open `/system` as an admin.
