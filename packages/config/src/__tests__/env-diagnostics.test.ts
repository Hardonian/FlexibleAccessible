import { describe, expect, it } from 'vitest';
import { parseEnvDiagnostics } from '../env';

describe('parseEnvDiagnostics', () => {
  const validEnv = {
    DATABASE_URL: 'postgresql://localhost:5432/db',
    NEXTAUTH_SECRET: 'test-secret-for-ci-only',
    NEXTAUTH_URL: 'http://localhost:3000',
    NODE_ENV: 'test',
  };

  it('valid when required keys present', () => {
    const d = parseEnvDiagnostics({
      DATABASE_URL: 'postgresql://localhost:5432/db',
      NEXTAUTH_SECRET: 'test-secret-for-ci-only',
      REDIS_URL: 'redis://localhost:6379',
      NEXTAUTH_URL: 'http://localhost:3000',
      NODE_ENV: 'test',
    });
    expect(d.valid).toBe(true);
    expect(d.fieldErrors).toEqual({});
    expect(d.issues).toEqual([]);
  });

  it('invalid lists field issues without throwing', () => {
    const d = parseEnvDiagnostics({
      DATABASE_URL: 'not-a-url',
      NEXTAUTH_SECRET: 'short',
    });
    expect(d.valid).toBe(false);
    expect(d.issues.length).toBeGreaterThan(0);
    expect(d.fieldErrors).toHaveProperty('DATABASE_URL');
    expect(d.fieldErrors).toHaveProperty('NEXTAUTH_SECRET');
  });

  it('returns invalid when required keys are missing', () => {
    const { DATABASE_URL, ...envWithoutDbUrl } = validEnv;
    const d = parseEnvDiagnostics(envWithoutDbUrl as any);

    expect(d.valid).toBe(false);
    expect(d.fieldErrors).toHaveProperty('DATABASE_URL');
    expect(d.fieldErrors.DATABASE_URL?.[0]).toMatch(/(required|expected string)/i);
    expect(d.issues.some((i) => /DATABASE_URL:.*(required|expected string)/i.test(i))).toBe(true);
  });

  it('returns invalid when format is incorrect', () => {
    const d = parseEnvDiagnostics({
      ...validEnv,
      DATABASE_URL: 'not-a-valid-url',
    });

    expect(d.valid).toBe(false);
    expect(d.fieldErrors).toHaveProperty('DATABASE_URL');
    expect(d.fieldErrors.DATABASE_URL?.[0]).toMatch(/invalid url/i);
    expect(d.issues.some((i) => /DATABASE_URL:.*invalid url/i.test(i))).toBe(true);
  });

  it('returns invalid when string length constraints are not met', () => {
    const d = parseEnvDiagnostics({
      ...validEnv,
      NEXTAUTH_SECRET: 'short',
    });

    expect(d.valid).toBe(false);
    expect(d.fieldErrors).toHaveProperty('NEXTAUTH_SECRET');
    expect(d.fieldErrors.NEXTAUTH_SECRET?.[0]).toMatch(/(16|at least 16)/i);
    expect(d.issues.some((i) => /NEXTAUTH_SECRET:.*16/i.test(i))).toBe(true);
  });
});
