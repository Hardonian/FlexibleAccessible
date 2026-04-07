import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireSessionMock,
  requireCanonicalOrgAccessMock,
  findVpatSiteMock,
  getOrganizationNameMock,
  generateVpatReportMock,
  createVpatReportRecordMock,
} = vi.hoisted(() => ({
  requireSessionMock: vi.fn(),
  requireCanonicalOrgAccessMock: vi.fn(),
  findVpatSiteMock: vi.fn(),
  getOrganizationNameMock: vi.fn(),
  generateVpatReportMock: vi.fn(),
  createVpatReportRecordMock: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  requireSession: requireSessionMock,
}));

vi.mock("@/lib/server-org-boundary", () => ({
  requireCanonicalOrgAccess: requireCanonicalOrgAccessMock,
}));

vi.mock("@/lib/reports/org-scoped-queries", () => ({
  findVpatSite: findVpatSiteMock,
  getOrganizationName: getOrganizationNameMock,
  createVpatReportRecord: createVpatReportRecordMock,
}));

vi.mock("@/lib/vpat/generator", () => ({
  generateVpatReport: generateVpatReportMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    subscription: {
      findUnique: vi.fn().mockResolvedValue(null),
    },
    usageRecord: {
      create: vi.fn(),
    },
  },
}));

import { GET } from "./route";

describe("GET /api/reports/vpat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireSessionMock.mockResolvedValue({
      id: "user_1",
      email: "u@test",
      name: null,
      emailVerified: true,
    });
  });

  it("returns 400 for missing organization context", async () => {
    const response = await GET(new Request("http://localhost/api/reports/vpat?siteId=site_1"));
    expect(response.status).toBe(400);
  });

  it("uses canonical org context and scoped queries", async () => {
    requireCanonicalOrgAccessMock.mockResolvedValue({ organizationId: "org_1", role: "OWNER" });
    findVpatSiteMock.mockResolvedValue({ id: "site_1", name: "Main", domain: "example.com" });
    getOrganizationNameMock.mockResolvedValue({ name: "Acme" });
    generateVpatReportMock.mockResolvedValue({
      summary: { supports: 1, partiallySupports: 2, doesNotSupport: 3 },
      rows: [],
    });

    const response = await GET(
      new Request("http://localhost/api/reports/vpat?organizationId=org_1&siteId=site_1"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(findVpatSiteMock).toHaveBeenCalledWith(
      { organizationId: "org_1", role: "OWNER" },
      "site_1",
    );
    expect(createVpatReportRecordMock).toHaveBeenCalled();
  });
});
