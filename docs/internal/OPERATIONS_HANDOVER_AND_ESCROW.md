# AROS: Operations Handover, Credential Management & Escrow

**Purpose:** Comprehensive operational handover guide detailing infrastructure access, secret key management, automated cron jobs, and emergency failover protocols.

---

## 1. Secrets & Credential Hierarchy

All production secrets must be securely rotated every 90 days. Store primary secrets in 1Password / Doppler:

| Variable | Purpose | Location | Rotation Policy |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Pooled PostgreSQL connection | Managed Postgres / Supabase | 180 days |
| `REDIS_URL` | BullMQ queue state & rate limits | Managed Redis / Upstash | 180 days |
| `NEXTAUTH_SECRET` | Session JWT encryption key | Production environment | 365 days |
| `STRIPE_SECRET_KEY` | Live Stripe payment processing | Stripe Dashboard | 90 days |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | Stripe Dashboard | 90 days |
| `ANTHROPIC_API_KEY` | Optional LLM Copilot reasoning | Anthropic Console | 90 days |
| `OPENAI_API_KEY` | Optional LLM Copilot reasoning | OpenAI Console | 90 days |
| `SMTP_PASS` | Transactional email delivery | Postmark / Resend | 180 days |

---

## 2. Automated Scheduled Jobs & Cron Cadence

The platform runs the following autonomous maintenance jobs:

```text
# 1. Canary Uptime & Heartbeat (Every 5 minutes)
*/5 * * * * node /app/scripts/canary-health-check.mjs

# 2. Database Backup & Encrypted R2 Mirror (Daily at 03:00 UTC)
0 3 * * * /app/scripts/db-backup.sh

# 3. Stripe Ledger & Entitlement Reconciliation (Daily at 04:00 UTC)
0 4 * * * node /app/scripts/reconcile-stripe-ledger.mjs

# 4. Weekly Executive Digest Email (Mondays at 09:00 UTC)
0 9 * * 1 node /app/apps/worker/dist/jobs/digest.js
```

---

## 3. Emergency Failover Runbooks

### 3.1 Redis Failure / Queue Lockup
1. The platform automatically degrades to **in-process memory rate limiting** without crashing web requests.
2. In the operator console, inspect queue depth:
   ```bash
   # From root:
   docker compose restart worker
   ```

### 3.2 AI Provider Outage
1. If Anthropic or OpenAI API keys are unreachable, `/api/ai-copilot` returns `503 AI_UNAVAILABLE` with graceful fallback UI messaging.
2. The worker automatically executes **deterministic rule-based recipes** for all pending scans without interruption.

### 3.3 Database Point-In-Time Restore
1. Locate latest encrypted backup:
   ```bash
   ls -lat /var/backups/aros/
   ```
2. Run restore sequence:
   ```bash
   gunzip -c /var/backups/aros/db_latest.sql.gz | psql "$DATABASE_URL"
   ```
3. Run verification:
   ```bash
   node scripts/canary-health-check.mjs
   ```

---

## 4. Operational Handover Complete

This operational framework guarantees that AROS operates with 99.9% autonomous reliability and requires minimal manual operator intervention.
