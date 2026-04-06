import { describe, expect, it, vi, beforeEach } from "vitest";
import { abuseRateLimit } from "../abuse-rate-limit.js";

const execMock = vi.fn();

function mockMulti() {
  const chain = {
    zremrangebyscore: () => chain,
    zadd: () => chain,
    zcard: () => chain,
    pexpire: () => chain,
    exec: execMock,
  };
  return chain;
}

vi.mock("../redis-connection.js", () => ({
  getRedisClient: () => ({
    multi: () => mockMulti(),
  }),
}));

describe("abuseRateLimit", () => {
  beforeEach(() => {
    execMock.mockReset();
  });

  it("allows when Redis count within limit", async () => {
    execMock.mockResolvedValue([
      [null, 0],
      [null, 0],
      [null, 3],
      [null, 1],
    ]);
    const r = await abuseRateLimit("t:1", 10, 60_000);
    expect(r.allowed).toBe(true);
    expect(r.degraded).toBe(false);
    expect(r.mode).toBe("redis");
  });

  it("blocks when Redis count exceeds limit", async () => {
    execMock.mockResolvedValue([
      [null, 0],
      [null, 0],
      [null, 11],
      [null, 1],
    ]);
    const r = await abuseRateLimit("t:2", 10, 60_000);
    expect(r.allowed).toBe(false);
    expect(r.degraded).toBe(false);
  });

  it("uses memory fallback when Redis throws", async () => {
    execMock.mockRejectedValue(new Error("boom"));
    const a = await abuseRateLimit("t:mem", 2, 60_000);
    const b = await abuseRateLimit("t:mem", 2, 60_000);
    const c = await abuseRateLimit("t:mem", 2, 60_000);
    expect(a.allowed).toBe(true);
    expect(a.degraded).toBe(true);
    expect(b.allowed).toBe(true);
    expect(c.allowed).toBe(false);
    expect(c.mode).toBe("redis_unavailable_strict");
  });
});
