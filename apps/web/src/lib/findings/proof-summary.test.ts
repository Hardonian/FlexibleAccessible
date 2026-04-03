import { describe, expect, it } from "vitest";
import { buildFindingProofSummary } from "./proof-summary";

describe("buildFindingProofSummary", () => {
  it("extracts completeness and lineage fields", () => {
    const summary = buildFindingProofSummary({
      evidenceSummary: {
        latestObservationAt: "2026-04-01T10:00:00.000Z",
        latestVerificationStatus: "FAILED",
        pageUrl: "https://example.com",
      },
      provenance: {
        sourceType: "SCAN",
        scanRunId: "scan_123",
        rawViolationId: "raw_456",
        pageId: "page_789",
      },
      firstSeenAt: new Date("2026-04-01T10:00:00.000Z"),
      lastSeenAt: new Date("2026-04-01T10:00:00.000Z"),
      reopenedCount: 0,
    });

    expect(summary.completeness.hasSummary).toBe(true);
    expect(summary.completeness.hasLineage).toBe(true);
    expect(summary.lineage.scanRunId).toBe("scan_123");
    expect(summary.changedSinceLastRun).toBe("newly_detected");
  });

  it("marks regressed when reopened", () => {
    const summary = buildFindingProofSummary({
      evidenceSummary: null,
      provenance: null,
      firstSeenAt: new Date("2026-03-01T10:00:00.000Z"),
      lastSeenAt: new Date("2026-04-01T10:00:00.000Z"),
      reopenedCount: 1,
    });

    expect(summary.completeness.hasSummary).toBe(false);
    expect(summary.changedSinceLastRun).toBe("regressed");
  });
});
