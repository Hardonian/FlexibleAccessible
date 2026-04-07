# ROI and value framing (honest)

**Last updated:** 2026-04-07. **Use:** sales discovery and internal prioritization—not a promise of financial outcome.

## Value levers (evidence-based)

1. **Regression cost avoidance:** Post-deploy scans and finding history reduce “surprise” audit findings on shipped pages—measured by reopened finding rate over time (product can surface counts; causal ROI is customer-specific).
2. **Triage efficiency:** Clustering converts many page-level duplicates into one operational unit—time saved scales with site size and component reuse.
3. **Coordination clarity:** Review tasks and exportable artifacts reduce back-and-forth between eng, design, and compliance—qualitative unless customer tracks ticket cycle time.
4. **Procurement defensibility:** Bounded claims and trust copy reduce legal/comms backlash compared to “100% compliant” tooling narratives.

## What not to claim

- Do not attach a universal **% revenue protected** or **lawsuit avoidance** figure without customer-specific legal input.
- Do not equate axe coverage with full WCAG conformance.

## Discovery questions (for pilots)

- How many critical user journeys are in scope?
- Current cost of last-minute fixes before release?
- Who signs off on accessibility today, and what evidence do they accept?
- What integrations must be true for this to stick (GitHub, Jira, CI)?

## Success metrics customers can own

- Mean time to remediate **P1** findings (by severity tag).
- % of findings with **human-reviewed** disposition vs open.
- Scan cadence adherence (scheduled vs ad hoc).
- Repeat violations on same cluster ID (should fall after fixes land).
