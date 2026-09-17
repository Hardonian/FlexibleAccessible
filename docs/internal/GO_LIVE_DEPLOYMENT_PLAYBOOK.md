# AROS: Production Go-Live Deployment Playbook

A battle-tested, zero-downtime production deployment guide designed for solo founders and engineering operators.

---

## 1. Pre-Deployment Infrastructure Checklist

### 1.1 DNS & Domain Setup
- [ ] **Apex & Subdomains**: Point `aros.dev` and `www.aros.dev` to your server/load balancer (e.g. Cloudflare proxy enabled with Full/Strict SSL).
- [ ] **Security Headers**: Ensure HSTS, CSP (`script-src 'self' 'unsafe-eval'`), `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff` are enforced via Next.js middleware and CDN.
- [ ] **Email DNS**: Set SPF (`v=spf1 include:_spf.postmarkapp.com ~all`), DKIM, and DMARC (`v=DMARC1; p=reject`) to ensure transactional emails (password reset, email verification, scan reports) achieve 99%+ deliverability.

### 1.2 Managed Database & Redis Configuration
- [ ] **PostgreSQL**:
  - Version: PostgreSQL 16+.
  - Connection Pool: Use connection pooling (PgBouncer or Supabase/Neon connection pooler) with pool size 20–50.
  - Set `statement_timeout = 30000` (30s max query execution).
- [ ] **Redis**:
  - Memory policy: `maxmemory-policy allkeys-lru`.
  - Max memory: At least 512MB for BullMQ queue state and rate limit windows.
  - Persistence: AOF (`appendonly yes`) enabled to prevent job loss across worker restarts.

### 1.3 Production Environment Secrets (`.env`)
```bash
NODE_ENV=production
DATABASE_URL="postgresql://user:pass@host:5432/aros_prod?sslmode=require"
REDIS_URL="rediss://user:pass@host:6379"
NEXTAUTH_URL="https://aros.dev"
NEXTAUTH_SECRET="[generate-with-openssl-rand-base64-32]"

# Stripe Live
STRIPE_SECRET_KEY="sk_live_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
STRIPE_PRICE_STARTER="price_..."
STRIPE_PRICE_PROFESSIONAL="price_..."
STRIPE_PRICE_ENTERPRISE="price_..."

# AI Providers (LLM Copilot & Recipe Validation)
ANTHROPIC_API_KEY="sk-ant-..."
OPENAI_API_KEY="sk-proj-..."

# Transactional Delivery (Postmark / Resend / Sendgrid)
SMTP_HOST="smtp.postmarkapp.com"
SMTP_PORT=587
SMTP_USER="[postmark-server-token]"
SMTP_PASS="[postmark-server-token]"
EMAIL_FROM="notifications@aros.dev"

# Alerts & Inbound Lead Notifications
ALERT_WEBHOOK_URL="https://discord.com/api/webhooks/..."
LEAD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
```

---

## 2. Zero-Downtime Deployment Procedure

### Step 1: Preflight Verification
Run local quality gate before pushing to production:
```bash
npm run verify:core
npm run test:launch-critical
```

### Step 2: Database Migration
Apply schema changes safely without downtime:
```bash
npm run db:push
# or for strict migrations:
npx prisma migrate deploy --schema=packages/db/prisma/schema.prisma
```

### Step 3: Container Build & Service Start
Using Docker Compose:
```bash
docker compose -f docker/docker-compose.prod.yml pull
docker compose -f docker/docker-compose.prod.yml build --no-cache
docker compose -f docker/docker-compose.prod.yml up -d --remove-orphans
```

### Step 4: Verification & Smoke Testing
Run the canary monitor against your live production domain:
```bash
CANARY_TARGET_URL="https://aros.dev" node scripts/canary-health-check.mjs
```

---

## 3. Stripe Production Webhook Registration

Register the live webhook endpoint in the Stripe Dashboard:
- **Endpoint URL**: `https://aros.dev/api/webhooks/stripe`
- **Events to Listen To**:
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- Copy the signing secret (`whsec_...`) to `STRIPE_WEBHOOK_SECRET` on production.

---

## 4. Post-Launch Emergency Procedures

| Issue | Immediate Action |
| :--- | :--- |
| **Spike in Redis memory / BullMQ backlog** | Open `/system/operator`, check queue depths, scale worker concurrency or pause non-critical scheduled crawls. |
| **Worker crashing during heavy DOM crawls** | Worker concurrency defaults to 3; decrease `WORKER_CONCURRENCY=1` to reduce memory consumption on smaller VPS. |
| **AI rate limits reached** | AROS automatically falls back to deterministic rule-based recipes and cached patterns; review token usage in `/settings/api-keys/usage`. |
