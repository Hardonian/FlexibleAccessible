# Go-Live Readiness Checklist

Last validated: 2026-04-03.

## Monetization
- [ ] Plan matrix in public page matches `PLANS` config.
- [ ] Billing UI shows current plan/limits and gateway readiness.
- [ ] Stripe webhook integration test passes with real DB.
- [ ] Unknown Stripe price id does not grant paid access.

## Activation + trust
- [ ] First-run path from signup -> site -> scan -> findings -> report is tested.
- [ ] Reliability notices appear when DB/queue is degraded.
- [ ] Evidence report page includes explicit legal framing.

## Quality gates
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run test`
- [ ] `npm run build`
