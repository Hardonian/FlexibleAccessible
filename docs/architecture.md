# Architecture Overview

## System Architecture

```
                    ┌──────────────────┐
                    │   Next.js App    │
                    │   (App Router)   │
                    │                  │
                    │  - Auth pages    │
                    │  - Dashboard     │
                    │  - API routes    │
                    │  - Server actions│
                    └────────┬─────────┘
                             │
                    ┌────────┴─────────┐
                    │                  │
              ┌─────┴──────┐   ┌──────┴──────┐
              │ PostgreSQL │   │    Redis     │
              │            │   │  (BullMQ)   │
              └─────┬──────┘   └──────┬──────┘
                    │                  │
                    │          ┌───────┴───────┐
                    │          │   Workers     │
                    │          │               │
                    │          │ - Crawl       │
                    │          │ - Scan        │
                    │          │ - Cluster     │
                    │          │ - Remediation │
                    │          └───────────────┘
                    │
              ┌─────┴──────────────────┐
              │    External Services    │
              │                        │
              │ - Stripe (billing)     │
              │ - GitHub (PRs)         │
              │ - Jira (tickets)       │
              │ - S3 (artifacts)       │
              └────────────────────────┘
```

## Multi-Tenancy Model

```
Organization
  └── Workspace(s)
       └── Site(s)
            ├── CrawlConfig
            ├── CrawlRun(s)
            ├── Page(s)
            │    └── PageSnapshot(s)
            ├── ScanRun(s)
            │    └── RawViolation(s)
            ├── CanonicalFinding(s)
            │    ├── FindingOccurrence(s)
            │    └── RemediationSuggestion(s)
            └── IssueCluster(s)
```

All data access flows through organization membership verification.
There are no cross-tenant queries by construction.

## Request Flow

1. User authenticates via session cookie
2. Server component reads session, loads org membership
3. RBAC permission check against the user's role
4. Database query scoped to the user's organization
5. Data rendered server-side, sent to client

## Worker Pipeline

1. **Crawl Job**: Launches Playwright browser, discovers pages, captures DOM snapshots
2. **Scan Job**: Injects axe-core into each page, collects violations
3. **Normalization**: Creates fingerprinted canonical findings, deduplicates
4. **Cluster Job**: Groups findings by DOM structure similarity
5. **Remediation Job**: Generates fix suggestions with validation

Each job is idempotent. Failed jobs do not corrupt state.
Jobs use exponential backoff for retries.

## Findings Pipeline

```
Raw Violation (immutable scan result)
  ↓ fingerprint
Canonical Finding (deduplicated, versionable)
  ↓ cluster
Issue Cluster (component-level grouping)
  ↓ generate
Remediation Suggestion (AI draft with validation)
  ↓ review
Review Task (human sign-off)
  ↓ export
GitHub PR / Jira Ticket / Code Snippet
```

## Key Design Decisions

1. **Session-based auth over JWT**: Simpler revocation, server-side session management
2. **Prisma over Drizzle**: Mature ecosystem, excellent TypeScript codegen
3. **BullMQ over pg-boss**: Better Redis-based queue with rate limiting
4. **Server Components + Server Actions**: Minimal client JS, progressive enhancement
5. **Monorepo with npm workspaces**: Simple, no extra tooling needed
6. **Rule-based remediation v1**: Predictable, testable, AI-agnostic in v1
