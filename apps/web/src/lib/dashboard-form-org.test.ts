import { describe, expect, it } from "vitest";
import {
  assertFormOrgMatchesActive,
  parseExpectedOrgFromForm,
} from "./dashboard-form-org";

describe("dashboard-form-org", () => {
  it("parses expected org from FormData", () => {
    const fd = new FormData();
    fd.set("expectedOrganizationId", " org-1 ");
    expect(parseExpectedOrgFromForm(fd)).toBe("org-1");
  });

  it("returns null when field absent", () => {
    expect(parseExpectedOrgFromForm(new FormData())).toBeNull();
  });

  it("allows submit when no expected org (backwards compatible)", () => {
    expect(assertFormOrgMatchesActive(null, "org-a")).toBe(true);
  });

  it("rejects mismatch", () => {
    expect(assertFormOrgMatchesActive("org-a", "org-b")).toBe(false);
  });

  it("accepts exact match", () => {
    expect(assertFormOrgMatchesActive("org-a", "org-a")).toBe(true);
  });
});
