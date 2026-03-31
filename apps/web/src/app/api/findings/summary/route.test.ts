import { describe, expect, it, vi, beforeEach } from 'vitest';

const requireSessionMock = vi.fn();
const findUniqueMock = vi.fn();
const getRoutePlatformTruthMock = vi.fn();
const resolveDashboardOrgMembershipMock = vi.fn();
const buildFindingsOperationalSummaryMock = vi.fn();

vi.mock('@/lib/session', () => ({
  requireSession: requireSessionMock,
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    membership: {
      findUnique: findUniqueMock,
    },
  },
}));

vi.mock('@/lib/platform-truth-cache', () => ({
  getRoutePlatformTruth: getRoutePlatformTruthMock,
}));

vi.mock('@/lib/route-data-boundary', () => ({
  resolveDashboardOrgMembership: resolveDashboardOrgMembershipMock,
}));

vi.mock('@/lib/findings/reporting-summary', () => ({
  buildFindingsOperationalSummary: buildFindingsOperationalSummaryMock,
}));

describe('GET /api/findings/summary', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 503 degraded before org resolution when route truth blocks reads', async () => {
    requireSessionMock.mockResolvedValueOnce({ id: 'user-1' });
    getRoutePlatformTruthMock.mockResolvedValueOnce({
      allowOrgScopedDbReads: false,
      userImpactSummary: ['Database unavailable'],
    });

    const { GET } = await import('./route');
    const response = await GET(new Request('http://localhost/api/findings/summary'));

    expect(response.status).toBe(503);
    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(resolveDashboardOrgMembershipMock).not.toHaveBeenCalled();
    expect(buildFindingsOperationalSummaryMock).not.toHaveBeenCalled();
  });

  it('fails closed for an explicit organizationId instead of falling back to another org', async () => {
    requireSessionMock.mockResolvedValueOnce({ id: 'user-1' });
    getRoutePlatformTruthMock.mockResolvedValueOnce({
      allowOrgScopedDbReads: true,
      userImpactSummary: [],
      flags: {
        jobPipelinesHealthy: true,
        workerRunning: true,
      },
      optionalSubsystemIssues: [],
    });
    findUniqueMock.mockResolvedValueOnce(null);

    const { GET } = await import('./route');
    const response = await GET(
      new Request('http://localhost/api/findings/summary?organizationId=org-missing'),
    );

    expect(response.status).toBe(404);
    expect(findUniqueMock).toHaveBeenCalledTimes(1);
    expect(resolveDashboardOrgMembershipMock).not.toHaveBeenCalled();
    expect(buildFindingsOperationalSummaryMock).not.toHaveBeenCalled();
  });
});
