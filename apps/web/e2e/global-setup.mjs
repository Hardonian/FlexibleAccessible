import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatE2EPreflightError, runE2EPreflight } from './preflight.mjs';

// apps/web/e2e -> repo root
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/**
 * Ensures schema and demo seed exist before Playwright auth E2E.
 * Requires DATABASE_URL (CI provides it; local dev should run docker compose + .env).
 */
export default async function globalSetup() {
  const preflight = runE2EPreflight(process.env);
  if (!preflight.ok) {
    throw new Error(formatE2EPreflightError(preflight));
  }

  console.log('[e2e:setup] Preflight passed. Syncing schema...');
  execSync('npm run db:push', { cwd: repoRoot, stdio: 'inherit', env: process.env });
  console.log('[e2e:setup] Schema synced. Seeding deterministic demo data...');
  execSync('npm run db:seed', { cwd: repoRoot, stdio: 'inherit', env: process.env });
  console.log('[e2e:setup] Database bootstrap complete.');
}
