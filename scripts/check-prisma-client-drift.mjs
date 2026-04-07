#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const schemaPath = resolve(repoRoot, 'packages/db/prisma/schema.prisma');
const generatedSchemaPath = resolve(repoRoot, 'node_modules/.prisma/client/schema.prisma');
const generatedEntrypoint = resolve(repoRoot, 'node_modules/@prisma/client/index.d.ts');

if (!existsSync(generatedEntrypoint) || !existsSync(generatedSchemaPath)) {
  console.error('[prisma:check] Generated Prisma client is missing. Run: npm run db:generate');
  process.exit(1);
}

const canonicalize = (schema) => schema
  .replace(/\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\s+/g, ' ')
  .trim();

const canonicalSchema = canonicalize(readFileSync(schemaPath, 'utf8'));
const generatedSchema = canonicalize(readFileSync(generatedSchemaPath, 'utf8'));

if (canonicalSchema !== generatedSchema) {
  console.error('[prisma:check] Prisma schema drift detected between packages/db/prisma/schema.prisma and generated client artifacts.');
  console.error('[prisma:check] Run: npm run db:generate');
  process.exit(1);
}

console.log('[prisma:check] Prisma client artifacts are in sync with canonical schema.');
