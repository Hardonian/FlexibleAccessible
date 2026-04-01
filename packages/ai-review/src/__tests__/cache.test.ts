import { describe, it, expect, vi } from "vitest";

vi.mock("@aros/shared", () => ({
  getRedisClient: vi.fn().mockReturnValue({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
  }),
}));

import { generateCacheKey } from "../cache.js";

describe("cache", () => {
  describe("generateCacheKey", () => {
    it("should generate consistent keys for same input", () => {
      const key1 = generateCacheKey("<html>test</html>", 1280);
      const key2 = generateCacheKey("<html>test</html>", 1280);
      expect(key1).toBe(key2);
    });

    it("should generate different keys for different DOM", () => {
      const key1 = generateCacheKey("<html>version1</html>", 1280);
      const key2 = generateCacheKey("<html>version2</html>", 1280);
      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different viewports", () => {
      const key1 = generateCacheKey("<html>test</html>", 1280);
      const key2 = generateCacheKey("<html>test</html>", 768);
      expect(key1).not.toBe(key2);
    });

    it("should prefix with ai-review:", () => {
      const key = generateCacheKey("<html>test</html>", 1280);
      expect(key.startsWith("ai-review:")).toBe(true);
    });

    it("should handle empty DOM", () => {
      const key = generateCacheKey("", 1280);
      expect(key.startsWith("ai-review:")).toBe(true);
      expect(key.length).toBeGreaterThan(10);
    });
  });
});
