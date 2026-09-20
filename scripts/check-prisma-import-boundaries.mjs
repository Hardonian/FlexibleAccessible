#!/usr/bin/env node
import { execSync } from 'node:child_process';

const ALLOWED_DIRECT_PRISMA_IMPORTS = new Set([
  'packages/shared/src/ai-usage.ts',
]);

let output = '';

// Try ripgrep first, fall back to grep if not available
try {
  output = execSync(
    'rg -n "from [\\\"\'\]@prisma/client[\\\"\'\]|import\\([\\\"\'\]@prisma/client[\\\"\'\]\\)" apps packages --glob "*.ts" --glob "*.tsx" --glob "!packages/db/**"',
    { encoding: 'utf8' },
  );
} catch (error) {
  // rg exits with code 1 if no matches found (which is good - means no violations)
  if (error.status !== 1) {
    // Try grep as fallback (ripgrep not installed in CI)
    try {
      output = execSync(
        'grep -rn "from.*@prisma/client" apps packages --include="*.ts" --include="*.tsx" | grep -v "packages/db/"',
        { encoding: 'utf8' },
      );
    } catch (grepError) {
      // grep exits with code 1 if no matches found (which is good)
      if (grepError.status !== 1) {
        throw grepError;
      }
    }
  }
}

const lines = output
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .filter((line) => !line.includes('from "@aros/db"') && !line.includes("from '@aros/db'"))
  .filter((line) => {
    const [filePath] = line.split(':');
    return !ALLOWED_DIRECT_PRISMA_IMPORTS.has(filePath);
  });

if (lines.length > 0) {
  console.error('[prisma:imports] Direct @prisma/client imports outside packages/db are forbidden. Use @aros/db exports instead.');
  for (const line of lines) {
    console.error(`  ${line}`);
  }
  process.exit(1);
}

console.log('[prisma:imports] Import boundary check passed.');
