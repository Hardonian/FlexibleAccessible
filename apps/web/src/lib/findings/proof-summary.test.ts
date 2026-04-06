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
      distinctScanRunsObserved: 1,
      distinctScanRunsAbsentWhenOpen: 0,
      evidenceSource: "AUTOMATED_AXE",
      sourceType: "SCAN",
    });

    expect(summary.comparisonBasis).toBe("automated_fingerprint_per_site");
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
      distinctScanRunsObserved: 2,
      evidenceSource: "AUTOMATED_AXE",
      sourceType: "SCAN",
    });

    expect(summary.completeness.hasSummary).toBe(false);
    expect(summary.changedSinceLastRun).toBe("regressed");
  });

  it("uses not_comparable for non-automated sources", () => {
    const summary = buildFindingProofSummary({
      evidenceSummary: {
        latestObservationAt: "2026-04-01T10:00:00.000Z",
        latestVerificationStatus: "FAILED",
      },
      provenance: null,
      firstSeenAt: new Date("2026-03-01T10:00:00.000Z"),
      lastSeenAt: new Date("2026-04-01T10:00:00.000Z"),
      reopenedCount: 0,
      evidenceSource: "MANUAL_REVIEW",
      sourceType: "SCAN",
    });
    expect(summary.comparisonBasis).toBe(
      "not_comparable_non_automated_source",
    );
    expect(summary.changedSinceLastRun).toBe("not_comparable");
  });

  it("marks improved open backlog when latest verification passed and absent-when-open count exists", () => {
    const summary = buildFindingProofSummary({
      evidenceSummary: {
        latestObservationAt: "2026-04-05T10:00:00.000Z",
        latestVerificationStatus: "PASSED",
      },
      provenance: { scanRunId: "s1" },
      firstSeenAt: new Date("2026-03-01T10:00:00.000Z"),
      lastSeenAt: new Date("2026-04-05T10:00:00.000Z"),
      reopenedCount: 0,
      distinctScanRunsObserved: 2,
      distinctScanRunsAbsentWhenOpen: 1,
      evidenceSource: "AUTOMATED_AXE",
      sourceType: "SCAN",
    });
    expect(summary.changedSinceLastRun).toBe("improved_open_backlog");
  });
});
