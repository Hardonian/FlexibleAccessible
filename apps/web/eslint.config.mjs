import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import securityPlugin from "eslint-plugin-security";

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
];