# Platform / deployment truth for routes

## Source of truth

`@aros/core-services` `collectPlatformHealth(prisma)` produces `PlatformHealthReport` (real checks: Postgres, Redis, env validation, worker heartbeat, queue pressure, per-service views).

## Route projection

`buildRoutePlatformTruth(report)` in `@aros/core-services` derives **`RoutePlatformTruth`** — a small, stable shape for layouts and pages:

| Field | Purpose |
| --- | --- |
| `shellBlocker` | `none` \| `critical_dependency_down` \| `install_required` \| `deployment_misconfigured` |
| `allowOrgScopedDbReads` | When false, routes should not assume Prisma org reads are meaningful (DB or session path broken). |
| `readiness` / `installed` | From bootstrap + critical services (same semantics as health report). |
| `userImpactSummary` | Short, user-safe bullet lines (no env keys, hosts, secrets). |
| `operatorRemediationHints` | More specific hints for operators (still no secret values). |
| `flags` | Booleans: DB, Redis, session, env, worker, pipelines. |
| `optionalSubsystemIssues` | Names of optional integrations that are down/misconfigured. |

## UI semantics

- **Blocked shell** (`shellBlocker !== 'none'`): `PlatformShellBanner` in the dashboard layout explains impact; individual routes still render explicit states instead of blank screens.
- **Degraded but usable** (`readiness === 'degraded'` or worker down): `TopBar` shows a compact line; pages may add contextual warnings (e.g. dashboard + worker).
- **Empty vs error**: Use `RouteReliabilityNotice` + copy that states “no data yet / no membership / query failed” distinctly.

## API

`GET /api/org/:organizationId/platform/health` returns `getPlatformHealthPayload()` including `routePlatformTruth` alongside the full report (authorized operators only).

## Local degraded testing

1. Run stack: `docker compose up -d`, `.env` with `DATABASE_URL`, `REDIS_URL`.
2. Stop Postgres or Redis and reload a dashboard route — expect shell banner + `platform_blocked` or error notices, not opaque 500s.
3. Stop worker — expect “Platform degraded” in the top bar and worker messaging on the dashboard.
