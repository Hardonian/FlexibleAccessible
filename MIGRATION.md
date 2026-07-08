# FlexibleAccessible — Security Hardening Scaffold

> Status: SCAFFOLD (not yet executed). This repo has **97 known vulnerabilities**
> (1 critical, 26 high, 59 moderate, 11 low) in its current dependency tree.
> The root `package.json` lists a phantom `next@^0.4.1` (not present in the lockfile —
> the real Next app is `apps/web` on `next@^15.5.20`). Removing the phantom did NOT
> change the audit count, so the 97 are **real transitive vulns** in the active stack.

## Baseline (measured 2026-07-08)
```
npm audit (root workspace, package-lock.json)
  critical: 1   high: 26   moderate: 59   low: 11   total: 97
```
Real stack:
- `apps/web`: next ^15.5.20, react ^19.2.7, react-dom ^19.2.7
- `apps/worker`: (see apps/worker/package.json)
- `packages/ui`: react ^19.0.0
- root: hono ^4.12.27, @prisma/client ^7.8.0, nodemailer ^9.0.3

## Why this is not a one-shot fix
This is a Turborepo monorepo. Bumping major framework versions across `apps/*` and
`packages/*` simultaneously breaks builds. The safe path is incremental + verified.

## Step-by-step hardening plan
1. **Generate a real audit report** per workspace:
   `cd apps/web && PUPPETEER_SKIP_DOWNLOAD=1 npm audit --json > ../../audit-apps-web.json`
2. **Apply non-breaking fixes first** (safe, measurable):
   `npm audit fix` (no `--force`) at root + each app. Re-measure.
3. **Targeted `overrides`** (like the Keys pnpm fix that took 70→5):
   add an `overrides` block to root `package.json` pinning the 1 critical + top high
   transitive deps to patched versions. Re-measure.
4. **Per-app Next codemods** only after overrides land:
   `npx @next/codemod@latest .` inside `apps/web`.
5. **CI gate**: add `npm audit --audit-level=high` to CI so the count can't regress.

## Verification gate (do not merge until)
- `npm audit` shows 0 critical AND <= 5 high after overrides.
- `turbo build` passes for `apps/web` + `apps/worker`.
- Existing tests pass.

## Safe to automate
The `dep-drift-guard` cron (already deployed) will open a consolidated hardening PR
for this repo weekly using `npm audit fix` (non-breaking) — that handles the easy
share. This scaffold covers the hard remaining share (overrides + codemods).
