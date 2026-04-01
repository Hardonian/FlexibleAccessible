import { describe, it, expect } from "vitest";
import {
  buildVisionPrompt,
  buildRetryPrompt,
  computeOverallScore,
  VISUAL_WCAG_CRITERIA,
} from "../prompts.js";
import type { CriterionStatus } from "../types.js";

describe("prompts", () => {
  describe("buildVisionPrompt", () => {
    it("should include page context", () => {
      const prompt = buildVisionPrompt({
        url: "https://example.com",
        pageTitle: "Test Page",
        axeViolations: [],
        accessibilityTreeSummary: "button: Submit",
      });

      expect(prompt).toContain("https://example.com");
      expect(prompt).toContain("Test Page");
      expect(prompt).toContain("No automated violations detected");
    });

    it("should list axe violations", () => {
      const prompt = buildVisionPrompt({
        url: "https://example.com",
        pageTitle: "Test",
        axeViolations: [
          {
            ruleId: "image-alt",
            impact: "critical",
            selector: "img.hero",
            description: "Image missing alt text",
          },
        ],
        accessibilityTreeSummary: "",
      });

      expect(prompt).toContain("CRITICAL");
      expect(prompt).toContain("image-alt");
      expect(prompt).toContain("img.hero");
    });

    it("should include all WCAG criteria", () => {
      const prompt = buildVisionPrompt({
        url: "https://example.com",
        pageTitle: "Test",
        axeViolations: [],
        accessibilityTreeSummary: "",
      });

      for (const criteria of VISUAL_WCAG_CRITERIA) {
        expect(prompt).toContain(criteria.id);
        expect(prompt).toContain(criteria.name);
      }
    });
  });

  describe("buildRetryPrompt", () => {
    it("should produce a simplified prompt", () => {
      const prompt = buildRetryPrompt({
        url: "https://example.com",
        pageTitle: "Test",
      });

      expect(prompt).toContain("https://example.com");
      expect(prompt).toContain("TOP 3");
      expect(prompt).toContain("requires_human_review");
    });
  });

  describe("computeOverallScore", () => {
    it("should return 100 for all-pass criteria", () => {
      const criteria: CriterionStatus[] = [
        {
          criterion_id: "1.4.3",
          criterion_name: "Contrast",
          level: "AA",
          status: "pass",
          confidence: 0.9,
          issues: [],
        },
      ];

      expect(computeOverallScore(criteria)).toBe(100);
    });

    it("should deduct for failures", () => {
      const criteria: CriterionStatus[] = [
        {
          criterion_id: "1.4.3",
          criterion_name: "Contrast",
          level: "AA",
          status: "fail",
          confidence: 0.9,
          issues: [
            {
              description: "Low contrast",
              severity: "serious",
              selector: "p.text",
              element_description: "Paragraph",
              suggested_fix: "Darken text",
              evidence: "Light text visible",
            },
          ],
        },
      ];

      const score = computeOverallScore(criteria);
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("should handle multiple failures", () => {
      const criteria: CriterionStatus[] = [
        {
          criterion_id: "1.4.3",
          criterion_name: "Contrast",
          level: "AA",
          status: "fail",
          confidence: 0.9,
          issues: [
            {
              description: "Low contrast",
              severity: "critical",
              selector: "p",
              element_description: "Text",
              suggested_fix: "Fix",
              evidence: "Visible",
            },
          ],
        },
        {
          criterion_id: "2.4.7",
          criterion_name: "Focus Visible",
          level: "AA",
          status: "fail",
          confidence: 0.8,
          issues: [
            {
              description: "No focus indicator",
              severity: "serious",
              selector: "button",
              element_description: "Button",
              suggested_fix: "Add outline",
              evidence: "Screenshot",
            },
          ],
        },
      ];

      const score = computeOverallScore(criteria);
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  describe("VISUAL_WCAG_CRITERIA", () => {
    it("should contain at least 10 criteria", () => {
      expect(VISUAL_WCAG_CRITERIA.length).toBeGreaterThanOrEqual(10);
    });

    it("should have unique IDs", () => {
      const ids = VISUAL_WCAG_CRITERIA.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("should include both A and AA levels", () => {
      const levels = new Set(VISUAL_WCAG_CRITERIA.map((c) => c.level));
      expect(levels.has("A")).toBe(true);
      expect(levels.has("AA")).toBe(true);
    });
  });
});
