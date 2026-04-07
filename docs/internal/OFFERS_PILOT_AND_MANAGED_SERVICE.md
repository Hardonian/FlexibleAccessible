# Pilot and managed-service offers (template — map to contract)

**Last updated:** 2026-04-07. **Operator use:** copy into SOWs; do not treat this file as customer-facing legal text.

## Shared constraints (product truth)

- Deliverables are **accessibility testing and workflow evidence** from the AccessibleMadeFlexible platform, not a WCAG sign-off or legal opinion.
- AI outputs are **drafts**; human review gates apply before customer-facing remediation claims.
- Limits come from plan tier (`PLANS` in repo) unless a **written** override exists.

---

## A. Pilot offer (14–30 days)

**Goal:** Prove time-to-value on one site or bounded set of URLs.

**Included (typical):**

- Workspace setup, one org, roles aligned to RBAC in product.
- Configured crawl within plan page limits; at least one completed scan cycle.
- Walkthrough: findings → clusters → review queue → export/report path.
- 30-minute weekly checkpoint (buyer + operator).

**Out of scope unless SOW says otherwise:**

- Full-site manual audit, AT testing, legal review.
- Custom integrations beyond what the product supports today.

**Exit criteria:** Buyer receives one evidence export they can circulate internally with correct framing (testing evidence, not certification).

---

## B. Implementation package (30–60 days)

**Goal:** Operationalize the value loop inside the customer’s delivery process.

**Included (typical):**

- GitHub and/or Jira connection patterns (where product supports them).
- Severity / triage policy documented in customer language.
- Developer onboarding: CLI/MCP where relevant (`docs` + package READMEs).
- Handoff: who approves suggestions, who owns merges.

---

## C. Managed accessibility operations (retainer-shaped)

**Goal:** Ongoing cadence: scheduled scans, regression review, stakeholder reporting.

**Included (typical):**

- Monthly or sprint-aligned scan cadence agreed in writing.
- Exception queue review with customer owner.
- Evidence pack for leadership (counts, trends, explicit limitations).

**Pricing posture:** Retainer + platform subscription; margin protected by bounded meeting time and plan limits unless enterprise contract expands them.

---

## D. Emergency / premium support (optional add-on)

Define in contract: response-time window, channels, and **exclusions** (e.g., third-party outages, misconfigured customer infra). The app does not imply SLA until this exists in writing.
