import { describe, it, expect } from "vitest";
import { generateVpatReport } from "../generator";

describe("VPAT Generator", () => {
  it("should be defined and exportable", () => {
    expect(generateVpatReport).toBeDefined();
    expect(typeof generateVpatReport).toBe("function");
  });

  it("should throw for non-existent site", async () => {
    await expect(generateVpatReport("non-existent-id")).rejects.toThrow(
      "Site not found",
    );
  });
});
