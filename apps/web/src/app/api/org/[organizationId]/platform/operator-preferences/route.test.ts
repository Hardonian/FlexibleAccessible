import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@aros/shared';

const requireOrgAccessMock = vi.fn();
const updateOperatorFlagsForOrganizationMock = vi.fn();
const getPlatformHealthPayloadMock = vi.fn();
const logOperatorPlatformActionMock = vi.fn();

type TestOperatorFlags = {
  prefs: { suppressedOptionalDiagnosticIds: string[] };
  acknowledgements: { acknowledgedIssueIds: string[]; updatedAt: string | null };
};

vi.mock('@/lib/auth-guard', () => ({
  requireOrgAccess: requireOrgAccessMock,
}));

vi.mock('@/lib/operator-product-flags', () => ({
  updateOperatorFlagsForOrganization: updateOperatorFlagsForOrganizationMock,
}));

vi.mock('@/lib/platform-health', () => ({
  getPlatformHealthPayload: getPlatformHealthPayloadMock,
}));

vi.mock('@/lib/operator-platform-audit', () => ({
  logOperatorPlatformAction: logOperatorPlatformActionMock,
}));

describe('PATCH /api/org/[organizationId]/platform/operator-preferences', () => {
  it('rejects unauthorized callers', async () => {
    requireOrgAccessMock.mockRejectedValueOnce(ApiError.forbidden('Missing permission: org:system:manage'));

    const { PATCH } = await import('./route');
    const response = await PATCH(new Request('http://localhost', { method: 'PATCH' }), {
      params: Promise.resolve({ organizationId: 'orgA' }),
    });

    expect(response.status).toBe(403);
    expect(updateOperatorFlagsForOrganizationMock).not.toHaveBeenCalled();
  });

  it('normalizes duplicate suppression ids before persisting and returning response', async () => {
    requireOrgAccessMock.mockResolvedValueOnce({ user: { id: 'user1' } });
    getPlatformHealthPayloadMock.mockResolvedValueOnce({ routePlatformTruth: { shellBlocker: 'none' } });

    updateOperatorFlagsForOrganizationMock.mockResolvedValueOnce(undefined);

    const { PATCH } = await import('./route');
    const response = await PATCH(
      new Request('http://localhost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suppressedOptionalDiagnosticIds: ['svc:stripe-billing', 'svc:stripe-billing'],
        }),
      }),
      {
        params: Promise.resolve({ organizationId: 'orgA' }),
      }
    );

    expect(response.status).toBe(200);
    expect(updateOperatorFlagsForOrganizationMock).toHaveBeenCalledWith('orgA', expect.any(Function));
    const mutator = updateOperatorFlagsForOrganizationMock.mock.calls[0][1] as (current: TestOperatorFlags) => TestOperatorFlags;
    const mutated = mutator({
      prefs: { suppressedOptionalDiagnosticIds: [] },
      acknowledgements: { acknowledgedIssueIds: [], updatedAt: null },
    });
    expect(mutated.prefs.suppressedOptionalDiagnosticIds).toEqual(['svc:stripe-billing']);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.suppressedOptionalDiagnosticIds).toEqual(['svc:stripe-billing']);
    expect(logOperatorPlatformActionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'platform.operator_prefs.updated',
        outcome: 'success',
        metadata: { count: 1 },
      })
    );
  });
});
