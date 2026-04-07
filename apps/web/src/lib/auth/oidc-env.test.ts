import { describe, expect, it } from "vitest";
import { emailAllowedForOidcDomain } from "./oidc-env";

describe("emailAllowedForOidcDomain", () => {
  it("allows any email when domain unset", () => {
    expect(emailAllowedForOidcDomain("a@b.com", null)).toBe(true);
  });
  it("enforces suffix", () => {
    expect(emailAllowedForOidcDomain("user@acme.com", "acme.com")).toBe(true);
    expect(emailAllowedForOidcDomain("user@evil.com", "acme.com")).toBe(false);
  });
});
