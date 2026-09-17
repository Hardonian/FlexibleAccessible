import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findManyMock, findUniqueMock } = vi.hoisted(() => ({
  findManyMock: vi.fn(),
  findUniqueMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    membership: { findMany: findManyMock },
    platformState: { findUnique: findUniqueMock },
  },
}));

vi.mock('@aros/config', () => ({
  hasPermission: (role: string, permission: string) => permission === 'org:system:manage' && (role === 'OWNER' || role === 'ADMIN'),
}));

import { evaluateLegacyRetirementForOperator } from './operator-legacy-retirement';

describe('evaluateLegacyRetirementForOperator', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('reports fallback-dependent org inventory and blocks prune assertions', async () => {
    findManyMock.mockResolvedValueOnce([
      { organizationId: 'orgA', role: 'OWNER' },
      { organizationId: 'orgB', role: 'ADMIN' },
      { organizationId: 'orgC', role: 'DEVELOPER' },
    ]);
    findUniqueMock.mockResolvedValueOnce({
      productFlags: {
        operatorPrefs: { suppressedOptionalDiagnosticIds: ['svc:slack-webhooks'] },
        operatorPrefsByOrg: {
          orgB: { suppressedOptionalDiagnosticIds: [] },
        },
      },
    });

    const result = await evaluateLegacyRetirementForOperator('user1');

    expect(result.inventory).toEqual([
      { organizationId: 'orgA', dependence: 'legacy_fallback', requiresRepair: true },
      { organizationId: 'orgB', dependence: 'scoped_clean', requiresRepair: false },
    ]);
    expect(result.readiness.evaluationScope).toBe('operator_manage_scope');
    expect(result.readiness.status).toBe('fallback_detected');
    expect(result.readiness.fallbackOrganizationIds).toEqual(['orgA']);
    expect(result.readiness.canSafelyPruneLegacyKeys).toBe(false);
  }, 15000);

  it('returns unknown readiness when operator has no manageable organizations', async () => {
    findManyMock.mockResolvedValueOnce([{ organizationId: 'orgC', role: 'DEVELOPER' }]);
    findUniqueMock.mockResolvedValueOnce({ productFlags: {} });

    const result = await evaluateLegacyRetirementForOperator('user2');

    expect(result.inventory).toEqual([]);
    expect(result.readiness.evaluationScope).toBe('operator_manage_scope');
    expect(result.readiness.status).toBe('unknown');
    expect(result.readiness.inspectedOrganizationCount).toBe(0);
  }, 15000);

  it('supports strict organization-scoped evaluation to avoid cross-org inventory leakage', async () => {
    findManyMock.mockResolvedValueOnce([
      { organizationId: 'orgA', role: 'OWNER' },
      { organizationId: 'orgB', role: 'ADMIN' },
    ]);
    findUniqueMock.mockResolvedValueOnce({
      productFlags: {
        operatorPrefs: { suppressedOptionalDiagnosticIds: ['svc:stripe-billing'] },
        operatorPrefsByOrg: {
          orgB: { suppressedOptionalDiagnosticIds: [] },
        },
      },
    });

    const result = await evaluateLegacyRetirementForOperator('user1', { organizationId: 'orgB' });

    expect(result.inventory).toEqual([
      { organizationId: 'orgB', dependence: 'scoped_clean', requiresRepair: false },
    ]);
    expect(result.readiness.evaluationScope).toBe('organization_scope');
    expect(result.readiness.inspectedOrganizationCount).toBe(1);
    expect(result.readiness.fallbackOrganizationIds).toEqual([]);
    expect(result.readiness.reason).toContain('requested organization');
  }, 15000);
});
