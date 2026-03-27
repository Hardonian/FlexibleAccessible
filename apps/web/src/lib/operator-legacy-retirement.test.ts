import { beforeEach, describe, expect, it, vi } from 'vitest';

const findManyMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock('@/lib/db', () => ({
  prisma: {
    membership: { findMany: findManyMock },
    platformState: { findUnique: findUniqueMock },
  },
}));

vi.mock('@aros/config', () => ({
  hasPermission: (role: string, permission: string) => permission === 'org:system:manage' && (role === 'OWNER' || role === 'ADMIN'),
}));

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

    const { evaluateLegacyRetirementForOperator } = await import('./operator-legacy-retirement');
    const result = await evaluateLegacyRetirementForOperator('user1');

    expect(result.inventory).toEqual([
      { organizationId: 'orgA', dependence: 'legacy_fallback', requiresRepair: true },
      { organizationId: 'orgB', dependence: 'scoped_clean', requiresRepair: false },
    ]);
    expect(result.readiness.status).toBe('fallback_detected');
    expect(result.readiness.fallbackOrganizationIds).toEqual(['orgA']);
    expect(result.readiness.canSafelyPruneLegacyKeys).toBe(false);
  });

  it('returns unknown readiness when operator has no manageable organizations', async () => {
    findManyMock.mockResolvedValueOnce([{ organizationId: 'orgC', role: 'DEVELOPER' }]);
    findUniqueMock.mockResolvedValueOnce({ productFlags: {} });

    const { evaluateLegacyRetirementForOperator } = await import('./operator-legacy-retirement');
    const result = await evaluateLegacyRetirementForOperator('user2');

    expect(result.inventory).toEqual([]);
    expect(result.readiness.status).toBe('unknown');
    expect(result.readiness.inspectedOrganizationCount).toBe(0);
  });
});
