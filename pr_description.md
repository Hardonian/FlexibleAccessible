Title: 🧹 [Remove hardcoded development URLs from env schema]

## Description

🎯 **What:** Removed the `.default('...')` hardcoded fallbacks from `REDIS_URL` and `NEXTAUTH_URL` in `packages/config/src/env.ts`, making them strict required URLs.

💡 **Why:** Relying on hardcoded environment configurations, especially for development environments, can obscure where the system configurations are coming from. It is a common and safe practice to require these variables to be explicitly set in the respective environment file (`.env`).

✅ **Verification:** Ran `npm run test --workspace=packages/config` to ensure no regressions. Fixed the failing tests in `packages/config/src/__tests__/env-diagnostics.test.ts` by supplying the now-required `REDIS_URL`.

✨ **Result:** Env variables schema enforces URLs to be provided via standard means rather than implicit default values.
