# Case study (synthetic demo — not a real customer)

**IMPORTANT:** This document is a **writing sample** only. Names, metrics, and quotes are **fabricated** for layout and tone practice. **Do not** use in sales decks without replacing every fact with verified customer data and signed approval.

---

## Snapshot

| Field | Value |
|-------|--------|
| Industry | B2B SaaS (project management) |
| Team size | 12 engineers, 2 designers, 1 accessibility lead |
| Primary goal | Reduce regressions before quarterly audits; give Legal a defensible testing narrative |
| Plan tier | Professional |
| Timeline | 6-week pilot → production org |

## Situation

Ship velocity had outpaced manual QA. The team ran occasional axe scans in CI but could not **prove** what was tested, **where** failures recurred, or **what** changed release-to-release. Procurement asked for evidence that was not a single “accessibility score.”

## Constraints

- No overlay policy (design and legal).
- Multi-tenant app with heavy client-side routing.
- Needed GitHub PR workflow for fixes without opening Jira for every nit.

## What we did (product-backed)

- Connected production marketing site + logged-in app shell as two monitored properties within plan limits.
- Used **clustered findings** to prioritize one header component fix affecting hundreds of URLs.
- Routed **ambiguous** alt-text issues through review tasks with owner + rationale.
- Exported a **findings report** (JSON + CSV) for Legal with explicit non-guarantee framing.

## Evidence (synthetic numbers — not factual)

- **Open critical automated findings:** 14 → 6 over 30 days (same crawl depth; counts from product export).
- **Mean time to disposition** on top cluster: 9 days → 3 days (internal ticket timestamps — illustrative only).
- **Scan cadence:** weekly scheduled + on-demand after deploy.

## Quote (fabricated)

> “We stopped arguing about whether we tested the right pages. The export still says it’s testing evidence, not a legal sign-off — and that honesty kept us out of trouble with counsel.”  
> — **Alex Rivera**, VP Engineering, **Northstar Tasks Ltd.** *(fictional)*

## Why they stayed (hypothetical narrative)

Habit formed around **pre-release scans** and **cluster triage**; historical findings became the institutional memory competitors could not copy from a one-off audit.

---

**Replace this file** with a real case study using `CASE_STUDY_TEMPLATE.md` when you have permission.
