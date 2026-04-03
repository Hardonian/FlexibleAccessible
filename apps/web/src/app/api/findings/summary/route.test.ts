import { describe, expect, it, vi, beforeEach } from 'vitest';

const requireOrgAccessMock = vi.fn();
const getRoutePlatformTruthMock = vi.fn();
const buildFindingsOperationalSummaryMock = vi.fn();

vi.mock('@/lib/auth-guard', () => ({
  requireOrgAccess: requireOrgAccessMock,
}));

vi.mock('@/lib/platform-truth-cache', () => ({
  getRoutePlatformTruth: getRoutePlatformTruthMock,
}));

vi.mock('@/lib/findings/reporting-summary', () => ({
  buildFindingsOperationalSummary: buildFindingsOperationalSummaryMock,
}));

vi.mock('@/lib/db', () => ({
  prisma: {},
}));

describe('GET /api/findings/summary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 400 when organizationId is missing', async () => {
    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/findings/summary'));

    expect(response.status).toBe(400);
    expect(requireOrgAccessMock).not.toHaveBeenCalled();
    expect(buildFindingsOperationalSummaryMock).not.toHaveBeenCalled();
  });

  it('fails closed for an explicit organizationId when org access denies', async () => {
    requireOrgAccessMock.mockRejectedValueOnce(new Error('You do not have access to this organization'));

    const { GET } = await import('./route');
    const response = await GET(
      new Request('http://localhost/api/findings/summary?organizationId=org-missing'),
    );

    expect(response.status).toBe(403);
    expect(buildFindingsOperationalSummaryMock).not.toHaveBeenCalled();
  });
});
