# Changelog

All notable changes to Accessibility Remediation OS (FlexibleAccessible) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-04-22

### Security
- Upgraded `hono` to `^4.12.14` (fixes 2 moderate CVEs: GHSA-92pp-h63x-v22m, GHSA-458j-xx4x-4375)
- Pinned Node 20 via `.nvmrc` for CI consistency
- Enabled AROS accessibility scan workflow

## [1.0.0] - 2026-04-09

### Added
- **Accessibility Remediation OS** - Initial release of the accessibility remediation platform
- **Scan Engine** - Multi-scanner pipeline (axe-core, lighthouse, htmlcs, wave) with result normalization
- **MCP Server** - Model Context Protocol server for AI-driven accessibility workflows
- **Core Services** - Shared utilities including StandardResult, SystemPosture, VerificationFlow, AuthLayer
- **Web App** - Multi-tenant dashboard for scan management, remediation tracking, and compliance reporting
- **Worker** - Queue-based job processing for crawl automation and batch scanning
- **Self-Dogfooding** - Internal AROS platform organization for continuous self-scanning
- **Security Policy** - Documented security disclosure and incident response process
- **Trust & Admin Surfaces** - Hardened review queue, trust entrypoints, and admin controls with auditability
- **Scheduled Crawl Automation** - Configurable crawl cadence with worker execution loop
- **Organization API/MCP Controls** - Expanded admin controls for tenant management

### Infrastructure
- Node.js 24 in CI (deprecation warnings resolved)
- PostgreSQL with Prisma ORM
- Redis for caching and job queues
- Multi-tenant architecture with RLS
- GitHub Actions CI/CD pipeline
- Docker containerization

### Dependencies
- Prisma upgraded to 6.19.3 → 7.6.0
- Stripe upgraded to 18.5.0 → 22.0.0
- BullMQ upgraded to 5.72.0 → 5.73.0
- Node.js forced to v24 in GitHub Actions