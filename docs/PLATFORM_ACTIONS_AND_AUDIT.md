# Platform actions and audit

## Permissions

| Capability | Permission |
| --- | --- |
| View `/system`, `GET .../platform/health` | `org:system:view` (OWNER, ADMIN) |
| Recheck, acknowledge, operator preferences, legacy backfill | `org:system:manage` (OWNER, ADMIN) |

## Endpoints

- `POST /api/org/:organizationId/platform/recheck` — synchronous health refresh; audits `platform.recheck`.
- `POST /api/org/:organizationId/platform/acknowledge` — body `{ issueId }`; validates id against current diagnostics; audits `platform.issue.acknowledged`.
- `PATCH /api/org/:organizationId/platform/operator-preferences` — body `{ suppressedOptionalDiagnosticIds: string[] }` (only `svc:<optionalServiceId>`); writes organization-scoped keys; audits `platform.operator_prefs.updated`.
- `POST /api/org/:organizationId/platform/repair-legacy-flags` — copies legacy deployment-wide operator flags into this org namespace when fallback mode is active; audits `platform.legacy_flags.fallback_detected` and `platform.legacy_flags.backfill`.

## Persistence

Operator preferences and acknowledgements are stored in `PlatformState.productFlags` under organization keys (`operatorPrefsByOrg`, `operatorAcknowledgementsByOrg`).

Legacy deployment-wide keys (`operatorPrefs`, `operatorAcknowledgements`) are still read **only as compatibility fallback** when no org-scoped entry exists for the current organization. The health payload exposes fallback state via `operatorFlagsStatus`, and operators can retire it with the repair endpoint.

## Audit metadata

`AuditLog.metadata` stores outcomes and non-secret fields only (issue ids, counts, readiness, backfill status/source). Secret values and raw env are never written.

## Verification

```bash
npm run test --workspace=@aros/core-services
npm run test --workspace=@aros/web
npm run test:e2e --workspace=@aros/web
```
