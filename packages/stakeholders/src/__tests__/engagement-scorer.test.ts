// ─── Engagement Scorer Tests ───────────────────────────────────────────
import { describe, expect, it, beforeEach } from "vitest";
import { EngagementScorer } from "../services/engagement-scorer";
import type { Stakeholder } from "../types/stakeholder";
import type { PowerInterestEntry } from "../types/power-interest";

describe("EngagementScorer", () => {
  let scorer: EngagementScorer;

  beforeEach(() => {
    scorer = new EngagementScorer();
  });

  const createStakeholder = (
    overrides: Partial<Stakeholder> = {},
  ): Stakeholder => ({
    id: "s-001",
    name: "Test User",
    role: "Tester",
    segment: "PROJECT_TEAM",
    power: "HIGH",
    interest: "HIGH",
    engagementStatus: "ACTIVE",
    accessibilityNeeds: [],
    tags: [],
    underrepresentedGroups: [],
    language: "en",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createPowerInterest = (
    overrides: Partial<PowerInterestEntry> = {},
  ): PowerInterestEntry => ({
    id: "pi-001",
    stakeholderId: "s-001",
    stakeholderName: "Test User",
    segment: "PROJECT_TEAM",
    power: "HIGH",
    interest: "HIGH",
    strategy: "MANAGE_CLOSELY",
    assessedAt: new Date(),
    assessedBy: "user-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  describe("score calculation", () => {
    it("calculates high score for well-engaged stakeholder", () => {
      const stakeholder = createStakeholder({
        engagementStatus: "CHAMPION",
        accessibilityNeeds: ["SCREEN_READER"],
        updatedAt: new Date(), // very recent
      });
      const pi = createPowerInterest();
      const score = scorer.calculateScore(stakeholder, pi, []);

      expect(score.overallScore).toBeGreaterThan(70);
      expect(score.grade).toMatch(/A|B/);
    });

    it("calculates low score for lost stakeholder", () => {
      const stakeholder = createStakeholder({
        engagementStatus: "LOST",
        updatedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000), // 100 days ago
      });
      const score = scorer.calculateScore(stakeholder, null, []);

      expect(score.overallScore).toBeLessThan(40);
      expect(score.grade).toMatch(/D|F/);
    });

    it("handles missing power/interest assessment", () => {
      const stakeholder = createStakeholder();
      const score = scorer.calculateScore(stakeholder, null, []);

      expect(score.components.powerInterest).toBe(50); // neutral
    });

    it("generates recommendations for low-scoring stakeholders", () => {
      const stakeholder = createStakeholder({
        engagementStatus: "NOT_CONTACTED",
        updatedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      });
      const score = scorer.calculateScore(stakeholder, null, []);

      expect(score.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe("grade assignment", () => {
    it("assigns grade A for scores >= 90", () => {
      const stakeholder = createStakeholder({
        engagementStatus: "CHAMPION",
        accessibilityNeeds: ["SCREEN_READER"],
        updatedAt: new Date(),
      });
      const pi = createPowerInterest();
      const score = scorer.calculateScore(stakeholder, pi, []);

      if (score.overallScore >= 90) {
        expect(score.grade).toBe("A");
      }
    });

    it("assigns grade F for scores < 40", () => {
      const stakeholder = createStakeholder({
        engagementStatus: "LOST",
        updatedAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
      });
      const score = scorer.calculateScore(stakeholder, null, []);

      if (score.overallScore < 40) {
        expect(score.grade).toBe("F");
      }
    });
  });

  describe("portfolio summary", () => {
    it("computes summary across all scored stakeholders", async () => {
      scorer.calculateScore(
        createStakeholder({
          id: "s-1",
          engagementStatus: "CHAMPION",
          updatedAt: new Date(),
        }),
        createPowerInterest({ stakeholderId: "s-1" }),
        [],
      );
      scorer.calculateScore(
        createStakeholder({
          id: "s-2",
          engagementStatus: "ACTIVE",
          updatedAt: new Date(),
        }),
        createPowerInterest({ stakeholderId: "s-2" }),
        [],
      );
      scorer.calculateScore(
        createStakeholder({
          id: "s-3",
          engagementStatus: "LOST",
          updatedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
        }),
        null,
        [],
      );

      const summary = await scorer.getPortfolioSummary();
      expect(summary.averageScore).toBeGreaterThan(0);
      expect(summary.lowestScores.length).toBeLessThanOrEqual(5);
      expect(summary.highestScores.length).toBeLessThanOrEqual(5);
    });
  });
});
