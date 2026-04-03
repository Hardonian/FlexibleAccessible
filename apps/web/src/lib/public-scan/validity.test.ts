import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    publicScanResult: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));
import { getPublicScanEvidenceState, toPublicScanApiPayload } from "./validity";

describe("public scan validity contract", () => {
  it("classifies missing records as missing", () => {
    expect(getPublicScanEvidenceState(null)).toBe("missing");
  });

  it("classifies expired records as expired", () => {
    expect(
      getPublicScanEvidenceState({ expiresAt: new Date("2020-01-01T00:00:00Z") }, new Date("2020-01-02T00:00:00Z")),
    ).toBe("expired");
  });

  it("classifies unexpired records as valid", () => {
    expect(
      getPublicScanEvidenceState({ expiresAt: new Date("2020-01-03T00:00:00Z") }, new Date("2020-01-02T00:00:00Z")),
    ).toBe("valid");
  });

  it("maps canonical API payload fields", () => {
    const payload = toPublicScanApiPayload({
      id: "scan_123",
      domain: "example.com",
      status: "COMPLETED",
      score: 90,
      totalViolations: 2,
      criticalCount: 0,
      seriousCount: 1,
      moderateCount: 1,
      minorCount: 0,
      pagesScanned: 5,
      violations: [],
      screenshotKeys: [],
      createdAt: new Date("2020-01-01T00:00:00Z"),
      completedAt: new Date("2020-01-01T00:05:00Z"),
      expiresAt: new Date("2020-01-02T00:00:00Z"),
    });

    expect(payload).toMatchObject({
      id: "scan_123",
      domain: "example.com",
      status: "COMPLETED",
      score: 90,
      totalViolations: 2,
    });
    expect(payload).not.toHaveProperty("expiresAt");
  });
});
