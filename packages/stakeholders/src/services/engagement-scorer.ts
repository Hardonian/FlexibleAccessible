// ─── Engagement Scorer ─────────────────────────────────────────────────
// Quantified engagement scoring for stakeholder relationship health
// Fills gap: No stakeholder relationship scoring, no engagement differentiation

import type { Stakeholder } from "../types/stakeholder";
import type { PowerInterestEntry } from "../types/power-interest";
import type { FeedbackItem } from "../types/feedback";

export interface EngagementScore {
  stakeholderId: string;
  stakeholderName: string;
  overallScore: number; // 0-100
  components: {
    powerInterest: number;
    engagementStatus: number;
    feedbackResponsiveness: number;
    accessibilityNeeds: number;
    recency: number;
  };
  grade: "A" | "B" | "C" | "D" | "F";
  trend: "IMPROVING" | "STABLE" | "DECLINING" | "UNKNOWN";
  recommendations: string[];
  lastCalculated: Date;
}

const scores = new Map<string, EngagementScore>();
let previousScores = new Map<string, number>();

export class EngagementScorer {
  // ── Score Calculation ────────────────────────────────────────────────

  calculateScore(
    stakeholder: Stakeholder,
    powerInterestEntry: PowerInterestEntry | null,
    feedbackItems: FeedbackItem[],
  ): EngagementScore {
    const components = {
      powerInterest: this.scorePowerInterest(stakeholder, powerInterestEntry),
      engagementStatus: this.scoreEngagementStatus(
        stakeholder.engagementStatus,
      ),
      feedbackResponsiveness: this.scoreFeedbackResponsiveness(feedbackItems),
      accessibilityNeeds: this.scoreAccessibilityNeeds(stakeholder),
      recency: this.scoreRecency(stakeholder),
    };

    // Weighted scoring
    const weights = {
      powerInterest: 0.25,
      engagementStatus: 0.3,
      feedbackResponsiveness: 0.2,
      accessibilityNeeds: 0.15,
      recency: 0.1,
    };

    const overallScore = Math.round(
      components.powerInterest * weights.powerInterest +
        components.engagementStatus * weights.engagementStatus +
        components.feedbackResponsiveness * weights.feedbackResponsiveness +
        components.accessibilityNeeds * weights.accessibilityNeeds +
        components.recency * weights.recency,
    );

    const grade = this.scoreToGrade(overallScore);
    const trend = this.computeTrend(stakeholder.id, overallScore);
    const recommendations = this.generateRecommendations(
      stakeholder,
      components,
    );

    const score: EngagementScore = {
      stakeholderId: stakeholder.id,
      stakeholderName: stakeholder.name,
      overallScore,
      components,
      grade,
      trend,
      recommendations,
      lastCalculated: new Date(),
    };

    scores.set(stakeholder.id, score);
    return score;
  }

  private scorePowerInterest(
    _stakeholder: Stakeholder,
    entry: PowerInterestEntry | null,
  ): number {
    if (!entry) return 50; // No assessment yet

    // Higher score = better positioned
    const powerScore = { HIGH: 100, MEDIUM: 65, LOW: 30 }[entry.power];
    const interestScore = { HIGH: 100, MEDIUM: 65, LOW: 30 }[entry.interest];

    // Best: high power + high interest; Worst: low power + low interest
    return Math.round((powerScore + interestScore) / 2);
  }

  private scoreEngagementStatus(status: string): number {
    const scoreMap: Record<string, number> = {
      CHAMPION: 100,
      ACTIVE: 85,
      INITIAL_CONTACT: 50,
      NOT_CONTACTED: 20,
      RESISTANT: 35, // They're engaged, even if resistant
      DISINTERESTED: 15,
      LOST: 0,
    };
    return scoreMap[status] ?? 20;
  }

  private scoreFeedbackResponsiveness(items: FeedbackItem[]): number {
    if (items.length === 0) return 50; // Neutral if no feedback

    const responded = items.filter(
      (i) => i.status !== "RECEIVED" && i.status !== "DUPLICATE",
    );

    const responseRate = responded.length / items.length;

    // Factor in response time
    const avgResponseTime =
      items
        .filter((i) => i.responseTimeDays !== null)
        .reduce((sum, i) => sum + (i.responseTimeDays ?? 0), 0) /
      Math.max(responded.length, 1);

    let timeScore = 100;
    if (avgResponseTime > 30) timeScore = 30;
    else if (avgResponseTime > 14) timeScore = 50;
    else if (avgResponseTime > 7) timeScore = 70;

    return Math.round(responseRate * 60 + timeScore * 0.4);
  }

  private scoreAccessibilityNeeds(stakeholder: Stakeholder): number {
    if (stakeholder.accessibilityNeeds.length === 0) return 50;
    // Having accessibility needs documented is good — means they're being tracked
    return Math.min(100, 50 + stakeholder.accessibilityNeeds.length * 10);
  }

  private scoreRecency(stakeholder: Stakeholder): number {
    const daysSinceUpdate = Math.floor(
      (Date.now() - stakeholder.updatedAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceUpdate <= 7) return 100;
    if (daysSinceUpdate <= 14) return 85;
    if (daysSinceUpdate <= 30) return 70;
    if (daysSinceUpdate <= 60) return 50;
    if (daysSinceUpdate <= 90) return 30;
    return 10;
  }

  private scoreToGrade(score: number): EngagementScore["grade"] {
    if (score >= 90) return "A";
    if (score >= 75) return "B";
    if (score >= 60) return "C";
    if (score >= 40) return "D";
    return "F";
  }

  private computeTrend(
    stakeholderId: string,
    currentScore: number,
  ): EngagementScore["trend"] {
    const previous = previousScores.get(stakeholderId);
    if (previous === undefined) {
      previousScores.set(stakeholderId, currentScore);
      return "UNKNOWN";
    }

    previousScores.set(stakeholderId, currentScore);

    const diff = currentScore - previous;
    if (diff > 5) return "IMPROVING";
    if (diff < -5) return "DECLINING";
    return "STABLE";
  }

  private generateRecommendations(
    stakeholder: Stakeholder,
    components: EngagementScore["components"],
  ): string[] {
    const recommendations: string[] = [];

    if (components.powerInterest < 50) {
      recommendations.push(
        "Complete power/interest assessment for this stakeholder",
      );
    }

    if (components.engagementStatus < 50) {
      recommendations.push(
        `Move engagement status from ${stakeholder.engagementStatus} to ACTIVE`,
      );
    }

    if (components.feedbackResponsiveness < 50) {
      recommendations.push("Follow up on outstanding feedback items");
    }

    if (
      components.accessibilityNeeds < 50 &&
      stakeholder.accessibilityNeeds.length > 0
    ) {
      recommendations.push(
        "Verify accessibility needs are being met in all communications",
      );
    }

    if (components.recency < 50) {
      recommendations.push(
        "Schedule engagement touchpoint — last contact is stale",
      );
    }

    return recommendations;
  }

  // ── Portfolio Analytics ──────────────────────────────────────────────

  async getPortfolioSummary(): Promise<{
    averageScore: number;
    byGrade: Record<EngagementScore["grade"], number>;
    byTrend: Record<EngagementScore["trend"], number>;
    lowestScores: EngagementScore[];
    highestScores: EngagementScore[];
    recommendationsNeeded: number;
  }> {
    const all = Array.from(scores.values());

    const byGrade = { A: 0, B: 0, C: 0, D: 0, F: 0 } as Record<
      EngagementScore["grade"],
      number
    >;
    const byTrend = {
      IMPROVING: 0,
      STABLE: 0,
      DECLINING: 0,
      UNKNOWN: 0,
    } as Record<EngagementScore["trend"], number>;

    let totalScore = 0;
    let recommendationsNeeded = 0;

    for (const score of all) {
      totalScore += score.overallScore;
      byGrade[score.grade]++;
      byTrend[score.trend]++;
      if (score.recommendations.length > 0) recommendationsNeeded++;
    }

    const sorted = [...all].sort((a, b) => a.overallScore - b.overallScore);

    return {
      averageScore: all.length > 0 ? Math.round(totalScore / all.length) : 0,
      byGrade,
      byTrend,
      lowestScores: sorted.slice(0, 5),
      highestScores: sorted.slice(-5).reverse(),
      recommendationsNeeded,
    };
  }

  // ── Export ────────────────────────────────────────────────────────────

  async getScore(stakeholderId: string): Promise<EngagementScore | null> {
    return scores.get(stakeholderId) ?? null;
  }

  async getAllScores(): Promise<EngagementScore[]> {
    return Array.from(scores.values());
  }

  async clear(): Promise<void> {
    scores.clear();
    previousScores.clear();
  }
}
