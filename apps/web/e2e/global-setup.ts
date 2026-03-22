import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// apps/web/e2e -> repo root
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * Ensures schema and demo seed exist before Playwright auth E2E.
 * Requires DATABASE_URL (CI provides it; local dev should run docker compose + .env).
 */
export default async function globalSetup() {
  if (!process.env.DATABASE_URL) {
    throw new Error('E2E global setup requires DATABASE_URL (run docker compose and copy .env.example)');
  }

  execSync('npm run db:push', { cwd: repoRoot, stdio: 'inherit', env: process.env });
  execSync('npm run db:seed', { cwd: repoRoot, stdio: 'inherit', env: process.env });
}
