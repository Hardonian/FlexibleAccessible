import { describe, it, expect } from "vitest";
import {
  createFingerprint,
  normalizeSelector,
  createDomFingerprint,
  selectorSimilarity,
} from "../fingerprint.js";

describe("createFingerprint", () => {
  it("produces consistent hashes for the same input", () => {
    const a = createFingerprint({
      ruleId: "image-alt",
      selector: "div > img",
      siteId: "site1",
    });
    const b = createFingerprint({
      ruleId: "image-alt",
      selector: "div > img",
      siteId: "site1",
    });
    expect(a).toBe(b);
  });

  it("produces different hashes for different rules", () => {
    const a = createFingerprint({
      ruleId: "image-alt",
      selector: "div > img",
      siteId: "site1",
    });
    const b = createFingerprint({
      ruleId: "button-name",
      selector: "div > img",
      siteId: "site1",
    });
    expect(a).not.toBe(b);
  });

  it("produces different hashes for different sites", () => {
    const a = createFingerprint({
      ruleId: "image-alt",
      selector: "div > img",
      siteId: "site1",
    });
    const b = createFingerprint({
      ruleId: "image-alt",
      selector: "div > img",
      siteId: "site2",
    });
    expect(a).not.toBe(b);
  });

  it("returns a 32-character hex string", () => {
    const fp = createFingerprint({
      ruleId: "test",
      selector: "div",
      siteId: "s1",
    });
    expect(fp).toMatch(/^[a-f0-9]{32}$/);
  });
});

describe("normalizeSelector", () => {
  it("removes dynamic IDs", () => {
    expect(normalizeSelector('div[id="abc123"] > span')).toBe("div[id] > span");
  });

  it("normalizes nth-child indices", () => {
    expect(normalizeSelector("ul > li:nth-child(3) > a")).toBe(
      "ul > li:nth-child(n) > a",
    );
  });

  it("normalizes whitespace", () => {
    expect(normalizeSelector("  div   >   span  ")).toBe("div > span");
  });

  it("lowercases selectors", () => {
    expect(normalizeSelector("DIV > SPAN")).toBe("div > span");
  });
});

describe("createDomFingerprint", () => {
  it("extracts tag structure", () => {
    const a = createDomFingerprint("<div><button><svg></svg></button></div>");
    const b = createDomFingerprint("<div><button><svg></svg></button></div>");
    expect(a).toBe(b);
  });

  it("differentiates by role attributes", () => {
    const a = createDomFingerprint('<div role="navigation"><a></a></div>');
    const b = createDomFingerprint('<div role="banner"><a></a></div>');
    expect(a).not.toBe(b);
  });

  it("differentiates by class on the same tag", () => {
    const a = createDomFingerprint('<img class="logo" src="/logo.png">');
    const b = createDomFingerprint('<img src="/photo.jpg" width="800">');
    expect(a).not.toBe(b);
  });

  it("returns a 24-character hex string", () => {
    const fp = createDomFingerprint("<div><span></span></div>");
    expect(fp).toMatch(/^[a-f0-9]{24}$/);
  });

  it("differentiates by type attributes", () => {
    const a = createDomFingerprint('<input type="text">');
    const b = createDomFingerprint('<input type="password">');
    expect(a).not.toBe(b);
  });

  it("differentiates by width attributes", () => {
    const a = createDomFingerprint('<img width="100">');
    const b = createDomFingerprint('<img width="200">');
    expect(a).not.toBe(b);
  });

  it("produces same fingerprint regardless of class order", () => {
    const a = createDomFingerprint('<div class="a b c"></div>');
    const b = createDomFingerprint('<div class="c a b"></div>');
    expect(a).toBe(b);
  });

  it("ignores non-structural attributes", () => {
    const a = createDomFingerprint(
      '<div id="abc" data-testid="123" style="color: red;"></div>',
    );
    const b = createDomFingerprint("<div></div>");
    expect(a).toBe(b);
  });

  it("handles text-only or empty snippets safely", () => {
    const a = createDomFingerprint("Just some text");
    const b = createDomFingerprint("");
    expect(a).toBe(b);
  });
});

describe("selectorSimilarity", () => {
  it("returns 1 for identical selectors", () => {
    expect(selectorSimilarity("div > span > a", "div > span > a")).toBe(1);
  });

  it("returns 0 for completely different selectors", () => {
    expect(selectorSimilarity("div", "span")).toBe(0);
  });

  it("returns partial similarity for partially matching selectors", () => {
    const sim = selectorSimilarity("div > span > a", "div > span > button");
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });
});
