import { URL } from "node:url";

const REQUIRED_ENV = ["DATABASE_URL"];

function assertUrlLike(name, value, errors) {
  try {
    const parsed = new URL(value);
    void parsed;
  } catch {
    errors.push(`${name} must be a valid URL. Received "${value}".`);
  }
}

/**
 * @param {Record<string, string | undefined>} env
 */
export function runE2EPreflight(env = process.env) {
  const missing = REQUIRED_ENV.filter((name) => !env[name] || env[name]?.trim().length === 0);
  const errors = [];

  if (missing.length > 0) {
    errors.push(`Missing required environment variables: ${missing.join(", ")}.`);
  }

  if (env.DATABASE_URL) {
    assertUrlLike("DATABASE_URL", env.DATABASE_URL, errors);
  }

  return {
    ok: errors.length === 0,
    missing,
    errors,
    required: REQUIRED_ENV,
  };
}

export function formatE2EPreflightError(result) {
  const guidance = [
    "E2E preflight failed. Playwright global setup cannot safely seed the test environment.",
    ...result.errors.map((error) => `- ${error}`),
    "",
    "Required bootstrap order:",
    "1) docker compose -f docker/docker-compose.yml up -d",
    "2) cp .env.example .env",
    "3) set DATABASE_URL (and REDIS_URL/NEXTAUTH_SECRET when auth-dependent flows are exercised)",
    "4) npm run test:e2e",
  ];

  return guidance.join("\n");
}
