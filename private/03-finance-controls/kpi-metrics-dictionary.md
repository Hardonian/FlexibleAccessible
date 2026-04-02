# KPI & Metrics Dictionary

**Status:** RECOMMENDED  
**Purpose:** Define operational and commercial metrics with clear data ownership.  
**Scope:** Revenue, activation, retention, reliability, support.

## Metric Dictionary
| Metric | Definition | Source | Cadence | Status |
|---|---|---|---|---|
| Paid Orgs | Count of orgs with non-free, active subscription | `subscription` table | Weekly/Monthly | CURRENT STATE |
| Free→Paid Conversion | % orgs upgraded within X days of signup | signup + subscription timestamps | Monthly | RECOMMENDED |
| Activation Rate | % new orgs reaching first successful private scan within 7 days | crawl/scan runs by org | Weekly | RECOMMENDED |
| Scan Limit Hit Rate | % orgs blocked by monthly scan cap | enqueue failure outcomes | Weekly | CURRENT STATE/PARTIAL |
| AI Adoption Rate | % paid orgs invoking AI copilot at least once/month | ai usage logs | Monthly | PARTIAL (token precision gap) |
| Churn Rate (logo) | Paid org cancellations / opening paid orgs | subscription status transitions | Monthly | RECOMMENDED |
| Failed Payment Recovery Rate | recovered past-due orgs / past-due orgs | subscription statuses + billing events | Monthly | RECOMMENDED |
| Support SLA Attainment | tickets within response targets by severity | support tracker | Weekly | FUTURE (needs tooling discipline) |
| Gross Margin Proxy | (Revenue - direct infra/AI/service delivery costs) / Revenue | finance exports | Monthly | REQUIRES EXTERNAL REVIEW |

## Dashboard Specification (Founder pack)
- Revenue snapshot: new, expansion, churn, net.
- Funnel: signups → first value milestone → paid conversion.
- Risk panel: past_due count, webhook failures, reconciliation exceptions.
- Service load: onboarding hours per active paid org.

## Caveats
- CAC/LTV/payback are assumptions until spend attribution and cohort retention are instrumented.
