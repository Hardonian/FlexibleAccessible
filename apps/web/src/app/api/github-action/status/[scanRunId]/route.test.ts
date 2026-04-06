import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireSessionMock,
  requireCanonicalOrgAccessMock,
  findGithubActionScanRunMock,
  getScanRunSeverityCountsMock,
} = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  requireCanonicalOrgAccessMock: vi.fn(),
  findGithubActionScanRunMock: vi.fn(),
  getScanRunSeverityCountsMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  requireSession: requireSessionMock,
}));

vi.mock("@/lib/server-org-boundary", () => ({
  requireCanonicalOrgAccess: requireCanonicalOrgAccessMock,
}));

vi.mock("@/lib/integrations/org-scoped-queries", () => ({
  findGithubActionScanRun: findGithubActionScanRunMock,
  getScanRunSeverityCounts: getScanRunSeverityCountsMock,
}));

import { GET } from "./route";

describe("GET /api/github-action/status/[scanRunId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({
      id: "user_1",
      email: "u@test",
      name: null,
      emailVerified: true,
    });
  });

  it("fails closed when organizationId is missing", async () => {
    requireCanonicalOrgAccessMock.mockRejectedValue({ code: "BAD_REQUEST" });

    const response = await GET(
      new Request("http://localhost/api/github-action/status/scan_1"),
      { params: Promise.resolve({ scanRunId: "scan_1" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "organizationId is required",
    });
  });

  it("returns severity counts only for canonically scoped scan", async () => {
    requireCanonicalOrgAccessMock.mockResolvedValue({ organizationId: "org_1", role: "ADMIN" });
    findGithubActionScanRunMock.mockResolvedValue({
      id: "scan_1",
      status: "COMPLETED",
      pagesScanned: 10,
      siteId: "site_1",
      startedAt: null,
      completedAt: null,
    });
    getScanRunSeverityCountsMock.mockResolvedValue([
      { impact: "CRITICAL", _count: { _all: 2 } },
      { impact: "SERIOUS", _count: { _all: 1 } },
    ]);

    const response = await GET(
      new Request("http://localhost/api/github-action/status/scan_1?organizationId=org_1"),
      { params: Promise.resolve({ scanRunId: "scan_1" }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.severityCounts).toEqual({ CRITICAL: 2, SERIOUS: 1 });
    expect(payload.data.score).toBe(95);
    expect(findGithubActionScanRunMock).toHaveBeenCalledWith(
      { organizationId: "org_1", role: "ADMIN" },
      "scan_1",
    );
  });
});
