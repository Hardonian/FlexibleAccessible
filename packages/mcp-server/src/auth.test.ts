import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkRateLimit, type ApiKeyRecord } from "./auth.js";

const abuseRateLimitMock = vi.fn();

vi.mock("@aros/db", () => ({
  prisma: {
    apiKey: { findUnique: vi.fn() },
  },
}));

vi.mock("@aros/shared", () => ({
  abuseRateLimit: (...args: unknown[]) => abuseRateLimitMock(...args),
}));

describe("checkRateLimit", () => {
  const baseApiKey: ApiKeyRecord = {
    id: "key_123",
    organizationId: "org_456",
    keyHash: "hash",
    name: "Test Key",
    scopes: ["read"],
    rateLimitPerMinute: 10,
    isActive: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps abuseRateLimit outcome", async () => {
    abuseRateLimitMock.mockResolvedValue({
      allowed: true,
      degraded: false,
      mode: "redis",
      remaining: 7,
      resetAt: 12345,
    });
    const r = await checkRateLimit(baseApiKey);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(7);
    expect(r.resetAt).toBe(12345);
    expect(r.degraded).toBe(false);
    expect(abuseRateLimitMock).toHaveBeenCalledWith(
      "mcp-api:key_123",
      10,
      60_000,
    );
  });
});
