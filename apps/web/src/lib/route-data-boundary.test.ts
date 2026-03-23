import { describe, expect, it, vi, beforeEach } from 'vitest';
import { resolveDashboardOrgMembership, runOrgScopedQuery } from './route-data-boundary';
import type { RoutePlatformTruth } from '@aros/core-services';

const findFirst = vi.fn();

vi.mock('./db', () => ({
  prisma: {
    membership: { findFirst: (...args: unknown[]) => findFirst(...args) },
  },
}));

function truth(allow: boolean): RoutePlatformTruth {
  return {
    checkedAt: 'x',
    shellBlocker: allow ? 'none' : 'critical_dependency_down',
    allowOrgScopedDbReads: allow,
    readiness: allow ? 'ready' : 'blocked',
    installed: true,
    userImpactSummary: [],
    operatorRemediationHints: [],
    flags: {
      databaseOk: allow,
      redisOk: true,
      sessionOk: allow,
      envConfigOk: true,
      workerRunning: true,
      jobPipelinesHealthy: true,
    },
    optionalSubsystemIssues: [],
  };
}

describe('resolveDashboardOrgMembership', () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  it('returns platform_blocked without calling prisma when reads disallowed', async () => {
    const t = truth(false);
    const r = await resolveDashboardOrgMembership('u1', t);
    expect(r).toEqual({ kind: 'platform_blocked', truth: t });
    expect(findFirst).not.toHaveBeenCalled();
  });

  it('returns ok when prisma returns a row', async () => {
    findFirst.mockResolvedValue({ organizationId: 'o1', role: 'DEVELOPER' });
    const r = await resolveDashboardOrgMembership('u1', truth(true));
    expect(r).toEqual({ kind: 'ok', organizationId: 'o1', role: 'DEVELOPER' });
  });

  it('returns error envelope when prisma throws', async () => {
    findFirst.mockRejectedValue(new Error('connection refused'));
    const r = await resolveDashboardOrgMembership('u1', truth(true));
    expect(r).toEqual({ kind: 'error', message: 'connection refused' });
  });
});

describe('runOrgScopedQuery', () => {
  it('returns ok with data', async () => {
    const r = await runOrgScopedQuery({ organizationId: 'o1', role: 'DEVELOPER' }, async () => 42);
    expect(r).toEqual({ ok: true, data: 42 });
  });

  it('returns failure envelope when fn throws', async () => {
    const r = await runOrgScopedQuery({ organizationId: 'o1', role: 'DEVELOPER' }, async () => {
      throw new Error('boom');
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe('boom');
  });
});
