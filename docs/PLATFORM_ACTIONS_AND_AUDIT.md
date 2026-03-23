# Platform actions and audit

## Permissions

| Capability | Permission |
| --- | --- |
| View `/system`, `GET .../platform/health` | `org:system:view` (OWNER, ADMIN) |
| Recheck, acknowledge, operator preferences | `org:system:manage` (OWNER, ADMIN) |

## Endpoints

- `POST /api/org/:organizationId/platform/recheck` — synchronous health refresh; audits `platform.recheck`.
- `POST /api/org/:organizationId/platform/acknowledge` — body `{ issueId }`; validates id against current diagnostics; audits `platform.issue.acknowledged`.
- `PATCH /api/org/:organizationId/platform/operator-preferences` — body `{ suppressedOptionalDiagnosticIds: string[] }` (only `svc:<optionalServiceId>`); audits `platform.operator_prefs.updated`.

## Persistence

Acknowledgements and suppression lists live under **`PlatformState.productFlags`** (`operatorAcknowledgements`, `operatorPrefs`). This is **deployment-wide**, not per-organization — the audit log row is still scoped to the acting user’s organization for traceability.

## Audit metadata

`AuditLog.metadata` stores outcomes and non-secret fields only (issue ids, counts, readiness). Secret values and raw env are never written.

## Verification

```bash
npm run test --workspace=@aros/core-services
npm run test --workspace=@aros/web
npm run test:e2e --workspace=@aros/web
```
