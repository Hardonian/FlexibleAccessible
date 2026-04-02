import { describe, it, expect } from "vitest";
import { slugify, truncate, pluralize } from "../strings.js";

describe("slugify", () => {
  it("converts to lowercase", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("replaces special characters with hyphens", () => {
    expect(slugify("Acme Corp!")).toBe("acme-corp");
  });

  it("trims leading/trailing hyphens", () => {
    expect(slugify("--test--")).toBe("test");
  });

  it("truncates to 63 characters", () => {
    const long = "a".repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(63);
  });
});

describe("truncate", () => {
  it("does not truncate short strings", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("truncates long strings with ellipsis", () => {
    expect(truncate("hello world foo", 10)).toBe("hello w...");
  });
});

describe("pluralize", () => {
  it("returns singular for count 1", () => {
    expect(pluralize(1, "page")).toBe("page");
  });

  it("returns plural for other counts", () => {
    expect(pluralize(5, "page")).toBe("pages");
  });

  it("uses custom plural", () => {
    expect(pluralize(5, "child", "children")).toBe("children");
  });
});
