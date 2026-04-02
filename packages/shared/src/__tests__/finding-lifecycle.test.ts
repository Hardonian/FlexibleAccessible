import { describe, expect, it } from "vitest";
import {
  canOperatorTransition,
  deriveAutomationEvidenceFreshness,
  shouldReopenOnAutomatedDetection,
} from "../finding-lifecycle.js";

describe("canOperatorTransition", () => {
  it("allows same state", () => {
    expect(canOperatorTransition("OPEN", "OPEN")).toBe(true);
  });

  it("allows OPEN -> ACKNOWLEDGED", () => {
    expect(canOperatorTransition("OPEN", "ACKNOWLEDGED")).toBe(true);
  });

  it("blocks FALSE_POSITIVE -> RESOLVED without going through OPEN", () => {
    expect(canOperatorTransition("FALSE_POSITIVE", "RESOLVED")).toBe(false);
  });

  it("allows FALSE_POSITIVE -> OPEN", () => {
    expect(canOperatorTransition("FALSE_POSITIVE", "OPEN")).toBe(true);
  });
});

describe("shouldReopenOnAutomatedDetection", () => {
  it("reopens RESOLVED when violation returns", () => {
    expect(shouldReopenOnAutomatedDetection("RESOLVED")).toBe(true);
  });

  it("does not reopen WONT_FIX", () => {
    expect(shouldReopenOnAutomatedDetection("WONT_FIX")).toBe(false);
  });

  it("does not reopen FALSE_POSITIVE", () => {
    expect(shouldReopenOnAutomatedDetection("FALSE_POSITIVE")).toBe(false);
  });
});

describe("deriveAutomationEvidenceFreshness", () => {
  const t = (iso: string) => new Date(iso);

  it("returns pipeline_degraded when pipelines unhealthy", () => {
    expect(
      deriveAutomationEvidenceFreshness({
        lastVerifiedAt: t("2025-01-02T00:00:00Z"),
        latestCompletedScanCompletedAt: t("2025-01-01T00:00:00Z"),
        jobPipelinesHealthy: false,
      }),
    ).toBe("pipeline_degraded");
  });

  it("returns stale when a newer completed scan exists than lastVerifiedAt", () => {
    expect(
      deriveAutomationEvidenceFreshness({
        lastVerifiedAt: t("2025-01-01T00:00:00Z"),
        latestCompletedScanCompletedAt: t("2025-01-02T00:00:00Z"),
        jobPipelinesHealthy: true,
      }),
    ).toBe("stale_newer_scan_exists");
  });

  it("returns current when lastVerifiedAt is after latest scan", () => {
    expect(
      deriveAutomationEvidenceFreshness({
        lastVerifiedAt: t("2025-01-03T00:00:00Z"),
        latestCompletedScanCompletedAt: t("2025-01-02T00:00:00Z"),
        jobPipelinesHealthy: true,
      }),
    ).toBe("current");
  });
});
