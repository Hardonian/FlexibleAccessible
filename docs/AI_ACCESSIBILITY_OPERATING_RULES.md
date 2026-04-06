# Production AI / accessibility operating rules

**Product:** AccessibleMadeFlexible (AROS engine)  
**Intent:** Treat the product as an **accessibility intelligence and remediation operating system**, not as an AI demo.

## Non-negotiables

- **Deterministic accessibility evidence is the source of truth.**
- **AI must never invent** findings, severity, WCAG mapping, proof, or compliance claims.
- AI may **explain, cluster, prioritize, draft fixes, summarize patterns, and assist workflow** only when grounded in **stored evidence**.
- **Every recommendation** must reference concrete **issue IDs**, **evidence IDs**, **WCAG refs**, **affected surfaces**, and **confidence / review state**.
- **Raw model output must never** be returned directly to users or downstream systems. Convert all outputs to **validated structured schemas**.
- **Separate** detection, evidence, recommendation, workflow, and integration concerns. Do not tightly couple model logic to product logic.
- **All recommendation calls must be observable:** model version, latency, token cost, inputs used, outputs produced, tool calls, acceptance / rejection outcome.
- **Use cost discipline by default:** deterministic scan first; AI only for changed / new / high-value issues; cheaper models for routine explanation; stronger models only for complex remediation.
- **Never present AI suggestions as compliance truth.** Present them as **guided remediation proposals** unless verified.
- **Prefer component-level and system-level remediation** over page-by-page patching.
- **Preserve full audit history:** findings, suppressions, review notes, regressions, accepted fixes, verification results, and proofpack lineage.
- **Optimize for workflow lock-in** through issue memory, recurring-pattern learning, component fingerprints, verification loops, and integrations.
- **Product goal:** make accessibility work faster, clearer, more provable, more collaborative, and harder to regress.

## Required system capabilities

- Canonical queue of actionable issues
- Evidence-backed issue detail with reproduction and impact
- Structured recommendation objects
- Verification / recheck workflow
- Historical diffing and recurring-issue memory
- CI, ticketing, repo, and design-system integrations
- Exportable proofpacks and machine-readable APIs
- Graceful degraded states when AI is unavailable

## Default decision rule

If there is a conflict between **impressive AI behavior** and **trustworthy audit/remediation workflow**, choose **trustworthy workflow**.

## Related docs

- [Accessibility evidence model](./ACCESSIBILITY_EVIDENCE_MODEL.md) — what is stored today
- [Findings and reporting truth](./FINDINGS_AND_REPORTING_TRUTH.md) — what the product claims in summaries and exports
- [Platform degradation model](./PLATFORM_DEGRADATION_MODEL.md) — degraded / blocked behavior
