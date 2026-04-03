# Onboarding + First Value Runbook

Last validated: 2026-04-03.

## Goal
Get a new workspace from signup to first evidence report with no manual operator intervention.

## Deterministic first-value path

1. **Signup/Login**
   - Create account and organization (default FREE plan).
2. **Add site**
   - `/sites/new` validates permissions and plan limits server-side.
3. **Run scan / crawl**
   - Site detail route surfaces enqueue failures and degraded queue states.
4. **Triage findings**
   - `/findings` exposes status + evidence freshness semantics.
5. **Generate evidence report**
   - `/reports` provides org summary + explicit legal non-guarantee statement.
6. **Upgrade (if private routes/features required)**
   - `/settings/billing` explains gating reason and next actions.

## Non-negotiable UX truth constraints

- Degraded data-service state must render reliability notices (never empty “healthy” UI).
- Entitlement failures must include actionable reason + billing route.
- First-run pages must prefer next-actions over generic blank states.
