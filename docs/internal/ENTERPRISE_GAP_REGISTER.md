# Enterprise gap register (product vs common enterprise asks)

**Last updated:** 2026-04-07. **Purpose:** honest pre-sales checklist; “gap” means not guaranteed by default self-serve product.

| Ask | Status in current codebase | Path to close |
|-----|----------------------------|---------------|
| SSO (SAML / OIDC) | **OIDC (OAuth2 code + id_token) shipped** — optional via env; see `docs/SECURITY_ENTERPRISE_SSO_OIDC.md`. SAML requires IdP bridge or separate work. | Configure IdP + env; SAML via gateway if needed |
| Fine-grained audit log export | **Shipped:** `GET /api/org/{id}/audit-log` (paid + `audit:view`), JSON/CSV; retention is DB-defined | Policy + customer comms |
| Data residency choice | Single-tenant DB implied by deployment model; not a UI toggle | Contract + infra per region |
| Custom MSA / DPA | Legal process outside repo | Legal |
| 24/7 support with SLA | Not implied by app | Written add-on (see offers doc) |
| On-prem / air-gapped | Worker + DB deployable; not packaged as appliance | Services engagement |
| SCIM provisioning | Not listed in RBAC docs as automated | Backlog |
| Pen test / SOC2 report | Security page may reference posture; formal attestation is external | Trust pack + vendor |
| Volume pricing / private limits | Enterprise tier in `PLANS`; overrides via Stripe/contract | Sales + billing |

Use this table in discovery so procurement gets **explicit** yes/no instead of assumed enterprise readiness.
