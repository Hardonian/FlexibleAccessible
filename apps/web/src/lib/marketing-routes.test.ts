import { describe, expect, it } from "vitest";
import { MARKETING_ROUTES } from "@/lib/marketing-routes";

describe("marketing routes", () => {
  it("includes trust, security, and docs closure routes", () => {
    const hrefs = MARKETING_ROUTES.map((r) => r.href);
    expect(hrefs).toContain("/trust");
    expect(hrefs).toContain("/security");
    expect(hrefs).toContain("/docs");
    expect(hrefs).toContain("/docs/quickstart");
    expect(hrefs).toContain("/docs/how-scans-work");
    expect(hrefs).toContain("/docs/reports-and-proof");
    expect(hrefs).toContain("/docs/remediation-workflow");
    expect(hrefs).toContain("/docs/reviews-and-manual-verification");
    expect(hrefs).toContain("/docs/team-admin");
    expect(hrefs).toContain("/docs/api-mcp");
  });

  it("does not define duplicate route hrefs", () => {
    const hrefs = MARKETING_ROUTES.map((r) => r.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
