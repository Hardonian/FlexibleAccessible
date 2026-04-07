import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { signOidcState, verifyOidcState } from "./oidc-state";

describe("oidc state jwt", () => {
  const prev = process.env.NEXTAUTH_SECRET;

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret-at-least-16";
  });

  afterEach(() => {
    process.env.NEXTAUTH_SECRET = prev;
  });

  it("round-trips payload", async () => {
    const token = await signOidcState({
      nonce: "n1",
      returnTo: "/dashboard",
      emailHint: null,
    });
    const out = await verifyOidcState(token);
    expect(token.includes(".")).toBe(true);
    expect(out).toEqual({
      nonce: "n1",
      returnTo: "/dashboard",
      emailHint: null,
    });
  });
});
