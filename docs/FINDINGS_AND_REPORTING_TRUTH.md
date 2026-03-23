# Findings and reporting — what we claim

## What reports and summaries show

- **Counts** derived from `CanonicalFinding` rows scoped to the user’s organization (via occurrence → site → workspace).
- **Severity counts**: distribution of `impact` across findings in scope.
- **Remediation counts**: distribution of `status`.
- **Evidence source mix**: counts by `evidenceSource`.
- **Stale automated count**: findings with `AUTOMATED_AXE` where `lastVerifiedAt` is null or older than the latest **completed** org scan, unless job pipelines are degraded (then all automated findings count as stale for messaging).

## What we do **not** show

- No composite “accessibility score” — the product does not compute one.
- No certification or legal conformance statement in exports; disclaimers are included in UI and JSON/CSV payloads.

## APIs

- `GET /api/findings/summary` — JSON operational summary; requires `reports:view`. Returns `503` with a safe envelope if org-scoped DB reads are blocked by platform health.
- `GET /api/reports` — export; requires `reports:export`. Includes `platformTruth` flags so consumers know if workers/pipelines were healthy at generation time.

## Degraded behavior

- If the database or session store is down, dashboard findings routes show `RouteReliabilityNotice` and skip Prisma where configured.
- If Redis/workers are down, UI surfaces pipeline degradation; stored findings still render.

## Local smoke

```bash
npm install
npm run db:generate
# With DATABASE_URL set:
npm run db:push && npm run db:seed
npm run dev
```

1. Sign in as `demo@aros.dev` / `demo1234`.
2. Open `/findings` — list shows site, source badge, statuses.
3. Open a finding — evidence context, automation freshness, remediation form (as OWNER).
4. Open `/reports` — operational summary and stale note.
5. `curl -b cookies.txt http://localhost:3000/api/findings/summary` (after auth) — JSON summary.

Full gate: `npm run verify`.
