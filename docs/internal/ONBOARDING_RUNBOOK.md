# FlexibleAccessible onboarding runbook (operator-first)

Last updated: 2026-04-03.

## Objective

Get a new workspace from account creation to first meaningful proof artifact with no hidden prerequisites.

## Deterministic path

1. **Auth + org membership**
   - User signs in.
   - Dashboard resolves organization membership via scoped boundary checks.
   - If membership missing, UI shows explicit blocked state.
2. **Add first site**
   - Operator uses `/sites/new`.
   - Validation errors are rendered with accessible labels and state.
3. **Run crawl / scan**
   - Operator triggers crawl or scan from site detail.
   - If queue/worker degraded, route reliability notices and operator hints appear.
4. **Triage findings**
   - Findings list shows severity, truth status, freshness, proof completeness, and family-level counts.
5. **Export proofpack**
   - Paid orgs can call `/api/reports` for JSON/CSV export including proof summary and lineage.

## Explicit degraded states that must remain visible

- Platform blocked (database/session unavailable).
- Organization context resolution failure.
- Worker/queue degradation (automation freshness degraded).
- No scans or no findings yet.

## Support handoff checklist

- Confirm `organizationId`, `siteId`, and most recent `scanRunId`.
- Capture screenshot of findings row badges (freshness + completeness + change state).
- Confirm billing entitlement reason when paid features are blocked.
