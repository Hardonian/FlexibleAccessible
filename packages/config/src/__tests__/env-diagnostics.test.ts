import { describe, expect, it } from 'vitest';
import { parseEnvDiagnostics } from '../env';

describe('parseEnvDiagnostics', () => {
  it('valid when required keys present', () => {
    const d = parseEnvDiagnostics({
      DATABASE_URL: 'postgresql://localhost:5432/db',
      NEXTAUTH_SECRET: 'test-secret-for-ci-only',
      REDIS_URL: 'redis://localhost:6379',
      NEXTAUTH_URL: 'http://localhost:3000',
      NODE_ENV: 'test',
    });
    expect(d.valid).toBe(true);
    expect(d.issues).toEqual([]);
  });

  it('invalid lists field issues without throwing', () => {
    const d = parseEnvDiagnostics({
      DATABASE_URL: 'not-a-url',
      NEXTAUTH_SECRET: 'short',
    });
    expect(d.valid).toBe(false);
    expect(d.issues.length).toBeGreaterThan(0);
  });
});
