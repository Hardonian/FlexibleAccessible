import { describe, expect, it } from "vitest";
import {
  findingsActiveFilterSummary,
  findingsListQueryString,
} from "./findings-list-query";

describe("findingsListQueryString", () => {
  it("preserves siteId, ruleId, and filters in pagination", () => {
    const q = findingsListQueryString(
      {
        severity: "CRITICAL",
        status: "OPEN",
        siteId: "s1",
        ruleId: "color-contrast",
        evidenceSource: "AUTOMATED_AXE",
      },
      2,
    );
    expect(q).toContain("page=2");
    expect(q).toContain("siteId=s1");
    expect(q).toContain("ruleId=color-contrast");
    expect(q).toContain("severity=CRITICAL");
    expect(q).toContain("status=OPEN");
    expect(q).toContain("evidenceSource=AUTOMATED_AXE");
  });

  it("omits page when 1", () => {
    expect(findingsListQueryString({ severity: "MINOR" }, 1)).toBe(
      "?severity=MINOR",
    );
  });
});

describe("findingsActiveFilterSummary", () => {
  it("lists active dimensions", () => {
    const { parts, hasFilters } = findingsActiveFilterSummary({
      severity: "SERIOUS",
      siteId: "x",
    });
    expect(hasFilters).toBe(true);
    expect(parts.some((p) => p.includes("serious"))).toBe(true);
    expect(parts.some((p) => p.includes("Site"))).toBe(true);
  });
});
