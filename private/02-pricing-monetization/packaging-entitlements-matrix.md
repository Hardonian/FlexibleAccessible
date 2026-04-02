# Packaging & Entitlements Matrix

**Status:** CURRENT STATE + RECOMMENDED  
**Purpose:** Map plan promises to enforceable controls.  
**Scope:** Tier limits, feature access, enforcement path, trust boundaries.

## Current Truth Matrix
| Entitlement | FREE | STARTER | PROFESSIONAL | ENTERPRISE | Enforcement source |
|---|---:|---:|---:|---:|---|
| Private dashboard access | ❌ | ✅ | ✅ | ✅ | `requirePaid`, dashboard redirect gate |
| Domains max | 1 | 3 | 10 | 100 | `subscription.maxDomains` checks |
| Pages per crawl max | 50 | 200 | 1000 | 10000 | subscription + crawl config clamping |
| Scans per month max | 3 | 10 | 50 | 500 | scan enqueue monthly limit input |
| Seats max | 1 | 3 | 10 | 100 | field exists; full enforcement needs invite-path checks |
| AI enabled | ❌ | **⚠ mismatch** | ✅ | ✅ | webhook plan map + AI route check |
| AI token limit | 0 | **⚠ mismatch** | 100k | 1M | subscription fields + AI usage display |

## Known Inconsistency (Critical)
- Plan copy in config lists "AI remediation suggestions" in Starter, but webhook plan mapping sets Starter `aiEnabled=false` and token limit `0`.

## Recommended Policy / Model
1. **Single-source entitlement truth:** move plan-level AI flags into shared config consumed by webhook mapping + UI copy.
2. **Do not externally publish Starter AI access until mismatch resolved.**
3. Seat limits should remain marked **RECOMMENDED** for strict enforcement until invite/create-member path enforces `maxSeats`.

## Feature Gating Map (Now vs Contractual)
- **Must be product-enforced:** private route access, scan limits, domain limits, AI access.
- **Can be contractual/manual initially:** onboarding service hours, response-time commitments, dedicated support scope.

## Next Actions
- Implement seat limit enforcement in membership creation flows.
- Resolve Starter AI mismatch prior to external pricing page release.
