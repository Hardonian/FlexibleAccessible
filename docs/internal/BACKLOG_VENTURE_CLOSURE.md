# Backlog — venture closure (prioritized themes)

**Last updated:** 2026-04-07. **Classification:** L = launch-critical, R = revenue-critical, T = trust-critical, V = leverage, M = moat, X = maintenance.

| Priority | ID | Theme | Class | Status |
|----------|-----|-------|-------|--------|
| P0 | B1 | Metered export / proof volume if tied to pricing | R | **Done** — `UsageRecord` + billing UI (`report.export`, `report.vpat_export`) |
| P0 | B2 | Grace-period UX copy unified on every entitlement wall | T/R | **Done** — `entitlementRecoveryHints` + `EntitlementWall` |
| P1 | B3 | SSO / enterprise identity | R/V | **Done (OIDC v1)** — `docs/SECURITY_ENTERPRISE_SSO_OIDC.md`, `/api/auth/oidc/*` |
| P1 | B4 | Buyer-grade audit log export API | T/M | **Done** — `/api/org/[organizationId]/audit-log` |
| P1 | B5 | Status page + incident comms template wired to real uptime | T | **Done** — `/status` + `/api/health?detailed=true` + `INCIDENT_COMMUNICATION_TEMPLATE.md` |
| P2 | B6 | Case study template filled with first redacted pilot | V | **Synthetic sample** — `docs/templates/CASE_STUDY_FILLED_SYNTHETIC_DEMO.md` (replace with real customer) |
| P2 | B7 | Rate limit dashboard for operators | X | **Done** — System page BullMQ table + Redis/fallback note |
| P3 | B8 | Plugin / extensibility for custom checks | M | **PRD** — `docs/internal/PRD_PLUGIN_EXTENSIBILITY.md` (implementation backlog) |

## Pressure test (why B1–B2 first)

- **B1** protects margin if exports become heavy.
- **B2** reduces churn and support tickets when Stripe states transition.
