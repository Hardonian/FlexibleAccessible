# AccessibleMadeFlexible — buyer one-pager (internal)

**Last updated:** 2026-04-07. **Audience:** engineering lead, accessibility lead, procurement. **Truth bar:** claims below map to shipped product behavior or explicit non-guarantees in `/trust` and reports.

## One-line pitch

Browser-accurate accessibility **operations**: crawl, scan (axe-core), cluster repeated failures, review what automation cannot judge, export evidence—not a vanity score or overlay.

## Pain we address

- **Signal without theater:** Findings tied to rendered pages and selectors, with history and export paths.
- **Root-cause triage:** Clustering reduces “thousands of pages, same component” noise.
- **Defensible artifacts:** Reports and summaries framed as testing evidence, not legal WCAG certification.
- **Workflow, not a widget:** Source-first remediation (PRs, snippets, integrations)—no floating overlay substitute.

## What we do not claim

- No guaranteed WCAG or legal compliance; manual and assistive-tech testing remain essential.
- Automated engines (axe) cover a **subset** of WCAG—see product docs and limitations in README.

## Who it is for

- Teams shipping web apps who need **continuous regression signal** and **accountable remediation workflow**.
- Agencies and enterprises who need **evidence-shaped** reporting for stakeholders.

## Proof in the product

- Finding detail: evidence source, staleness vs last completed scan, cross-run comparison contract (where applicable).
- Reports: operational summary with explicit non-guarantee framing (`/reports`, `/api/reports` paid-gated).

## Packaging (self-serve)

Aligned with `packages/config/src/plans.ts`: Free (bounded), Starter, Professional (AI + deploy hooks per feature list), Enterprise (higher limits + contract-shaped services). Public table: `/docs/plans-and-limits`.

## Managed / enterprise motion

Contact `NEXT_PUBLIC_PRODUCT_CONTACT_EMAIL` (default in code: `sales@aros.dev`). Offer shapes: pilot scoped crawl + report, implementation package (connect GitHub/Jira + policy), ongoing ops (cadence + exports). **Only commit SLAs and custom terms in writing**—not implied by the app UI alone.

## Security / trust pointers

- `/security`, `/privacy`, `/legal/subprocessors`, `/trust`
- Server-side entitlements for billing and org data; Stripe webhooks idempotent via stored event ids.

## Pilot success criteria (suggested)

1. One production site connected, one full crawl within plan limits.  
2. Top clusters addressed or ticketed with owner.  
3. One evidence export consumed by legal/comms without over-claiming.  
4. Subscription + webhook path verified in staging before prod cutover.
