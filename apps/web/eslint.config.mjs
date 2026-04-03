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

const config = [
  {
    ignores: [".next/**"],
  },
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
    // Enforce the Data Boundary specifically in server mutation/read boundaries
    // (API route handlers + server actions). Server-rendered pages are excluded to
    // reduce false positives where data access is already delegated to scoped modules.
    files: ["src/app/**/route.ts", "src/app/**/actions.ts", "src/app/**/scan-actions.ts"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          // AST Selector: Matches `prisma.model.method()` and `prisma.$action()` UNLESS they are inside `runOrgScopedQuery()`
          selector: ":matches(CallExpression[callee.object.object.name='prisma'], CallExpression[callee.object.name='prisma']):not(CallExpression[callee.name='runOrgScopedQuery'] *)",
          message: "⚠️ Tenant Boundary Violation: Direct database queries in route handlers must be wrapped in `runOrgScopedQuery(ctx, ...)` to guarantee tenant data isolation, or imported from a pre-wrapped module."
        },
        {
          selector: "CallExpression[callee.object.name='router'][callee.property.name=/^(push|replace|prefetch)$/] > Literal.arguments:first-child:not([value=/^(\\/|http)/])",
          message: "⚠️ Routing Violation: `router.push()` arguments should be absolute paths starting with `/` or valid URLs to prevent relative routing bugs."
        },
        {
          selector: "CallExpression[callee.object.name='router'][callee.property.name=/^(push|replace|prefetch)$/] > TemplateLiteral.arguments:first-child > TemplateElement:first-child:not([value.cooked=/^(\\/|http)/])",
          message: "⚠️ Routing Violation: `router.push()` template strings should start with `/` to prevent relative routing bugs."
        },
        {
          selector: "ExportNamedDeclaration > FunctionDeclaration[id.name=/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/] > BlockStatement:not(:has(> TryStatement))",
          message: "⚠️ Route Handler Violation: Exported Route Handlers (GET, POST, etc.) must wrap their logic in a top-level try/catch block to ensure errors are handled gracefully."
        },
        {
          selector: "ExportNamedDeclaration > VariableDeclaration > VariableDeclarator[id.name=/^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)$/] > ArrowFunctionExpression > BlockStatement:not(:has(> TryStatement))",
          message: "⚠️ Route Handler Violation: Exported Route Handlers (GET, POST, etc.) must wrap their logic in a top-level try/catch block to ensure errors are handled gracefully."
        }
      ]
    }
  }
];

export default config;
