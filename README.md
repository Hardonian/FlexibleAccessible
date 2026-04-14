# AccessibleMadeFlexible

**Accessibility operations and evidence—not vanity scores.**

A production-ready multi-tenant SaaS platform for continuous accessibility issue discovery, scanning, clustering, and source-level remediation. Built on the AROS engine (internal: *Accessibility Remediation OS*).

> **Brand note:** The public product name is **AccessibleMadeFlexible**. Internal packages use the `@aros/*` scope (AROS engine). The repository directory name (`FlexibleAccessible`) reflects the original working title; the canonical brand is AccessibleMadeFlexible going forward.

## What This Is

AccessibleMadeFlexible is a browser-rendered accessibility operations platform that:

- **Crawls** websites using real Playwright browser automation
- **Scans** rendered pages with axe-core for accessibility violations
- **Normalizes** findings into deduplicated, fingerprinted canonical issues
- **Clusters** repeated violations by component pattern (e.g., "Header nav button issue on 1,842 pages")
- **Generates** AI-assisted remediation suggestions with rationale and confidence scores
- **Validates** suggestions through safety checks before export
- **Routes** non-automatable criteria to human review queues
- **Exports** fixes as code snippets, GitHub PRs, or Jira tickets
- **Reports** evidence-grade conformance documentation

## What This Is NOT

- An accessibility overlay or floating widget
- A "one-click compliance" tool
- A score-only dashboard
- A product that claims guaranteed WCAG conformance

## Brand Assets

The `AccessibleMadeFlexible` brand asset package lives at:

```
apps/web/public/brand/accessiblemadeflexible/
  mark.svg                — standalone brand mark (transparent background)
  logo-horizontal.svg     — horizontal logo: mark + wordmark
  logo-stacked.svg        — stacked wordmark
  logo-dark.svg           — dark-background horizontal variant
  favicon.svg             — SVG favicon source
  favicon-16.png          — 16×16 favicon
  favicon-32.png          — 32×32 favicon (also /public/favicon.ico)
  favicon-48.png          — 48×48 favicon
  apple-touch-icon.png    — 180×180 iOS home screen icon
  favicon-192.png         — 192×192 PWA icon
  favicon-512.png         — 512×512 PWA icon
  og-1200x630.svg         — social share / OG banner source
  repo-header-1500x500.svg — GitHub / repo social header
```

Icons are regenerated from SVG source via:
```bash
npm run icons   # in apps/web
```

## Quick Start

### Prerequisites

- Node.js >= 20
- Docker (for PostgreSQL and Redis)
- npm (workspaces monorepo)

### Setup

```bash
# Run setup script (starts Docker services, installs deps, seeds DB)
./scripts/setup.sh

# Or manually:
docker compose up -d
# (equivalent: docker compose -f docker/docker-compose.yml up -d)
npm install
cp .env.example .env  # Edit with your values
npm run db:generate
npm run db:push
npm run db:seed
```

### Development

```bash
# Start the web application
npm run dev

# In another terminal, start background workers
npm run dev:worker
```

Open http://localhost:3000

**Progressive Web App (mobile):** Production builds register a service worker (`/sw.js`), expose a [Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest) at `/manifest.webmanifest`, and use `/offline` as the document fallback when the network is unavailable. Install from the browser “Add to Home Screen” on iOS Safari or Android Chrome. Development mode disables the service worker so auth and hot reload behave normally.

**Demo credentials:**
- Email: `demo@aros.dev`
- Password: `demo1234`

### Testing

```bash
npm run verify        # lint + typecheck + unit tests + production build
npm run verify:release # verify:core + touched-route safety + tenant boundary + integration tests
npm run verify:touched-routes # launch-critical route/workflow checks for public trust and review/admin surfaces
npm run test          # Run all unit tests (Vitest)
npm run test:e2e      # Playwright (requires DATABASE_URL; preflight validates env before db:push + db:seed)
npm run typecheck     # TypeScript type checking
npm run lint          # ESLint
```

E2E bootstrap is now explicit and fails fast with actionable errors:
1. `docker compose -f docker/docker-compose.yml up -d`
2. `cp .env.example .env`
3. set `DATABASE_URL` (and `REDIS_URL` / `NEXTAUTH_SECRET` when auth-heavy flows are exercised)
4. run `npm run test:e2e`

With Postgres available, `npm run test --workspace=apps/web` also runs **Stripe webhook integration tests** (subscription upsert, delete, idempotency, HMAC verification). CI sets `STRIPE_WEBHOOK_SECRET` for those tests. The webhook handler stores each Stripe `event.id` in `stripe_webhook_events` so retries are idempotent.

## Architecture

### Monorepo Structure

```
apps/
  web/          Next.js 15 App Router application
  worker/       BullMQ background job workers

packages/
  db/           Prisma schema and client
  config/       Environment validation, plans, RBAC permissions
  shared/       Auth utilities, fingerprinting, pagination, WCAG data
  ui/           Shared React UI components
  scan-engine/  axe-core normalization and rule metadata
  clustering/   Component clustering engine
  remediation/  Fix generation and validation
  integrations/ GitHub PR, Jira export, CSV/JSON export
```

### Data Flow

```
discover -> crawl -> render -> scan -> normalize -> cluster ->
map to source -> generate fixes -> validate -> human review ->
export PR/snippet/task -> re-verify -> report evidence
```

### Technology Stack

| Layer | Technology |
|-------|-----------|
| Web App | Next.js 15 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL via Prisma |
| Queue | BullMQ + Redis |
| Crawling | Playwright (Chromium) |
| Scanning | axe-core |
| Auth | Custom session-based (cookie + DB); optional enterprise **OIDC SSO** (see `docs/SECURITY_ENTERPRISE_SSO_OIDC.md`) |
| Billing | Stripe (webhooks) |
| Integrations | GitHub REST API, Jira |

### Data Model

Key entities:

- **User** / **Organization** / **Workspace** / **Membership** - Multi-tenant identity
- **Site** / **CrawlConfig** / **CrawlRun** - Site management and crawl orchestration
- **Page** / **PageSnapshot** - Crawled page data and DOM/screenshot artifacts
- **ScanRun** / **RawViolation** - Scan execution and raw axe-core results
- **CanonicalFinding** / **FindingOccurrence** - Deduplicated, fingerprinted findings
- **IssueCluster** - Component-level grouping of repeated violations
- **RemediationSuggestion** - AI-generated fix proposals with validation
- **ReviewTask** / **EvidenceArtifact** - Human review workflow and evidence
- **IntegrationConnection** / **GitHubRepoMapping** - External service connections
- **BillingCustomer** / **Subscription** / **UsageRecord** - Stripe billing
- **AuditLog** - Action audit trail

### RBAC Roles

| Role | Key Permissions |
|------|----------------|
| Owner | Full access including org management and billing |
| Admin | Member management, all operational features |
| Developer | Start crawls/scans, manage findings, export suggestions |
| Content Editor | View findings, approve content-related suggestions |
| Auditor | View all data, manage reviews, export reports |
| Reviewer | View findings, manage review tasks |

### Worker Jobs

| Queue | Purpose |
|-------|---------|
| crawl | Playwright-based page discovery and DOM capture |
| scan | axe-core accessibility scanning per page |
| cluster | Post-scan component pattern clustering |
| remediation | AI fix suggestion generation |

## Product Principles

1. **Never claim guaranteed compliance.** Automated scanning cannot prove full WCAG conformance.
2. **Never auto-publish risky fixes.** All suggestions require explicit human approval.
3. **Prefer native HTML over ARIA.** Semantic elements beat attribute-heavy patches.
4. **Human review for non-automatable criteria.** Alt text, content clarity, keyboard flows.
5. **Every finding is traceable.** Fingerprinted, timestamped, linked to evidence.
6. **Every suggestion is diffable.** Before/after code with rationale and confidence.
7. **Multi-tenant isolation is enforced.** Tenant-scoped queries at every boundary.
8. **Billing quotas enforced server-side.** Not just UI guards.

## Limitations

- **Automated scanning coverage:** axe-core detects ~30-40% of WCAG criteria. The remaining criteria require manual expert review.
- **Source mapping:** v1 uses heuristic mapping (DOM snippets, selector patterns). Direct source file mapping requires GitHub repo connection.
- **AI suggestions:** The remediation worker tries **LLM-backed draft fixes** when `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` is set and the org’s plan allows AI; otherwise it falls back to **rule-based** suggestions. The in-app **AI copilot** uses the same provider keys. Confidence scores indicate reliability. All suggestions are drafts and require human review before export.
- **Clustering accuracy:** DOM fingerprinting and selector similarity work well for consistent component patterns but may under-cluster highly dynamic content.

## Environment Variables

See `.env.example` for the complete reference.

## Deployment

### Web App (Vercel)

The Next.js app is Vercel-ready. Set environment variables in the Vercel dashboard.

### Workers (Docker)

```bash
docker build -f docker/Dockerfile.worker -t aros-worker .
docker run --env-file .env aros-worker
```

### Database

Use any managed PostgreSQL service (Supabase, Neon, RDS, etc.).

## Security Considerations

- All database queries are tenant-scoped through organization membership checks
- Session tokens are stored as HTTP-only, secure cookies
- Passwords are salted and hashed (SHA-256)
- Stripe webhooks are signature-verified
- RBAC permissions are checked server-side on every operation
- Integration tokens are stored encrypted
- Rate limiting on crawl queue (5 jobs per minute)
- Worker concurrency is configurable and bounded

## License

See LICENSE file.


## Repository Operations Standards

- Squash-only merges
- Auto-delete merged branches
- Weekly dependency update windows
- Security scanning in CI
