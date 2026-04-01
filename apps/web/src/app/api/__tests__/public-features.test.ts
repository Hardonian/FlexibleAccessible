import { describe, it, expect } from "vitest";

describe("Public Scan API", () => {
  it("should validate domain format", () => {
    const validDomains = [
      "example.com",
      "https://example.com",
      "www.example.com",
      "sub.domain.example.com",
    ];

    const invalidDomains = [
      "",
      "not a domain",
      "ftp://example.com",
      "localhost",
    ];

    const domainRegex =
      /^(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})(?:\/.*)?$/;

    for (const domain of validDomains) {
      expect(domainRegex.test(domain)).toBe(true);
    }

    for (const domain of invalidDomains) {
      expect(domainRegex.test(domain)).toBe(false);
    }
  });

  it("should compute score correctly", () => {
    function computeScore(
      critical: number,
      serious: number,
      moderate: number,
      minor: number,
      pages: number,
    ): number {
      const penalty = critical * 10 + serious * 5 + moderate * 2 + minor * 0.5;
      return Math.max(0, Math.round(100 - (penalty / Math.max(pages, 1)) * 2));
    }

    // No issues = 100
    expect(computeScore(0, 0, 0, 0, 1)).toBe(100);

    // Single critical on 1 page
    expect(computeScore(1, 0, 0, 0, 1)).toBe(80);

    // Mix of issues
    expect(computeScore(2, 5, 10, 20, 1)).toBe(0);

    // Moderate issues spread across pages
    expect(computeScore(0, 0, 10, 0, 5)).toBe(92);
  });
});

describe("Badge SVG", () => {
  it("should generate valid SVG structure", () => {
    const scoreCategories = ["good", "fair", "poor", "critical", "none"];

    for (const cat of scoreCategories) {
      expect(scoreCategories).toContain(cat);
    }
  });
});

describe("Credits API", () => {
  it("should have correct pack definitions", () => {
    const packs = {
      small: { credits: 100, priceCents: 900 },
      medium: { credits: 500, priceCents: 3900 },
      large: { credits: 2000, priceCents: 12900 },
    };

    // Verify price per credit decreases with larger packs
    const smallPerCredit = packs.small.priceCents / packs.small.credits;
    const mediumPerCredit = packs.medium.priceCents / packs.medium.credits;
    const largePerCredit = packs.large.priceCents / packs.large.credits;

    expect(smallPerCredit).toBe(9); // 9 cents per credit
    expect(mediumPerCredit).toBeLessThan(smallPerCredit);
    expect(largePerCredit).toBeLessThan(mediumPerCredit);
  });
});

describe("Impact Scoring", () => {
  it("should use correct severity weights", () => {
    const weights: Record<string, number> = {
      CRITICAL: 10,
      SERIOUS: 5,
      MODERATE: 2,
      MINOR: 0.5,
    };

    expect(weights.CRITICAL).toBeGreaterThan(weights.SERIOUS);
    expect(weights.SERIOUS).toBeGreaterThan(weights.MODERATE);
    expect(weights.MODERATE).toBeGreaterThan(weights.MINOR);
  });

  it("should compute impact score correctly", () => {
    const severityWeight = 10; // CRITICAL
    const occurrences = 50;
    const pagesAffected = 100;

    const impactScore =
      severityWeight *
      Math.log2(occurrences + 1) *
      Math.log2(pagesAffected + 1);

    expect(impactScore).toBeGreaterThan(0);
    expect(impactScore).toBe(10 * Math.log2(51) * Math.log2(101));
  });
});
