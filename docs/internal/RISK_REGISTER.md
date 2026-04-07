# Venture risk register (living)

**Last updated:** 2026-04-07. **Severity:** impact if realized × likelihood proxy (not formal FAIR).

| ID | Risk | Category | Mitigation / control in repo or ops | Owner |
|----|------|----------|--------------------------------------|-------|
| R1 | Customer interprets exports as legal WCAG proof | Trust / legal | Trust page, report disclaimers, buyer one-pager, confidence ladder | GTM + product |
| R2 | Stripe webhook delay → “paid but locked” support load | Revenue / ops | Billing page copy; idempotent webhook; support playbook | Ops |
| R3 | AI provider outage or missing keys → perceived product failure | Product truth | `AI_UNAVAILABLE` 503; worker falls back to rule-based; docs state dependency | Eng |
| R4 | Redis down → weaker rate limits (per-process fallback) | Security / abuse | Health + trust page document fallback; monitor Redis | Eng |
| R5 | Unknown Stripe price id after price rotation | Revenue | Webhook rejects unknown mapping; tests | Eng |
| R6 | Multi-tenant query bug | Security | Tenant-boundary scripts in `verify:tenant-boundary`; org-scoped queries | Eng |
| R7 | Over-generous free tier / LLM cost bleed | Margin | Plan token limits; AI entitlement checks; remediation cache | Eng + finance |
| R8 | Solo operator overload (support + sales + incidents) | Ops | Runbooks in `docs/internal/`; checklist gate | Founder |

## Review cadence

Revisit after each pricing change, each major AI/provider change, and monthly for top support reasons.
