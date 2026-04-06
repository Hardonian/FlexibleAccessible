import { describe, expect, it } from 'vitest';
import { buildRoutePlatformTruth } from './route-platform-truth';
import type { PlatformHealthReport } from './types';

function baseReport(overrides: Partial<PlatformHealthReport> = {}): PlatformHealthReport {
  const services = overrides.services;
  return {
    checkedAt: '2025-01-01T00:00:00.000Z',
    liveInfraProbes: 'live' as const,
    bootstrap: {
      installed: true,
      installedAt: '2025-01-01T00:00:00.000Z',
      bootstrapVersion: 1,
      readiness: 'ready',
      blockers: [],
      warnings: [],
      ...overrides.bootstrap,
    },
    dependencies: {
      database: { ok: true, checkedAt: '2025-01-01T00:00:00.000Z' },
      redis: { ok: true, checkedAt: '2025-01-01T00:00:00.000Z' },
      sessionStore: { ok: true, checkedAt: '2025-01-01T00:00:00.000Z' },
      outboundEmail: { ok: true, checkedAt: '2025-01-01T00:00:00.000Z' },
      ...overrides.dependencies,
    },
    operatorPlatformFlags: overrides.operatorPlatformFlags ?? {},
    services:
      services ??
      ([
        {
          id: 'app-api',
          name: 'Web application',
          purpose: '',
          category: 'data',
          criticality: 'critical',
          scope: 'deployment',
          userVisibleWhenDown: true,
          enabled: true,
          configState: 'valid',
          configIssues: [],
          configSummary: {},
          healthState: 'ready',
          lastCheckAt: '2025-01-01T00:00:00.000Z',
          lastActivityAt: null,
          failureReason: null,
          nextStep: '',
          dependencies: {},
        },
        {
          id: 'database',
          name: 'PostgreSQL',
          purpose: '',
          category: 'data',
          criticality: 'critical',
          scope: 'deployment',
          userVisibleWhenDown: true,
          enabled: true,
          configState: 'valid',
          configIssues: [],
          configSummary: {},
          healthState: 'running',
          lastCheckAt: '2025-01-01T00:00:00.000Z',
          lastActivityAt: null,
          failureReason: null,
          nextStep: '',
          dependencies: {},
        },
        {
          id: 'redis-queue',
          name: 'Redis',
          purpose: '',
          category: 'queue',
          criticality: 'critical',
          scope: 'deployment',
          userVisibleWhenDown: true,
          enabled: true,
          configState: 'valid',
          configIssues: [],
          configSummary: {},
          healthState: 'running',
          lastCheckAt: '2025-01-01T00:00:00.000Z',
          lastActivityAt: null,
          failureReason: null,
          nextStep: '',
          dependencies: {},
        },
        {
          id: 'worker-runtime',
          name: 'Workers',
          purpose: '',
          category: 'queue',
          criticality: 'critical',
          scope: 'deployment',
          userVisibleWhenDown: true,
          enabled: true,
          configState: 'valid',
          configIssues: [],
          configSummary: {},
          healthState: 'running',
          lastCheckAt: '2025-01-01T00:00:00.000Z',
          lastActivityAt: null,
          failureReason: null,
          nextStep: '',
          dependencies: {},
        },
        {
          id: 'job-pipelines',
          name: 'Pipelines',
          purpose: '',
          category: 'data',
          criticality: 'critical',
          scope: 'deployment',
          userVisibleWhenDown: true,
          enabled: true,
          configState: 'valid',
          configIssues: [],
          configSummary: {},
          healthState: 'running',
          lastCheckAt: '2025-01-01T00:00:00.000Z',
          lastActivityAt: null,
          failureReason: null,
          nextStep: '',
          dependencies: {},
        },
        {
          id: 'session-auth',
          name: 'Sessions',
          purpose: '',
          category: 'auth',
          criticality: 'critical',
          scope: 'deployment',
          userVisibleWhenDown: true,
          enabled: true,
          configState: 'valid',
          configIssues: [],
          configSummary: {},
          healthState: 'running',
          lastCheckAt: '2025-01-01T00:00:00.000Z',
          lastActivityAt: null,
          failureReason: null,
          nextStep: '',
          dependencies: {},
        },
      ] as PlatformHealthReport['services']),
    ...overrides,
  };
}

describe('buildRoutePlatformTruth', () => {
  it('returns neutral shell when live probes skipped (build)', () => {
    const truth = buildRoutePlatformTruth({
      checkedAt: 't',
      liveInfraProbes: 'skipped_build',
      bootstrap: {
        installed: false,
        installedAt: null,
        bootstrapVersion: 0,
        readiness: 'ready',
        blockers: [],
        warnings: [],
      },
      dependencies: {
        database: { ok: true, checkedAt: 't', skipped: true },
        redis: { ok: true, checkedAt: 't', skipped: true },
        sessionStore: { ok: true, checkedAt: 't' },
        outboundEmail: { ok: true, checkedAt: 't' },
      },
      services: [],
      operatorPlatformFlags: null,
    });
    expect(truth.liveInfraProbes).toBe('skipped_build');
    expect(truth.shellBlocker).toBe('none');
    expect(truth.flags.redisOk).toBe(true);
  });

  it('marks critical_dependency_down when database is down', () => {
    const t = buildRoutePlatformTruth(
      baseReport({
        dependencies: {
          database: { ok: false, checkedAt: 'x', message: 'down' },
          redis: { ok: true, checkedAt: 'x' },
          sessionStore: { ok: false, checkedAt: 'x', message: 'needs db' },
          outboundEmail: { ok: true, checkedAt: 'x' },
        },
      })
    );
    expect(t.shellBlocker).toBe('critical_dependency_down');
    expect(t.allowOrgScopedDbReads).toBe(false);
    expect(t.userImpactSummary.some((s) => /database/i.test(s))).toBe(true);
  });

  it('marks install_required when DB ok but platform not installed', () => {
    const t = buildRoutePlatformTruth(
      baseReport({
        bootstrap: {
          installed: false,
          installedAt: null,
          bootstrapVersion: 0,
          readiness: 'not_installed',
          blockers: ['seed'],
          warnings: [],
        },
      })
    );
    expect(t.shellBlocker).toBe('install_required');
    expect(t.allowOrgScopedDbReads).toBe(true);
  });

  it('surfaces worker degradation without blocking shell when pipelines still healthy', () => {
    const report = baseReport();
    const services = report.services.map((s) =>
      s.id === 'worker-runtime' ? { ...s, healthState: 'failed' as const, failureReason: 'stale' } : s
    );
    const t = buildRoutePlatformTruth({ ...report, services, bootstrap: { ...report.bootstrap, readiness: 'blocked', blockers: ['worker-runtime: failed'], warnings: [] } });
    expect(t.shellBlocker).toBe('deployment_misconfigured');
    expect(t.flags.workerRunning).toBe(false);
    expect(t.userImpactSummary.some((s) => /workers/i.test(s))).toBe(true);
  });
});
