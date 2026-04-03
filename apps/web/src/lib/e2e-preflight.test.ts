import { describe, expect, it } from "vitest";
import { formatE2EPreflightError, runE2EPreflight } from "../../e2e/preflight.mjs";

describe("E2E environment preflight", () => {
  it("fails with explicit errors when required env vars are missing", () => {
    const result = runE2EPreflight({});

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["DATABASE_URL"]);
    expect(formatE2EPreflightError(result)).toContain(
      "Missing required environment variables: DATABASE_URL.",
    );
  });

  it("fails when DATABASE_URL is not URL-like", () => {
    const result = runE2EPreflight({ DATABASE_URL: "not-a-url" });

    expect(result.ok).toBe(false);
    expect(result.errors.some((msg) => msg.includes("DATABASE_URL must be a valid URL"))).toBe(true);
  });

  it("passes when DATABASE_URL is present and valid", () => {
    const result = runE2EPreflight({
      DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/aros",
    });

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
