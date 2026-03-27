import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@aros/shared';

const requireOrgAccessMock = vi.fn();
const backfillMock = vi.fn();
const getPayloadMock = vi.fn();
const logActionMock = vi.fn();

vi.mock('@/lib/auth-guard', () => ({
  requireOrgAccess: requireOrgAccessMock,
}));

vi.mock('@/lib/operator-product-flags', () => ({
  backfillLegacyOperatorFlagsForOrganization: backfillMock,
}));

vi.mock('@/lib/platform-health', () => ({
  getPlatformHealthPayload: getPayloadMock,
}));

vi.mock('@/lib/operator-platform-audit', () => ({
  logOperatorPlatformAction: logActionMock,
}));

describe('POST /api/org/[organizationId]/platform/repair-legacy-flags', () => {
  it('rejects unauthorized callers', async () => {
    requireOrgAccessMock.mockRejectedValueOnce(ApiError.forbidden('Missing permission: org:system:manage'));

    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ organizationId: 'orgA' }),
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(backfillMock).not.toHaveBeenCalled();
  });

  it('runs repair and returns updated payload for authorized operator', async () => {
    requireOrgAccessMock.mockResolvedValueOnce({ user: { id: 'user1' } });
    backfillMock.mockResolvedValueOnce({ status: 'migrated', source: 'legacy_fallback', migrated: true });
    getPayloadMock.mockResolvedValueOnce({ operatorFlagsStatus: { source: 'scoped', requiresRepair: false } });

    const { POST } = await import('./route');
    const response = await POST(new Request('http://localhost'), {
      params: Promise.resolve({ organizationId: 'orgA' }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data.result.status).toBe('migrated');
    expect(backfillMock).toHaveBeenCalledWith('orgA');
    expect(logActionMock).toHaveBeenCalled();
  });
});
