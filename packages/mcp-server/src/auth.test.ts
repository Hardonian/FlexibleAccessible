import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkRateLimit, ApiKeyRecord } from "./auth.js";

vi.mock("@aros/db", () => ({
  prisma: {
    apiKey: { findUnique: vi.fn() },
  },
}));

const mockRedis = {
  pipeline: vi.fn().mockReturnThis(),
  zremrangebyscore: vi.fn().mockReturnThis(),
  zadd: vi.fn().mockReturnThis(),
  pexpire: vi.fn().mockReturnThis(),
  zcard: vi.fn().mockReturnThis(),
  exec: vi.fn(),
};

vi.mock("@aros/shared", () => ({
  getRedisClient: vi.fn(() => mockRedis),
  authLogger: {
    warn: vi.fn(),
  },
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

  it("allows request when under rate limit", async () => {
    mockRedis.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 1],
      [null, 1],
    ]);

    const result = await checkRateLimit(baseApiKey);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.resetAt).toBeGreaterThan(Date.now());
    expect(mockRedis.pipeline).toHaveBeenCalled();
    expect(mockRedis.zremrangebyscore).toHaveBeenCalled();
    expect(mockRedis.zadd).toHaveBeenCalled();
    expect(mockRedis.pexpire).toHaveBeenCalled();
  });

  it("denies request when rate limit exceeded", async () => {
    mockRedis.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 1],
      [null, 11], // 11 requests in window, limit is 10
    ]);

    const result = await checkRateLimit(baseApiKey);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it("handles exact limit boundary", async () => {
    mockRedis.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 1],
      [null, 10], // Exactly at limit
    ]);

    const result = await checkRateLimit(baseApiKey);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("fails open when Redis is unavailable", async () => {
    mockRedis.exec.mockRejectedValue(new Error("Connection refused"));

    const result = await checkRateLimit(baseApiKey);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(baseApiKey.rateLimitPerMinute);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it("fails open when Redis returns null", async () => {
    mockRedis.exec.mockResolvedValue(null);

    const result = await checkRateLimit(baseApiKey);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(baseApiKey.rateLimitPerMinute);
  });

  it("uses correct Redis key naming", async () => {
    mockRedis.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 1],
      [null, 1],
    ]);

    await checkRateLimit(baseApiKey);

    expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
      `rate_limit:${baseApiKey.id}`,
      expect.any(Number),
      expect.any(Number),
    );
    expect(mockRedis.zadd).toHaveBeenCalledWith(
      `rate_limit:${baseApiKey.id}`,
      expect.any(Number),
      expect.stringMatching(/^\d+:\d+\.\d+$/),
    );
  });

  it("sets key expiry to window duration", async () => {
    mockRedis.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 1],
      [null, 1],
    ]);

    await checkRateLimit(baseApiKey);

    expect(mockRedis.pexpire).toHaveBeenCalledWith(
      `rate_limit:${baseApiKey.id}`,
      60000,
    );
  });

  it("handles different rate limits", async () => {
    const lowLimitKey = { ...baseApiKey, rateLimitPerMinute: 2 };

    mockRedis.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 1],
      [null, 1],
    ]);

    const result = await checkRateLimit(lowLimitKey);

    expect(result.remaining).toBe(1);
  });

  it("calculates window boundary correctly", async () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);

    mockRedis.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 1],
      [null, 5],
    ]);

    await checkRateLimit(baseApiKey);

    // Should remove entries older than now - 60000
    const expectedWindowStart = now - 60000;
    expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
      expect.any(String),
      0,
      expectedWindowStart,
    );

    vi.restoreAllMocks();
  });

  it("returns correct resetAt timestamp", async () => {
    const beforeCall = Date.now();

    mockRedis.exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 1],
      [null, 1],
    ]);

    const result = await checkRateLimit(baseApiKey);

    const afterCall = Date.now();
    const expectedResetAt = beforeCall + 60000;

    expect(result.resetAt).toBeGreaterThanOrEqual(expectedResetAt);
    expect(result.resetAt).toBeLessThanOrEqual(afterCall + 60000);
  });
});
