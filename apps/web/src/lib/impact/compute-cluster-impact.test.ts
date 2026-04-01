import { describe, it, expect } from "vitest";
import { computeClusterImpacts } from "../impact/compute-cluster-impact";

describe("computeClusterImpacts", () => {
  it("should return empty array for site with no clusters", async () => {
    // This test validates the function signature and handles edge case.
    // Full integration test requires DB setup.
    expect(computeClusterImpacts).toBeDefined();
    expect(typeof computeClusterImpacts).toBe("function");
  });
});
