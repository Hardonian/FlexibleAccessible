import { describe, it, expect } from "vitest";

describe("Cluster Impact Computation", () => {
  it("should export computeClusterImpacts function", async () => {
    const { computeClusterImpacts } = await import("./compute-cluster-impact");
    expect(computeClusterImpacts).toBeDefined();
    expect(typeof computeClusterImpacts).toBe("function");
  });

  it("should export getParetoAnalysis function", async () => {
    const { getParetoAnalysis } = await import("./compute-cluster-impact");
    expect(getParetoAnalysis).toBeDefined();
    expect(typeof getParetoAnalysis).toBe("function");
  });
});
