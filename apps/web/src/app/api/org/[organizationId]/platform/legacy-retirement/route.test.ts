import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@aros/shared';

const requireOrgAccessMock = vi.fn();
const evaluateMock = vi.fn();
const logActionMock = vi.fn();

vi.mock('@/lib/auth-guard', () => ({
  requireOrgAccess: requireOrgAccessMock,
}));

vi.mock('@/lib/operator-legacy-retirement', () => ({
  evaluateLegacyRetirementForOperator: evaluateMock,
}));

vi.mock('@/lib/operator-platform-audit', () => ({
  logOperatorPlatformAction: logActionMock,
}));

describe('POST /api/org/[organizationId]/platform/legacy-retirement', () => {
  it('rejects unauthorized callers', async () => {
    requireOrgAccessMock.mockRejectedValueOnce(ApiError.forbidden('Missing permission: org:system:manage'));

    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ organizationId: 'orgA' }),
    });

    expect(response.status).toBe(403);
    expect(evaluateMock).not.toHaveBeenCalled();
  });

  it('returns evaluation and logs evidence-gated blocked prune state', async () => {
    requireOrgAccessMock.mockResolvedValueOnce({ user: { id: 'user1' } });
    evaluateMock.mockResolvedValueOnce({
      inventory: [{ organizationId: 'orgA', dependence: 'legacy_fallback', requiresRepair: true }],
      readiness: {
        evaluationScope: 'operator_manage_scope',
        status: 'fallback_detected',
        inspectedOrganizationCount: 1,
        fallbackOrganizationCount: 1,
        fallbackOrganizationIds: ['orgA'],
        canSafelyPruneLegacyKeys: false,
        reason: 'Evaluation is scoped to manageable organizations.',
      },
    });

    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ organizationId: 'orgA' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.prune.allowed).toBe(false);
    expect(logActionMock).toHaveBeenCalledTimes(2);
  });
});
