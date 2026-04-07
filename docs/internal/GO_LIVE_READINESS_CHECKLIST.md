# Go-Live Readiness Checklist

Last validated: 2026-04-07.

## Monetization
- [ ] Plan matrix in public page matches `PLANS` config.
- [ ] Billing UI shows current plan/limits and gateway readiness.
- [ ] Stripe webhook integration test passes with real DB.
- [ ] Unknown Stripe price id does not grant paid access.
- [ ] AI surfaces behave correctly when `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` are absent (copilot 503; worker rule-based fallback).

## Activation + trust
- [ ] First-run path from signup -> site -> scan -> findings -> report is tested.
- [ ] Reliability notices appear when DB/queue is degraded.
- [ ] Evidence report page includes explicit legal framing.
- [ ] Trust and comparison docs match deployed provider and plan truth (`/trust`, `/docs/comparison`).

## GTM + ops (internal)
- [ ] `docs/internal/BUYER_ONE_PAGER.md` reviewed for your deployment contact email (`NEXT_PUBLIC_PRODUCT_CONTACT_EMAIL`).
- [ ] `docs/internal/RISK_REGISTER.md` reviewed for top 3 risks this quarter.
- [ ] Audit log export (`GET /api/org/{organizationId}/audit-log`) smoke-tested with an AUDITOR + paid org.
- [ ] Billing page shows export event counts when Stripe period bounds exist on `subscription`.
- [ ] If OIDC SSO is enabled: IdP redirect URI matches `…/api/auth/oidc/callback`; test JIT vs link-existing modes (`docs/SECURITY_ENTERPRISE_SSO_OIDC.md`).
- [ ] Public `/status` page matches operator expectations vs `/api/health?detailed=true`.

## Quality gates
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`
