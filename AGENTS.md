# AGENTS.md

## Repository: AROS (Accessibility Remediation OS)

This is an npm **workspaces** monorepo (not pnpm). Core apps and packages live under `apps/` and `packages/`.

### AI and accessibility governance

Before changing AI-assisted remediation, recommendations, or compliance-facing copy, read [`docs/AI_ACCESSIBILITY_OPERATING_RULES.md`](docs/AI_ACCESSIBILITY_OPERATING_RULES.md). Evidence-backed workflow wins over impressive model output; raw LLM output must not reach users without schema validation and traceability.

### Prerequisites

- Node.js >= 20
- Docker (for local PostgreSQL + Redis via `docker/docker-compose.yml`)
- Playwright browsers for E2E: `cd apps/web && npx playwright install chromium`

### Install

```bash
npm install
npm run db:generate
```

### Local infrastructure

```bash
docker compose -f docker/docker-compose.yml up -d
# or from repo root:
docker compose up -d
```

Copy `.env.example` to `.env` and set secrets (especially `DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_SECRET`).

### Database

```bash
npm run db:push    # dev schema sync
npm run db:seed    # demo user + sample data
```

### Development

```bash
npm run dev           # Next.js app (apps/web)
npm run dev:worker    # BullMQ workers (apps/worker) — requires Redis
```

### Quality gate

```bash
npm run verify        # lint + typecheck + test + build
npm run lint
npm run typecheck
npm run test
npm run test:e2e      # Playwright (apps/web); global setup runs db:push + db:seed (needs DATABASE_URL)
npm run build
npm run build:worker  # tsc for worker (production worker uses tsx src/index.ts)
```

### Worker runtime note

`@aros/shared` and `@aros/db` resolve to TypeScript sources via workspace `main`. Production worker entry is `tsx src/index.ts` so Node does not need precompiled package `.js` files.

### Stripe webhook tests

With `DATABASE_URL` set, `npm run test --workspace=apps/web` runs integration tests against `handleStripeWebhookRequest` (subscription updated/deleted, idempotency, signature verification). Set `STRIPE_WEBHOOK_SECRET` in CI to match the test secret.

### CI

GitHub Actions runs install, Prisma generate, `db push`, **db seed**, unit tests (including Stripe webhook integration when DB is up), Playwright Chromium install, production build, and E2E (marketing + **auth flows** using seeded `demo@aros.dev`) against Postgres + Redis services.
