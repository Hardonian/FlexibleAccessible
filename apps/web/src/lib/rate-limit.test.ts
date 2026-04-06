import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@aros/shared", () => ({
  getRedisClient: vi.fn(),
}));

import { getRedisClient } from "@aros/shared";
import { rateLimitSafe } from "./rate-limit";

describe("rateLimitSafe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows traffic when Redis throws (degraded)", async () => {
    vi.mocked(getRedisClient).mockImplementation(() => {
      throw new Error("redis down");
    });

    const result = await rateLimitSafe("test-key", 5, 60_000);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(5);
  });
});
