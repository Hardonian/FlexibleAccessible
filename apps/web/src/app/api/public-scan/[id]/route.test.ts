import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    publicScanResult: {
      findUnique: findUniqueMock,
    },
  },
}));

import { GET } from "./route";

describe("GET /api/public-scan/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 410 with machine-visible expired semantics", async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: "scan_1",
      domain: "example.com",
      status: "COMPLETED",
      score: 80,
      totalViolations: 1,
      criticalCount: 0,
      seriousCount: 1,
      moderateCount: 0,
      minorCount: 0,
      pagesScanned: 1,
      violations: [],
      screenshotKeys: [],
      createdAt: new Date(Date.now() - 120_000),
      completedAt: new Date(Date.now() - 60_000),
      expiresAt: new Date(Date.now() - 30_000),
    });

    const response = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: "scan_1" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(410);
    expect(payload).toMatchObject({
      success: false,
      error: {
        code: "SCAN_EXPIRED",
        details: {
          evidenceState: "expired",
          expired: true,
        },
      },
    });
  });
});
