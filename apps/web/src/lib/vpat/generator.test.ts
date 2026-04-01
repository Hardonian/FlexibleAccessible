import { describe, it, expect } from "vitest";

describe("VPAT Generator", () => {
  it("should be defined and exportable", async () => {
    const { generateVpatReport } = await import("../generator");
    expect(generateVpatReport).toBeDefined();
    expect(typeof generateVpatReport).toBe("function");
  });
});
