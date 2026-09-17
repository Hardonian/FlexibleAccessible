# AROS: Solo Founder 15-Minute Daily Operating Cadence

How to operate AROS smoothly as a solo founder, maintaining 99.9% uptime, rapid customer onboarding, and high retention with minimal daily time investment.

---

## 1. Daily 15-Minute Routine

### Minutes 0–5: Platform & Queue Telemetry

1. Open `/system/operator` on your dashboard:
   - Check **Worker Queues**: Ensure `active` and `waiting` jobs are moving.
   - Check **Error Rates**: Look for any cluster of failed crawls (e.g. anti-bot blocking on target domains).
   - Check **Health Status**: Confirm Postgres pool latency is `< 50ms` and Redis memory is `< 80%`.

2. Check automated alerts in your Discord/Slack channel (sent via `scripts/canary-health-check.mjs`).

---

### Minutes 5–10: Inbound Pipeline & Lead Follow-Up

1. Review inbound leads captured from the home page and public scan tool:
   - Check webhook alerts or logs: `[LEAD_CAPTURED]`.

2. Identify high-value domains:
   - If a target company (Series A+, high-traffic SaaS, or public company) ran a public scan, review their generated report at `/scan/[domain]`.
   - Send the **1-Click Executive Outreach Email** (see `PUBLIC_SCAN_VIRAL_CONVERSION_PLAYBOOK.md`).

---

### Minutes 10–15: Customer Success & Churn Defense

1. Review customer feedback logged in `/stakeholders`:
   - Check feedback queue and stakeholder sentiment scores.

2. Check Stripe Dashboard for failed charges:
   - AROS includes built-in entitlement grace periods with recovery hints, but sending a quick 1-line email prevents involuntary churn:
   > *"Hey [Name], noticed your card was declined on Stripe. We kept your scans active for 7 days so your CI/CD pipeline doesn't break. You can update your payment method here: [Billing Link]"*

---

## 2. Weekly Maintenance (30 Minutes on Mondays)

1. **Prisma & Package Updates**:
   - Run `npm audit` and `npm outdated` to check for security vulnerabilities.

2. **Database Backup Verification**:
   - Verify that `scripts/db-backup.sh` generated fresh dumps in S3/R2.
   - Download the latest dump and verify it can restore into a local test container (`docker compose up -d`).

3. **AI Cost & Margin Audit**:
   - Check Anthropic and OpenAI dashboards.
   - Target AI API spend: `< 5%` of monthly recurring revenue (MRR). AROS achieves this by caching deterministic recipes in PostgreSQL and clustering duplicate defects.

---

## 3. High-Leverage Automations Configured

- **Self-Healing Public Scans**: Rate limits (300s window) prevent scraping abuse while returning cached results instantly.
- **Resilient Lead Fallback**: Inbound demo requests and leads are never dropped even if external CRM endpoints are unreachable.
- **Automated Live SVG Badges**: Embeddable badges in `/api/badge?domain=...` dynamically reflect current compliance status without manual intervention.
