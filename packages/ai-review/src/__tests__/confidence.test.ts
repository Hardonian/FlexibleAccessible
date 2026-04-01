import { describe, it, expect } from "vitest";
import {
  classifyConfidence,
  scoreFindings,
  requiresHumanReview,
  aggregateStats,
} from "../confidence.js";
import type { CriterionStatus, ScoredFinding } from "../types.js";
import {
  CONFIDENCE_AUTO_CREATE,
  CONFIDENCE_REVIEW_REQUIRED,
  CONFIDENCE_MINIMUM,
} from "../types.js";

describe("confidence", () => {
  describe("classifyConfidence", () => {
    it("should auto_create for high confidence", () => {
      expect(classifyConfidence(0.95)).toBe("auto_create");
      expect(classifyConfidence(CONFIDENCE_AUTO_CREATE)).toBe("auto_create");
    });

    it("should review_required for medium confidence", () => {
      expect(classifyConfidence(0.75)).toBe("review_required");
      expect(classifyConfidence(CONFIDENCE_REVIEW_REQUIRED)).toBe(
        "review_required",
      );
    });

    it("should evidence_only for low confidence", () => {
      expect(classifyConfidence(0.55)).toBe("evidence_only");
      expect(classifyConfidence(CONFIDENCE_MINIMUM)).toBe("evidence_only");
    });

    it("should discard for very low confidence", () => {
      expect(classifyConfidence(0.3)).toBe("discard");
      expect(classifyConfidence(0.0)).toBe("discard");
    });
  });

  describe("scoreFindings", () => {
    it("should skip pass and not_applicable criteria", () => {
      const criteria: CriterionStatus[] = [
        {
          criterion_id: "1.4.3",
          criterion_name: "Contrast",
          level: "AA",
          status: "pass",
          confidence: 0.9,
          issues: [],
        },
        {
          criterion_id: "1.4.11",
          criterion_name: "Non-text Contrast",
          level: "AA",
          status: "not_applicable",
          confidence: 0.9,
          issues: [],
        },
      ];

      const findings = scoreFindings(criteria);
      expect(findings).toHaveLength(0);
    });

    it("should score and classify findings", () => {
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
              selector: "p",
              element_description: "Text",
              suggested_fix: "Darken",
              evidence: "Light",
            },
          ],
        },
      ];

      const findings = scoreFindings(criteria);
      expect(findings).toHaveLength(1);
      expect(findings[0].action).toBe("auto_create");
      expect(findings[0].source).toBe("vision");
    });

    it("should discard very low confidence findings", () => {
      const criteria: CriterionStatus[] = [
        {
          criterion_id: "1.4.3",
          criterion_name: "Contrast",
          level: "AA",
          status: "uncertain",
          confidence: 0.3,
          issues: [
            {
              description: "Maybe low contrast",
              severity: "moderate",
              selector: "p",
              element_description: "Text",
              suggested_fix: "Check",
              evidence: "Unclear",
            },
          ],
        },
      ];

      const findings = scoreFindings(criteria);
      expect(findings).toHaveLength(0);
    });

    it("should sort by confidence descending", () => {
      const criteria: CriterionStatus[] = [
        {
          criterion_id: "1.4.3",
          criterion_name: "Contrast",
          level: "AA",
          status: "fail",
          confidence: 0.7,
          issues: [
            {
              description: "Issue 1",
              severity: "moderate",
              selector: "a",
              element_description: "",
              suggested_fix: "",
              evidence: "",
            },
          ],
        },
        {
          criterion_id: "2.4.7",
          criterion_name: "Focus",
          level: "AA",
          status: "fail",
          confidence: 0.95,
          issues: [
            {
              description: "Issue 2",
              severity: "serious",
              selector: "button",
              element_description: "",
              suggested_fix: "",
              evidence: "",
            },
          ],
        },
      ];

      const findings = scoreFindings(criteria);
      expect(findings).toHaveLength(2);
      expect(findings[0].confidence).toBeGreaterThan(findings[1].confidence);
    });
  });

  describe("requiresHumanReview", () => {
    it("should not require review when all criteria pass", () => {
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

      const { required, reasons } = requiresHumanReview(criteria);
      expect(required).toBe(false);
      expect(reasons).toHaveLength(0);
    });

    it("should require review for uncertain criteria", () => {
      const criteria: CriterionStatus[] = [
        {
          criterion_id: "2.4.7",
          criterion_name: "Focus",
          level: "AA",
          status: "uncertain",
          confidence: 0.8,
          issues: [],
        },
      ];

      const { required, reasons } = requiresHumanReview(criteria);
      expect(required).toBe(true);
      expect(reasons.length).toBeGreaterThan(0);
      expect(reasons[0]).toContain("2.4.7");
    });

    it("should require review for low confidence", () => {
      const criteria: CriterionStatus[] = [
        {
          criterion_id: "1.4.3",
          criterion_name: "Contrast",
          level: "AA",
          status: "fail",
          confidence: 0.6,
          issues: [
            {
              description: "Maybe",
              severity: "moderate",
              selector: "p",
              element_description: "",
              suggested_fix: "",
              evidence: "",
            },
          ],
        },
      ];

      const { required, reasons } = requiresHumanReview(criteria);
      expect(required).toBe(true);
    });
  });

  describe("aggregateStats", () => {
    it("should compute correct statistics", () => {
      const findings: ScoredFinding[] = [
        {
          criterionId: "1.4.3",
          criterionName: "Contrast",
          level: "AA",
          status: "fail",
          confidence: 0.9,
          severity: "serious",
          description: "Low contrast",
          selector: "p",
          suggestedFix: "Darken",
          source: "vision",
          action: "auto_create",
        },
        {
          criterionId: "2.4.7",
          criterionName: "Focus",
          level: "AA",
          status: "fail",
          confidence: 0.75,
          severity: "moderate",
          description: "No focus",
          selector: "button",
          suggestedFix: "Add outline",
          source: "keyboard",
          action: "review_required",
        },
      ];

      const stats = aggregateStats(findings);
      expect(stats.total).toBe(2);
      expect(stats.autoCreate).toBe(1);
      expect(stats.reviewRequired).toBe(1);
      expect(stats.evidenceOnly).toBe(0);
      expect(stats.bySeverity.serious).toBe(1);
      expect(stats.bySeverity.moderate).toBe(1);
      expect(stats.bySource.vision).toBe(1);
      expect(stats.bySource.keyboard).toBe(1);
    });
  });
});
