// ─── Power/Interest Matrix Tests ───────────────────────────────────────
import { describe, expect, it, beforeEach } from "vitest";
import { PowerInterestMatrix } from "../services/power-interest-matrix";
import { MATRIX_POSITION } from "../types/power-interest";

describe("PowerInterestMatrix", () => {
  let matrix: PowerInterestMatrix;

  beforeEach(async () => {
    matrix = new PowerInterestMatrix();
    await matrix.clear();
  });

  describe("strategy computation", () => {
    it("maps HIGH power + HIGH interest to MANAGE_CLOSELY", () => {
      expect(PowerInterestMatrix.computeStrategy("HIGH", "HIGH")).toBe(
        "MANAGE_CLOSELY",
      );
    });

    it("maps HIGH power + LOW interest to KEEP_SATISFIED", () => {
      expect(PowerInterestMatrix.computeStrategy("HIGH", "LOW")).toBe(
        "KEEP_SATISFIED",
      );
    });

    it("maps LOW power + HIGH interest to KEEP_ENGAGED", () => {
      expect(PowerInterestMatrix.computeStrategy("LOW", "HIGH")).toBe(
        "KEEP_ENGAGED",
      );
    });

    it("maps LOW power + LOW interest to KEEP_INFORMED", () => {
      expect(PowerInterestMatrix.computeStrategy("LOW", "LOW")).toBe(
        "KEEP_INFORMED",
      );
    });

    it("has all 9 combinations mapped", () => {
      const powers = ["HIGH", "MEDIUM", "LOW"] as const;
      const interests = ["HIGH", "MEDIUM", "LOW"] as const;

      for (const power of powers) {
        for (const interest of interests) {
          expect(MATRIX_POSITION[`${power}-${interest}`]).toBeDefined();
        }
      }
    });
  });

  describe("assessment CRUD", () => {
    it("creates an assessment with computed strategy", async () => {
      const entry = await matrix.createAssessment({
        stakeholderId: "s-001",
        stakeholderName: "Jane Doe",
        segment: "EXECUTIVE_SPONSOR",
        power: "HIGH",
        interest: "HIGH",
        assessedBy: "user-1",
      });

      expect(entry.id).toBeDefined();
      expect(entry.strategy).toBe("MANAGE_CLOSELY");
      expect(entry.stakeholderName).toBe("Jane Doe");
    });

    it("retrieves assessment by ID", async () => {
      const created = await matrix.createAssessment({
        stakeholderId: "s-001",
        stakeholderName: "Test",
        segment: "PROJECT_TEAM",
        power: "HIGH",
        interest: "LOW",
        assessedBy: "user-1",
      });

      const retrieved = await matrix.getAssessment(created.id);
      expect(retrieved?.strategy).toBe("KEEP_SATISFIED");
    });

    it("retrieves assessment by stakeholder ID", async () => {
      await matrix.createAssessment({
        stakeholderId: "s-001",
        stakeholderName: "Test",
        segment: "PROJECT_TEAM",
        power: "MEDIUM",
        interest: "HIGH",
        assessedBy: "user-1",
      });

      const entry = await matrix.getAssessmentByStakeholder("s-001");
      expect(entry?.strategy).toBe("KEEP_ENGAGED");
    });

    it("updates assessment and recomputes strategy", async () => {
      const created = await matrix.createAssessment({
        stakeholderId: "s-001",
        stakeholderName: "Test",
        segment: "PROJECT_TEAM",
        power: "LOW",
        interest: "LOW",
        assessedBy: "user-1",
      });
      expect(created.strategy).toBe("KEEP_INFORMED");

      const updated = await matrix.updateAssessment(created.id, {
        power: "HIGH",
        interest: "HIGH",
      });
      expect(updated?.strategy).toBe("MANAGE_CLOSELY");
    });
  });

  describe("matrix summary", () => {
    it("groups entries by strategy", async () => {
      await matrix.createAssessment({
        stakeholderId: "s-1",
        stakeholderName: "Key",
        segment: "X",
        power: "HIGH",
        interest: "HIGH",
        assessedBy: "u",
      });
      await matrix.createAssessment({
        stakeholderId: "s-2",
        stakeholderName: "Satisfied",
        segment: "X",
        power: "HIGH",
        interest: "LOW",
        assessedBy: "u",
      });
      await matrix.createAssessment({
        stakeholderId: "s-3",
        stakeholderName: "Engaged",
        segment: "X",
        power: "LOW",
        interest: "HIGH",
        assessedBy: "u",
      });
      await matrix.createAssessment({
        stakeholderId: "s-4",
        stakeholderName: "Informed",
        segment: "X",
        power: "LOW",
        interest: "LOW",
        assessedBy: "u",
      });

      const summary = await matrix.getMatrixSummary();
      expect(summary.keyPlayers).toHaveLength(1);
      expect(summary.keepSatisfied).toHaveLength(1);
      expect(summary.keepEngaged).toHaveLength(1);
      expect(summary.keepInformed).toHaveLength(1);
      expect(summary.totalAssessed).toBe(4);
    });
  });

  describe("engagement recommendations", () => {
    it("returns recommendations for assessed stakeholders", async () => {
      await matrix.createAssessment({
        stakeholderId: "s-1",
        stakeholderName: "Key Player",
        segment: "EXECUTIVE_SPONSOR",
        power: "HIGH",
        interest: "HIGH",
        assessedBy: "u",
      });

      const recs = await matrix.getEngagementRecommendations("s-1");
      expect(recs).not.toBeNull();
      expect(recs?.strategy).toBe("MANAGE_CLOSELY");
      expect(recs?.actionItems.length).toBeGreaterThan(0);
      expect(recs?.nextTouchpoint).toContain("7 days");
    });

    it("returns null for unassessed stakeholders", async () => {
      const recs = await matrix.getEngagementRecommendations("nonexistent");
      expect(recs).toBeNull();
    });
  });

  describe("champion and resistance detection", () => {
    it("identifies champions (HIGH power, HIGH interest)", async () => {
      await matrix.createAssessment({
        stakeholderId: "s-1",
        stakeholderName: "Champ",
        segment: "X",
        power: "HIGH",
        interest: "HIGH",
        assessedBy: "u",
      });
      await matrix.createAssessment({
        stakeholderId: "s-2",
        stakeholderName: "Not",
        segment: "X",
        power: "LOW",
        interest: "HIGH",
        assessedBy: "u",
      });

      const champions = await matrix.identifyChampions();
      expect(champions).toHaveLength(1);
      expect(champions[0].stakeholderName).toBe("Champ");
    });

    it("identifies resistance candidates (HIGH power, LOW interest)", async () => {
      await matrix.createAssessment({
        stakeholderId: "s-1",
        stakeholderName: "Resistant",
        segment: "X",
        power: "HIGH",
        interest: "LOW",
        assessedBy: "u",
      });

      const candidates = await matrix.identifyResistanceCandidates();
      expect(candidates).toHaveLength(1);
      expect(candidates[0].stakeholderName).toBe("Resistant");
    });
  });
});
