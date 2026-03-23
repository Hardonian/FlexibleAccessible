# Remediation lifecycle

## States (`FindingStatus`)

| State | Meaning |
|-------|--------|
| `OPEN` | Active; needs triage or fix. |
| `ACKNOWLEDGED` | Seen; not necessarily fixed. |
| `IN_PROGRESS` | Work underway. |
| `RESOLVED` | Operator believes fixed; may reopen on automated re-detection. |
| `MITIGATED` | Risk reduced but not eliminated; may reopen on automated re-detection. |
| `FALSE_POSITIVE` | Not a real issue; **not** reopened automatically by scans. |
| `WONT_FIX` | Accepted risk; **not** reopened automatically by scans. |

Allowed operator transitions are enforced in `@aros/shared` (`canOperatorTransition`) and the server (`transitionFindingRemediationStatus`). `FALSE_POSITIVE` and `WONT_FIX` only transition to `OPEN` or `ACKNOWLEDGED` without an intermediate step.

## Who can change status

- Members with `findings:manage` (see `packages/config/src/permissions.ts`).
- The server action scopes the finding to the user’s organization via occurrences → page → site → workspace.

## Audit trail

Each successful transition appends:

1. `FindingStatusEvent` (append-only): `fromStatus`, `toStatus`, optional `note`, `userId`, `createdAt`.
2. `AuditLog` row: `finding.status_changed` with metadata `{ fromStatus, toStatus, siteId }`.

Historical raw violations are **not** deleted when status changes.

## Reopen on recheck

When the scan worker sees an existing fingerprint again:

- If status is `RESOLVED` or `MITIGATED`, it sets status to `OPEN` and increments `reopenedCount`.
- If status is `FALSE_POSITIVE` or `WONT_FIX`, status is unchanged.

## Optional note

Operators can attach a short `statusNote` on the finding detail form. It is updated when a transition is submitted with a note.

## Verification

- Unit: `packages/shared/src/__tests__/finding-lifecycle.test.ts`, `apps/web/src/lib/findings/remediation-server.test.ts`
- E2E (with DB seed): `npm run test:e2e --workspace=apps/web` (includes `e2e/findings-workflow.spec.ts` when data exists)
