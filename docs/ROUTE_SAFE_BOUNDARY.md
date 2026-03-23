# Route-safe data boundary (AROS web)

Dashboard routes should not duplicate ad hoc `try/catch` around membership and org-scoped Prisma calls. Use the shared boundary instead.

## Modules

- `apps/web/src/lib/platform-truth-cache.ts` — `getRoutePlatformTruth()`  
  React `cache()` wrapper around `collectPlatformHealth` + `buildRoutePlatformTruth` from `@aros/core-services`. One snapshot per request.

- `apps/web/src/lib/route-data-boundary.ts`  
  - `resolveDashboardOrgMembership(userId, truth)` — returns `ok | none | platform_blocked | error`. When `truth.allowOrgScopedDbReads` is false, **does not** query Prisma for membership (avoids cascading DB errors).  
  - `runOrgScopedQuery(ctx, fn)` — wraps org-scoped work in `{ ok, data } | { ok: false, message }` instead of throwing.

- `apps/web/src/components/reliability/*` — `PlatformShellBanner`, `RouteReliabilityNotice` for consistent copy and roles.

## How to add a new dashboard page

1. `const user = await requireSession()` (still throws `UNAUTHORIZED` for API handlers that catch it; pages should use `getSession` + redirect if you need softer behavior).
2. `const truth = await getRoutePlatformTruth()`.
3. `const orgRes = await resolveDashboardOrgMembership(user.id, truth)`.
4. Branch on `orgRes.kind`:
   - `platform_blocked` — render a clear message; do not query org data.
   - `error` — transient DB failure resolving membership.
   - `none` — legitimate “no org” (different from forbidden).
   - `ok` — pass `orgRes` to `runOrgScopedQuery` for counts/lists.

## Security

- Never skip org scoping in degraded paths. Use `runOrgScopedQuery` with queries filtered by `organizationId`.
- Finding detail and similar routes must scope by org (e.g. `findFirst` with `occurrences.some.site.workspace.organizationId`).
- Operator-only detail stays on `/system` and `org:system:view` APIs; shell banners use `audience: 'operator' | 'user'` for extra hints.

## Testing

- Unit: `apps/web/src/lib/route-data-boundary.test.ts`
- E2E: `apps/web/e2e/reliability.spec.ts` (requires `DATABASE_URL` + seed; Playwright global setup is `e2e/global-setup.mjs`)
