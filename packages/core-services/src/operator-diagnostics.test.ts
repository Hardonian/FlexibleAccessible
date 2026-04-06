import { describe, expect, it } from 'vitest';
import {
  derivePlatformDiagnostics,
  parseOperatorPlatformFlags,
  serializeOperatorPlatformFlags,
} from './operator-diagnostics';
import type { PlatformHealthReport } from './types';

function minimalService(
  id: string,
  overrides: Partial<PlatformHealthReport['services'][number]> = {}
): PlatformHealthReport['services'][number] {
  const base = {
    id,
    name: id,
    purpose: 'p',
    category: 'data' as const,
    criticality: 'critical' as const,
    scope: 'deployment' as const,
    userVisibleWhenDown: true,
    enabled: true,
    configState: 'valid' as const,
    configIssues: [] as string[],
    configSummary: {},
    healthState: 'running' as const,
    lastCheckAt: 't',
    lastActivityAt: null as string | null,
    failureReason: null as string | null,
    nextStep: 'n',
    dependencies: {},
  };
  return { ...base, ...overrides };
}

function baseReport(overrides: Partial<PlatformHealthReport> = {}): PlatformHealthReport {
  const defaultServices: PlatformHealthReport['services'] = [
    minimalService('app-api', { healthState: 'ready', criticality: 'critical' }),
    minimalService('database', { healthState: 'running' }),
    minimalService('redis-queue', { healthState: 'running' }),
    minimalService('worker-runtime', { healthState: 'running' }),
    minimalService('job-pipelines', { healthState: 'running' }),
    minimalService('session-auth', { healthState: 'running' }),
    minimalService('stripe-billing', { criticality: 'optional', healthState: 'disabled', enabled: false }),
    minimalService('github-connector', { criticality: 'optional', healthState: 'disabled', enabled: false }),
    minimalService('jira-connector', { criticality: 'optional', healthState: 'ready' }),
    minimalService('ai-remediation', { criticality: 'optional', healthState: 'disabled', enabled: false }),
    minimalService('object-storage', { criticality: 'optional', healthState: 'disabled', enabled: false }),
  ];
  const services = overrides.services ?? defaultServices;

  return {
    checkedAt: overrides.checkedAt ?? '2025-01-01T00:00:00.000Z',
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
      database: { ok: true, checkedAt: 't' },
      redis: { ok: true, checkedAt: 't' },
      sessionStore: { ok: true, checkedAt: 't' },
      outboundEmail: { ok: true, checkedAt: 't' },
      ...overrides.dependencies,
    },
    services,
    operatorPlatformFlags: overrides.operatorPlatformFlags ?? {},
  };
}

describe('parseOperatorPlatformFlags', () => {
  it('round-trips through serialize', () => {
    const parsed = {
      prefs: { suppressedOptionalDiagnosticIds: ['svc:stripe-billing'] },
      acknowledgements: { acknowledgedIssueIds: ['svc:github-connector'], updatedAt: 'x' },
    };
    const raw = serializeOperatorPlatformFlags(parsed);
    expect(parseOperatorPlatformFlags(raw)).toEqual(parsed);
  });
});

describe('derivePlatformDiagnostics', () => {
  it('does not duplicate redis failure on redis-queue service row', () => {
    const report = baseReport({
      dependencies: {
        database: { ok: true, checkedAt: 't' },
        redis: { ok: false, checkedAt: 't', message: 'econnrefused' },
        sessionStore: { ok: true, checkedAt: 't' },
        outboundEmail: { ok: true, checkedAt: 't' },
      },
      services: [
        minimalService('app-api', { healthState: 'ready' }),
        minimalService('database', { healthState: 'running' }),
        minimalService('redis-queue', { healthState: 'unavailable', failureReason: 'Redis unreachable' }),
        minimalService('worker-runtime', { healthState: 'unavailable' }),
        minimalService('job-pipelines', { healthState: 'unavailable' }),
        minimalService('session-auth', { healthState: 'running' }),
        minimalService('stripe-billing', { criticality: 'optional', healthState: 'disabled', enabled: false }),
        minimalService('github-connector', { criticality: 'optional', healthState: 'disabled', enabled: false }),
        minimalService('jira-connector', { criticality: 'optional', healthState: 'ready' }),
        minimalService('ai-remediation', { criticality: 'optional', healthState: 'disabled', enabled: false }),
        minimalService('object-storage', { criticality: 'optional', healthState: 'disabled', enabled: false }),
      ],
    });
    const { issues } = derivePlatformDiagnostics(report);
    const redisSvcIssues = issues.filter((i) => i.id === 'svc:redis-queue');
    expect(redisSvcIssues).toHaveLength(0);
    expect(issues.some((i) => i.id === 'dep:redis')).toBe(true);
  });

  it('marks acknowledged issues and respects suppression for optional', () => {
    const report = baseReport({
      services: [
        minimalService('app-api', { healthState: 'ready' }),
        minimalService('database', { healthState: 'running' }),
        minimalService('redis-queue', { healthState: 'running' }),
        minimalService('worker-runtime', { healthState: 'running' }),
        minimalService('job-pipelines', { healthState: 'running' }),
        minimalService('session-auth', { healthState: 'running' }),
        minimalService('stripe-billing', {
          criticality: 'optional',
          enabled: true,
          healthState: 'misconfigured',
          configIssues: ['bad'],
          failureReason: 'stripe pair invalid',
          nextStep: 'fix env',
        }),
        minimalService('github-connector', { criticality: 'optional', healthState: 'disabled', enabled: false }),
        minimalService('jira-connector', { criticality: 'optional', healthState: 'ready' }),
        minimalService('ai-remediation', { criticality: 'optional', healthState: 'disabled', enabled: false }),
        minimalService('object-storage', { criticality: 'optional', healthState: 'disabled', enabled: false }),
      ],
    });
    const stripeIssueId = 'svc:stripe-billing';
    const withAck = derivePlatformDiagnostics(report, {
      prefs: { suppressedOptionalDiagnosticIds: [stripeIssueId] },
      acknowledgements: { acknowledgedIssueIds: [], updatedAt: null },
    });
    expect(withAck.issues.find((i) => i.id === stripeIssueId)?.suppressedFromBanner).toBe(true);
    expect(withAck.summary.optionalUnavailable.some((i) => i.id === stripeIssueId)).toBe(false);

    const withAck2 = derivePlatformDiagnostics(report, {
      prefs: { suppressedOptionalDiagnosticIds: [] },
      acknowledgements: { acknowledgedIssueIds: [stripeIssueId], updatedAt: 't' },
    });
    expect(withAck2.issues.find((i) => i.id === stripeIssueId)?.acknowledged).toBe(true);
  });
});
