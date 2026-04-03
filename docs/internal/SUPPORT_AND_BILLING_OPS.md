# Support + billing operations guide

Last updated: 2026-04-03.

## Triage order for “feature blocked” tickets

1. **Authz check**: user role has permission for route/action.
2. **Entitlement check**: server-side `requirePaid` gate decision and reason.
3. **Subscription state**: status, period end, cancel-at-period-end.
4. **Platform reliability**: job pipeline health and worker status.

Never resolve a ticket as “UI bug” until these server truth checks pass.

## Common operator questions

### “Why can’t I export reports?”

- Verify route is `/api/reports` and returns 403 with entitlement reason when unpaid.
- Direct operator to billing settings where plan status and limits are visible.

### “Why does evidence look stale?”

- Check findings freshness badge conditions:
  - newer completed scan exists
  - pipelines unhealthy
  - missing verification timestamps

### “Why did an issue come back?”

- Use finding proof summary `changedSinceLastRun = regressed`.
- Confirm `reopenedCount` and recent verification run outcomes.

## Billing incident runbook

1. Snapshot subscription row (`plan`, `status`, limits, period end).
2. Replay latest Stripe webhook event in staging if mismatch is suspected.
3. Re-check protected route with same org context.
4. Document entitlement reason and next operator action in ticket.
