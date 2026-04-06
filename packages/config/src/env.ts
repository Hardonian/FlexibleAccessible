import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  NEXTAUTH_SECRET: z.string().min(16),
  NEXTAUTH_URL: z.string().url().default('http://localhost:3000'),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_PROFESSIONAL: z.string().optional(),
  STRIPE_PRICE_ENTERPRISE: z.string().optional(),

  // GitHub Integration
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),

  // AI
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Storage
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),

  // Transactional email (optional; required for password reset / verification delivery)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Worker
  WORKER_CONCURRENCY: z.coerce.number().default(3),
  MAX_CRAWL_PAGES: z.coerce.number().default(500),
});

export type Env = z.infer<typeof envSchema>;

export type EnvDiagnostics = {
  valid: boolean;
  fieldErrors: Record<string, string[] | undefined>;
  issues: string[];
};

export function tryParseEnv(
  env: NodeJS.ProcessEnv
): { ok: true; data: Env } | { ok: false; error: z.ZodError } {
  const result = envSchema.safeParse(env);
  if (result.success) {
    return { ok: true, data: result.data };
  }
  return { ok: false, error: result.error };
}

let cachedEnv: Env | null = null;

function loadEnv(): Env {
  const result = tryParseEnv(process.env);
  if (!result.ok) {
    console.error('Invalid environment variables:', result.error.flatten().fieldErrors);
    throw new Error('Invalid environment variables');
  }
  return result.data;
}

/**
 * Validated process env. Lazily parsed on first access so diagnostics can run first in tooling.
 */
export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = loadEnv();
  }
  return cachedEnv;
}

/** @deprecated Prefer getEnv() for clarity; kept for backward compatibility */
export const env = new Proxy({} as Env, {
  get(_, prop: keyof Env) {
    return getEnv()[prop];
  },
});

/**
 * Safe parse for health/diagnostics — never throws; never includes secret values.
 */
export function parseEnvDiagnostics(processEnv: NodeJS.ProcessEnv): EnvDiagnostics {
  const result = tryParseEnv(processEnv);
  if (result.ok) {
    return { valid: true, fieldErrors: {}, issues: [] };
  }
  const flat = result.error.flatten();
  const issues = Object.entries(flat.fieldErrors).flatMap(([key, messages]) =>
    (messages ?? []).map((msg) => `${key}: ${msg}`)
  );
  return { valid: false, fieldErrors: flat.fieldErrors, issues };
}
