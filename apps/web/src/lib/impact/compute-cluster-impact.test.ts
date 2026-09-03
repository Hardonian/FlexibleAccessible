import { describe, it, expect } from "vitest";
import { computeClusterImpacts, getParetoAnalysis } from "./compute-cluster-impact";

describe("Cluster Impact Computation", () => {
  it("should export computeClusterImpacts function", () => {
    expect(computeClusterImpacts).toBeDefined();
    expect(typeof computeClusterImpacts).toBe("function");
  });

  it("should export getParetoAnalysis function", () => {
    expect(getParetoAnalysis).toBeDefined();
    expect(typeof getParetoAnalysis).toBe("function");
  });
});
