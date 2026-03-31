import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import securityPlugin from "eslint-plugin-security";
import vitestPlugin from "eslint-plugin-vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.extends("next/core-web-vitals"),
  securityPlugin.configs.recommended,
  {
    rules: {
      // Disable object injection warning as it is overly noisy in React/Next.js
      // where dynamic property access is extremely common.
      "security/detect-object-injection": "off",
      // Warn instead of error for potentially unsafe regex, as we use complex regex for sanitizers
      "security/detect-unsafe-regex": "warn",
    },
  },
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts", "**/*.spec.tsx"],
    plugins: {
      vitest: vitestPlugin,
    },
    rules: {
      ...vitestPlugin.configs.recommended.rules,
    },
  },
  {
    // Enforce the Data Boundary specifically in Next.js App Router endpoints, pages, and actions
    files: ["src/app/**/*.ts", "src/app/**/*.tsx"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          // AST Selector: Matches `prisma.model.method()` and `prisma.$action()` UNLESS they are inside `runOrgScopedQuery()`
          selector: ":matches(CallExpression[callee.object.object.name='prisma'], CallExpression[callee.object.name='prisma']):not(CallExpression[callee.name='runOrgScopedQuery'] *)",
          message: "⚠️ Tenant Boundary Violation: Direct database queries in route handlers must be wrapped in `runOrgScopedQuery(ctx, ...)` to guarantee tenant data isolation, or imported from a pre-wrapped module."
        }
      ]
    }
  }
];