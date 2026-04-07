import { describe, expect, it } from "vitest";
import { scoreFindingPriority } from "./finding-priority";

describe("scoreFindingPriority", () => {
  it("ranks critical regressions above moderate one-off issues", () => {
    const a = scoreFindingPriority({
      impact: "CRITICAL",
      truthStatus: "OPEN",
      distinctScanRunsObserved: 4,
      occurrenceCount: 12,
      reopenedCount: 2,
    });
    const b = scoreFindingPriority({
      impact: "MODERATE",
      truthStatus: "VERIFIED_FIXED",
      distinctScanRunsObserved: 1,
      occurrenceCount: 1,
      reopenedCount: 0,
    });
    expect(a.score).toBeLessThan(b.score);
    expect(a.reasons.length).toBeGreaterThan(0);
  });
});
