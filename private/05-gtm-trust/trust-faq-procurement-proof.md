# Trust FAQ, Procurement Readiness, and Proof Requirements

**Status:** RECOMMENDED + REQUIRES EXTERNAL REVIEW  
**Purpose:** Prevent unsupported trust/compliance claims in sales cycles.  
**Scope:** Security/privacy/accessibility FAQ, procurement checklist, claim evidence rules.

## Security / Privacy / Accessibility FAQ (internal canonical answers)
- **Q: Is tenant isolation enforced?**  
  A: Organization-scoped access checks are implemented in core route guards; access requires membership and permission checks.
- **Q: Is billing enforcement only cosmetic?**  
  A: No. Private route/API access uses server-side entitlement checks.
- **Q: Do you guarantee WCAG compliance?**  
  A: No. Product supports remediation operations and evidence, but does not guarantee compliance outcomes.

## Proof Requirements Before Claiming
| Claim type | Minimum proof required |
|---|---|
| “Server-side paywall enforcement” | Code path + automated test coverage |
| “Secure webhook processing” | Signature verification logic + idempotency behavior |
| “Plan limit enforcement” | Live path showing hard block at boundary |
| “Enterprise-ready” | Documented controls + incident/support policy + verified evidence artifacts |

## Procurement / Buyer Readiness Checklist
- Architecture overview (tenant boundaries + access control)
- Data handling statement (what data is processed/stored)
- Billing and entitlement lifecycle explanation
- Incident response/escalation policy
- Known limitations statement (no guarantee claims)

## Caveats
- **REQUIRES EXTERNAL REVIEW:** legal language in MSA/DPA, tax statements, formal compliance attestations.
