// ─── Validation Framework Tests ────────────────────────────────────────
import { describe, expect, it, beforeEach } from "vitest";
import { ValidationFramework } from "../services/validation-framework";

describe("ValidationFramework", () => {
  let framework: ValidationFramework;

  beforeEach(async () => {
    framework = new ValidationFramework();
    await framework.clear();
  });

  describe("validation records", () => {
    it("creates a validation record", async () => {
      const record = await framework.createRecord({
        method: "STAKEHOLDER_WORKSHOP",
        target: "Stakeholder needs assessment",
        outcome: "PASSED",
        findings: ["Needs accurately captured"],
        recommendations: ["Continue current approach"],
        owner: "PM",
        validatedAt: new Date(),
      });

      expect(record.id).toBeDefined();
      expect(record.method).toBe("STAKEHOLDER_WORKSHOP");
      expect(record.outcome).toBe("PASSED");
    });

    it("filters by target", async () => {
      await framework.createRecord({
        method: "SURVEY_FEEDBACK",
        target: "User satisfaction",
        outcome: "PASSED",
        owner: "UX",
        validatedAt: new Date(),
      });
      await framework.createRecord({
        method: "USABILITY_TESTING",
        target: "Accessibility compliance",
        outcome: "CONDITIONAL",
        owner: "A11y",
        validatedAt: new Date(),
      });

      const records = await framework.listByTarget("User satisfaction");
      expect(records).toHaveLength(1);
    });

    it("filters by method", async () => {
      await framework.createRecord({
        method: "AT_COMPATIBILITY_TEST",
        target: "Screen reader",
        outcome: "PASSED",
        owner: "A11y",
        validatedAt: new Date(),
      });

      const records = await framework.listByMethod("AT_COMPATIBILITY_TEST");
      expect(records).toHaveLength(1);
    });
  });

  describe("triangulation", () => {
    it("adds data sources", async () => {
      const source = await framework.addSource({
        name: "User survey",
        type: "PRIMARY",
        reliability: "HIGH",
      });

      expect(source.id).toBeDefined();
      expect(source.name).toBe("User survey");
    });

    it("performs triangulation analysis", async () => {
      const src1 = await framework.addSource({
        name: "Survey",
        type: "PRIMARY",
        reliability: "HIGH",
      });
      const src2 = await framework.addSource({
        name: "Analytics",
        type: "SECONDARY",
        reliability: "MEDIUM",
      });
      const src3 = await framework.addSource({
        name: "Benchmark",
        type: "EXTERNAL",
        reliability: "HIGH",
      });

      const result = await framework.triangulate(
        "User needs validation",
        [src1.id, src2.id, src3.id],
        [
          "Users need screen reader support for all pages",
          "Screen reader compatibility is critical for accessibility",
          "Industry benchmark shows 95% screen reader support",
        ],
      );

      expect(result.target).toBe("User needs validation");
      expect(result.sources.length).toBe(3);
      expect(result.confidenceLevel).toBe("HIGH");
      expect(result.conclusion).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it("identifies gaps in sources", async () => {
      const src1 = await framework.addSource({
        name: "Survey",
        type: "PRIMARY",
        reliability: "HIGH",
      });

      const result = await framework.triangulate(
        "Test",
        [src1.id],
        ["Finding 1"],
      );

      expect(result.gaps.length).toBeGreaterThan(0);
      expect(result.gaps.some((g) => g.includes("SECONDARY"))).toBe(true);
      expect(result.gaps.some((g) => g.includes("EXTERNAL"))).toBe(true);
    });

    it("computes confidence level based on sources", async () => {
      const src1 = await framework.addSource({
        name: "S1",
        type: "PRIMARY",
        reliability: "LOW",
      });

      const result = await framework.triangulate(
        "Test",
        [src1.id],
        ["Finding"],
      );

      expect(result.confidenceLevel).toBe("LOW");
    });
  });

  describe("validation schedule", () => {
    it("identifies due validations", async () => {
      const pastDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      await framework.createRecord({
        method: "SURVEY_FEEDBACK",
        target: "Test",
        outcome: "PASSED",
        owner: "PM",
        validatedAt: new Date(),
        nextValidation: pastDate,
      });

      const due = await framework.getDueValidations();
      expect(due.length).toBe(1);
    });

    it("identifies upcoming validations", async () => {
      const futureDate = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      await framework.createRecord({
        method: "SURVEY_FEEDBACK",
        target: "Test",
        outcome: "PASSED",
        owner: "PM",
        validatedAt: new Date(),
        nextValidation: futureDate,
      });

      const upcoming = await framework.getUpcomingValidations(30);
      expect(upcoming.length).toBe(1);
    });
  });

  describe("summary", () => {
    it("computes validation summary", async () => {
      await framework.createRecord({
        method: "STAKEHOLDER_WORKSHOP",
        target: "A",
        outcome: "PASSED",
        owner: "PM",
        validatedAt: new Date(),
        findings: ["F1", "F2"],
      });
      await framework.createRecord({
        method: "SURVEY_FEEDBACK",
        target: "B",
        outcome: "FAILED",
        owner: "UX",
        validatedAt: new Date(),
        findings: ["F3"],
      });

      const summary = await framework.getValidationSummary();
      expect(summary.totalValidations).toBe(2);
      expect(summary.passRate).toBe(50);
      expect(summary.averageFindingsPerValidation).toBe(1.5);
    });
  });
});
