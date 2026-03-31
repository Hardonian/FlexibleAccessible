// ─── Power/Interest Matrix Engine ──────────────────────────────────────
// Formal power/interest mapping with engagement strategy computation
// Fills gap: No formal power/interest matrix, influence paths not mapped

import type {
  PowerInterestEntry,
  MatrixSummary,
  PowerLevel,
  InterestLevel,
  EngagementStrategy,
} from "../types/power-interest";
import {
  MATRIX_POSITION,
  STRATEGY_DETAILS,
  ENGAGEMENT_STRATEGIES,
} from "../types/power-interest";

const assessments = new Map<string, PowerInterestEntry>();
let nextId = 1;

function generateId(): string {
  return `pi-${String(nextId++).padStart(4, "0")}`;
}

export class PowerInterestMatrix {
  // ── Assessment ──────────────────────────────────────────────────────

  /**
   * Compute the engagement strategy based on power and interest levels.
   * Uses the formal matrix mapping from the type definitions.
   */
  static computeStrategy(
    power: PowerLevel,
    interest: InterestLevel,
  ): EngagementStrategy {
    return MATRIX_POSITION[`${power}-${interest}`];
  }

  /**
   * Get detailed strategy information for an engagement strategy.
   */
  static getStrategyDetails(strategy: EngagementStrategy) {
    return STRATEGY_DETAILS[strategy];
  }

  // ── CRUD ─────────────────────────────────────────────────────────────

  async createAssessment(entry: {
    stakeholderId: string;
    stakeholderName: string;
    segment: string;
    power: PowerLevel;
    interest: InterestLevel;
    notes?: string;
    assessedBy: string;
  }): Promise<PowerInterestEntry> {
    const id = generateId();
    const strategy = PowerInterestMatrix.computeStrategy(
      entry.power,
      entry.interest,
    );
    const now = new Date();

    const record: PowerInterestEntry = {
      id,
      stakeholderId: entry.stakeholderId,
      stakeholderName: entry.stakeholderName,
      segment: entry.segment,
      power: entry.power,
      interest: entry.interest,
      strategy,
      notes: entry.notes,
      assessedAt: now,
      assessedBy: entry.assessedBy,
      createdAt: now,
      updatedAt: now,
    };

    assessments.set(id, record);
    return record;
  }

  async getAssessment(id: string): Promise<PowerInterestEntry | null> {
    return assessments.get(id) ?? null;
  }

  async getAssessmentByStakeholder(
    stakeholderId: string,
  ): Promise<PowerInterestEntry | null> {
    for (const assessment of assessments.values()) {
      if (assessment.stakeholderId === stakeholderId) {
        return assessment;
      }
    }
    return null;
  }

  async updateAssessment(
    id: string,
    updates: Partial<Pick<PowerInterestEntry, "power" | "interest" | "notes">>,
  ): Promise<PowerInterestEntry | null> {
    const existing = assessments.get(id);
    if (!existing) return null;

    const power = updates.power ?? existing.power;
    const interest = updates.interest ?? existing.interest;

    const updated: PowerInterestEntry = {
      ...existing,
      ...updates,
      power,
      interest,
      strategy: PowerInterestMatrix.computeStrategy(power, interest),
      updatedAt: new Date(),
    };

    assessments.set(id, updated);
    return updated;
  }

  async deleteAssessment(id: string): Promise<boolean> {
    return assessments.delete(id);
  }

  async clear(): Promise<void> {
    assessments.clear();
    nextId = 1;
  }

  // ── Matrix Summary ──────────────────────────────────────────────────

  async getMatrixSummary(): Promise<MatrixSummary> {
    const all = Array.from(assessments.values());

    const keyPlayers = all.filter((a) => a.strategy === "MANAGE_CLOSELY");
    const keepSatisfied = all.filter((a) => a.strategy === "KEEP_SATISFIED");
    const keepEngaged = all.filter((a) => a.strategy === "KEEP_ENGAGED");
    const keepInformed = all.filter((a) => a.strategy === "KEEP_INFORMED");

    const lastAssessed =
      all.length > 0
        ? new Date(Math.max(...all.map((a) => a.assessedAt.getTime())))
        : null;

    return {
      keyPlayers,
      keepSatisfied,
      keepEngaged,
      keepInformed,
      totalAssessed: all.length,
      coverageRate: all.length > 0 ? 100 : 0,
      lastAssessedAt: lastAssessed,
    };
  }

  // ── Engagement Strategy Recommendations ──────────────────────────────

  async getEngagementRecommendations(stakeholderId: string): Promise<{
    strategy: EngagementStrategy;
    details: (typeof STRATEGY_DETAILS)[EngagementStrategy];
    actionItems: string[];
    nextTouchpoint: string;
  } | null> {
    const assessment = await this.getAssessmentByStakeholder(stakeholderId);
    if (!assessment) return null;

    const details = STRATEGY_DETAILS[assessment.strategy];
    const actionItems = this.generateActionItems(assessment);
    const nextTouchpoint = this.computeNextTouchpoint(assessment);

    return {
      strategy: assessment.strategy,
      details,
      actionItems,
      nextTouchpoint,
    };
  }

  private generateActionItems(entry: PowerInterestEntry): string[] {
    const items: string[] = [];

    switch (entry.strategy) {
      case "MANAGE_CLOSELY":
        items.push("Schedule weekly 1:1 check-in");
        items.push("Include in strategic planning sessions");
        items.push("Provide executive-level briefings");
        items.push("Address concerns within 24 hours");
        break;
      case "KEEP_SATISFIED":
        items.push("Send monthly progress summary");
        items.push("Schedule quarterly review meeting");
        items.push("Brief before major decisions");
        items.push("Maintain proactive communication");
        break;
      case "KEEP_ENGAGED":
        items.push("Invite to working groups");
        items.push("Include in feedback loops");
        items.push("Provide detailed progress updates");
        items.push("Act on suggestions where feasible");
        break;
      case "KEEP_INFORMED":
        items.push("Include in newsletter distribution");
        items.push("Invite to open forums");
        items.push("Provide accessible summaries");
        items.push("Maintain transparent information sharing");
        break;
    }

    return items;
  }

  private computeNextTouchpoint(entry: PowerInterestEntry): string {
    switch (entry.strategy) {
      case "MANAGE_CLOSELY":
        return "Within 7 days (weekly cadence)";
      case "KEEP_SATISFIED":
        return "Within 30 days (monthly cadence)";
      case "KEEP_ENGAGED":
        return "Within 14 days (bi-weekly cadence)";
      case "KEEP_INFORMED":
        return "Within 30 days (monthly cadence)";
    }
  }

  // ── Champion / Resistance Detection ──────────────────────────────────

  async identifyChampions(): Promise<PowerInterestEntry[]> {
    return Array.from(assessments.values()).filter(
      (a) => a.strategy === "MANAGE_CLOSELY" && a.power === "HIGH",
    );
  }

  async identifyResistanceCandidates(): Promise<PowerInterestEntry[]> {
    return Array.from(assessments.values()).filter(
      (a) => a.power === "HIGH" && a.interest === "LOW",
    );
  }

  // ── Export ────────────────────────────────────────────────────────────

  async exportAll(): Promise<PowerInterestEntry[]> {
    return Array.from(assessments.values());
  }
}
