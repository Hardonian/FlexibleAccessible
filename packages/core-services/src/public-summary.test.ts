import { describe, expect, it } from 'vitest';
import { toPublicHealthSummary } from './public-summary';
import type { PlatformHealthReport } from './types';

function baseReport(overrides: Partial<PlatformHealthReport> = {}): PlatformHealthReport {
  const services = [
    {
      id: 'worker-runtime',
      name: 'Workers',
      purpose: 'p',
      category: 'queue' as const,
      criticality: 'critical' as const,
      scope: 'deployment' as const,
      userVisibleWhenDown: true,
      enabled: true,
      configState: 'valid' as const,
      configIssues: [] as string[],
      configSummary: {},
      healthState: 'running' as const,
      lastCheckAt: 't',
      lastActivityAt: 't',
      failureReason: null,
      nextStep: 'n',
      dependencies: {},
    },
    {
      id: 'job-pipelines',
      name: 'Pipelines',
      purpose: 'p',
      category: 'data' as const,
      criticality: 'critical' as const,
      scope: 'deployment' as const,
      userVisibleWhenDown: true,
      enabled: true,
      configState: 'valid' as const,
      configIssues: [],
      configSummary: {},
      healthState: 'running' as const,
      lastCheckAt: 't',
      lastActivityAt: null,
      failureReason: null,
      nextStep: 'n',
      dependencies: {},
    },
  ];

  return {
    checkedAt: '2025-01-01T00:00:00.000Z',
    bootstrap: {
      installed: true,
      installedAt: '2025-01-01T00:00:00.000Z',
      bootstrapVersion: 1,
      readiness: 'ready',
      blockers: [],
      warnings: [],
    },
    dependencies: {
      database: { ok: true, checkedAt: 't' },
      redis: { ok: true, checkedAt: 't' },
      sessionStore: { ok: true, checkedAt: 't' },
    },
    services,
    ...overrides,
  };
}

describe('toPublicHealthSummary', () => {
  it('ready when deps and worker ok', () => {
    const s = toPublicHealthSummary(baseReport());
    expect(s.ready).toBe(true);
    expect(s.checks.worker).toBe(true);
  });
  it('not ready when worker failed', () => {
    const report = baseReport();
    report.services = report.services.map((x) =>
      x.id === 'worker-runtime' ? { ...x, healthState: 'failed' as const } : x
    );
    expect(toPublicHealthSummary(report).ready).toBe(false);
  });
});
