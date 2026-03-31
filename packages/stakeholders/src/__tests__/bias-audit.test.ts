// ─── Bias Audit Engine Tests ───────────────────────────────────────────
import { describe, expect, it, beforeEach } from "vitest";
import { BiasAuditEngine } from "../services/bias-audit";

describe("BiasAuditEngine", () => {
  let engine: BiasAuditEngine;

  beforeEach(async () => {
    engine = new BiasAuditEngine();
    await engine.clear();
  });

  const baseContext = {
    organizationId: "org-1",
    auditedBy: "user-1",
    stakeholderCount: 10,
    segmentCounts: {
      EXECUTIVE_SPONSOR: 2,
      PROJECT_TEAM: 3,
      END_USER: 3,
      ACCESSIBILITY_ADVOCATE: 2,
    },
    groupCounts: {
      VISUAL_IMPAIRMENT: 2,
      COGNITIVE_LEARNING: 1,
      MENTAL_HEALTH: 1,
      CHRONIC_PAIN_FATIGUE: 1,
      INTERSECTIONAL: 1,
      LOW_INCOME_TECH_LIMITED: 1,
      AGING_POPULATION: 1,
    },
    regionCounts: { "US-East": 5, "US-West": 3, EU: 2 },
    languageCounts: { en: 8, es: 2 },
    accessibilityNeedCounts: { SCREEN_READER: 3, CAPTIONING: 2 },
    engagementStatusCounts: {
      ACTIVE: ["s1", "s2", "s3", "s4"],
      CHAMPION: ["s5"],
      NOT_CONTACTED: ["s6", "s7"],
      LOST: ["s8"],
      RESISTANT: ["s9", "s10"],
    },
    powerDistribution: { HIGH: 3, MEDIUM: 4, LOW: 3 },
    interestDistribution: { HIGH: 5, MEDIUM: 3, LOW: 2 },
  };

  describe("audit execution", () => {
    it("runs all bias check rules", async () => {
      const result = await engine.runAudit(baseContext);

      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
      expect(result.auditedAt).toBeInstanceOf(Date);
    });

    it("detects invisible disability representation balance", async () => {
      const result = await engine.runAudit(baseContext);
      const visibleEntry = result.entries.find(
        (e) => e.dimension === "ACCESSIBILITY_VISIBLE",
      );
      expect(visibleEntry).toBeDefined();
      // With 3 invisible and 2 visible, it should pass
      expect(visibleEntry?.mitigationStatus).toBe("MITIGATED");
    });

    it("detects intersectional representation", async () => {
      const result = await engine.runAudit(baseContext);
      const entry = result.entries.find(
        (e) => e.dimension === "INTERSECTIONAL_BIAS",
      );
      expect(entry).toBeDefined();
      expect(entry?.mitigationStatus).toBe("MITIGATED");
    });

    it("detects language diversity", async () => {
      const result = await engine.runAudit(baseContext);
      const entry = result.entries.find((e) => e.dimension === "LANGUAGE_BIAS");
      expect(entry).toBeDefined();
      expect(entry?.mitigationStatus).toBe("MITIGATED");
    });

    it("flags missing underrepresented groups", async () => {
      const emptyContext = {
        ...baseContext,
        groupCounts: {},
        regionCounts: {},
        languageCounts: { en: 10 },
      };

      const result = await engine.runAudit(emptyContext);
      expect(result.overallScore).toBeLessThan(50);
      expect(result.criticalFindings).toBeGreaterThan(0);
    });

    it("calculates overall score correctly", async () => {
      const result = await engine.runAudit(baseContext);
      // Good data should score reasonably well
      expect(result.overallScore).toBeGreaterThan(50);
    });
  });

  describe("red team review", () => {
    it("generates challenger questions", async () => {
      const review = await engine.conductRedTeamReview({
        analysisId: "analysis-1",
        reviewers: ["reviewer-1", "reviewer-2"],
        analysisDescription: "Test analysis",
      });

      expect(review.challengerQuestions.length).toBeGreaterThan(0);
      expect(review.alternativeHypotheses.length).toBeGreaterThan(0);
      expect(review.recommendations.length).toBeGreaterThan(0);
      expect(review.outcome).toBe("CONDITIONAL");
    });
  });

  describe("entries by dimension", () => {
    it("filters entries by dimension", async () => {
      await engine.runAudit(baseContext);
      const entries = await engine.getEntriesByDimension(
        "ACCESSIBILITY_VISIBLE",
      );
      expect(entries.length).toBe(1);
      expect(entries[0].dimension).toBe("ACCESSIBILITY_VISIBLE");
    });
  });
});
