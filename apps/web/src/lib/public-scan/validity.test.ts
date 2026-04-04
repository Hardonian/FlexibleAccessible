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
      getPublicScanEvidenceState(
        { status: "COMPLETED", completedAt: new Date("2020-01-01T00:00:00Z"), expiresAt: new Date("2020-01-01T00:00:00Z") },
        new Date("2020-01-02T00:00:00Z"),
      ),
    ).toBe("expired");
  });

  it("classifies failed records as failed", () => {
    expect(
      getPublicScanEvidenceState({ status: "FAILED", completedAt: null, expiresAt: null }),
    ).toBe("failed");
  });

  it("classifies non-complete records as incomplete", () => {
    expect(
      getPublicScanEvidenceState({ status: "RUNNING", completedAt: null, expiresAt: null }),
    ).toBe("incomplete");
  });

  it("classifies completed unexpired records as valid", () => {
    expect(
      getPublicScanEvidenceState(
        { status: "COMPLETED", completedAt: new Date("2020-01-01T00:00:00Z"), expiresAt: new Date("2020-01-03T00:00:00Z") },
        new Date("2020-01-02T00:00:00Z"),
      ),
    ).toBe("valid");
  });

  it("treats completed rows without expiresAt as expired (fail closed)", () => {
    expect(
      getPublicScanEvidenceState(
        { status: "COMPLETED", completedAt: new Date("2020-01-01T00:00:00Z"), expiresAt: null },
        new Date("2020-01-02T00:00:00Z"),
      ),
    ).toBe("expired");
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
      evidenceState: "expired",
      score: 90,
      totalViolations: 2,
      expiresAt: new Date("2020-01-02T00:00:00Z"),
      evidenceExpiresAt: null,
    });
  });

  it("exposes evidence expiry on API payload when evidence is valid", () => {
    const exp = new Date("2030-01-05T00:00:00Z");
    const payload = toPublicScanApiPayload({
      id: "scan_456",
      domain: "example.com",
      status: "COMPLETED",
      score: 88,
      totalViolations: 1,
      criticalCount: 0,
      seriousCount: 0,
      moderateCount: 1,
      minorCount: 0,
      pagesScanned: 3,
      violations: [],
      screenshotKeys: [],
      createdAt: new Date("2030-01-01T00:00:00Z"),
      completedAt: new Date("2030-01-01T00:05:00Z"),
      expiresAt: exp,
    });

    expect(payload.evidenceState).toBe("valid");
    expect(payload.evidenceExpiresAt).toEqual(exp);
  });
});
