// ─── Metrics Tracker ───────────────────────────────────────────────────
// Baseline/target tracking with maturity assessment
// Fills gap: No success metric definition, no maturity assessment framework

import type {
  StakeholderMetric,
  MetricTarget,
  MetricType,
  MaturityLevel,
  MaturityDimension,
  MaturityAssessment,
} from "../types/metrics";
import {
  METRIC_TYPES,
  MATURITY_DIMENSIONS,
  MATURITY_LEVELS,
  MATURITY_LEVEL_NAMES,
  MATURITY_LEVEL_DESCRIPTIONS,
} from "../types/metrics";

const metrics: StakeholderMetric[] = [];
const targets = new Map<string, MetricTarget>();
let nextId = 1;

function generateId(prefix: string): string {
  return `${prefix}-${String(nextId++).padStart(4, "0")}`;
}

export class MetricsTracker {
  // ── Metric Recording ─────────────────────────────────────────────────

  async recordMetric(input: {
    metricType: MetricType;
    value: number;
    unit: string;
    measuredBy: string;
    notes?: string;
  }): Promise<StakeholderMetric> {
    const metric: StakeholderMetric = {
      id: generateId("metric"),
      metricType: input.metricType,
      value: input.value,
      unit: input.unit,
      measuredAt: new Date(),
      measuredBy: input.measuredBy,
      notes: input.notes,
    };
    metrics.push(metric);
    return metric;
  }

  // ── Target Management ────────────────────────────────────────────────

  async setTarget(input: {
    metricType: MetricType;
    baseline: number | null;
    target: number;
    unit: string;
    deadline?: Date;
  }): Promise<MetricTarget> {
    const id = generateId("target");
    const now = new Date();

    const target: MetricTarget = {
      id,
      metricType: input.metricType,
      baseline: input.baseline,
      target: input.target,
      current: null,
      unit: input.unit,
      deadline: input.deadline,
      trend: "UNKNOWN",
      createdAt: now,
      updatedAt: now,
    };

    targets.set(id, target);
    return target;
  }

  async getTarget(id: string): Promise<MetricTarget | null> {
    return targets.get(id) ?? null;
  }

  async getTargetByType(metricType: MetricType): Promise<MetricTarget | null> {
    for (const target of targets.values()) {
      if (target.metricType === metricType) return target;
    }
    return null;
  }

  async updateTargetCurrent(
    metricType: MetricType,
    currentValue: number,
  ): Promise<MetricTarget | null> {
    for (const [id, target] of targets) {
      if (target.metricType === metricType) {
        const previousCurrent = target.current;
        let trend: MetricTarget["trend"] = "UNKNOWN";

        if (previousCurrent !== null) {
          if (currentValue > previousCurrent) trend = "IMPROVING";
          else if (currentValue < previousCurrent) trend = "DECLINING";
          else trend = "STABLE";
        }

        const updated: MetricTarget = {
          ...target,
          current: currentValue,
          trend,
          updatedAt: new Date(),
        };

        targets.set(id, updated);
        return updated;
      }
    }
    return null;
  }

  // ── Default Targets (from gap analysis) ──────────────────────────────

  async initializeDefaultTargets(): Promise<MetricTarget[]> {
    const defaults: Array<{
      metricType: MetricType;
      baseline: number | null;
      target: number;
      unit: string;
    }> = [
      {
        metricType: "STAKEHOLDER_COVERAGE",
        baseline: null,
        target: 95,
        unit: "%",
      },
      {
        metricType: "SURVEY_RESPONSE_RATE",
        baseline: null,
        target: 70,
        unit: "%",
      },
      {
        metricType: "WORKING_GROUP_PARTICIPATION",
        baseline: null,
        target: 60,
        unit: "%",
      },
      {
        metricType: "FEEDBACK_CLOSE_RATE",
        baseline: null,
        target: 80,
        unit: "%",
      },
      {
        metricType: "SATISFACTION_SCORE",
        baseline: null,
        target: 4.0,
        unit: "/5",
      },
      {
        metricType: "AT_COMPATIBILITY",
        baseline: null,
        target: 100,
        unit: "%",
      },
      {
        metricType: "ACCESSIBILITY_CONFORMANCE",
        baseline: null,
        target: 95,
        unit: "%",
      },
      { metricType: "RESPONSE_TIME", baseline: null, target: 7, unit: "days" },
      {
        metricType: "RESOLUTION_TIME",
        baseline: null,
        target: 30,
        unit: "days",
      },
      {
        metricType: "ENGAGEMENT_COVERAGE",
        baseline: null,
        target: 95,
        unit: "%",
      },
    ];

    const created: MetricTarget[] = [];
    for (const def of defaults) {
      created.push(await this.setTarget(def));
    }
    return created;
  }

  // ── Metric History & Trends ──────────────────────────────────────────

  async getMetricHistory(
    metricType: MetricType,
    days?: number,
  ): Promise<StakeholderMetric[]> {
    let filtered = metrics.filter((m) => m.metricType === metricType);

    if (days) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((m) => m.measuredAt >= cutoff);
    }

    return filtered.sort(
      (a, b) => b.measuredAt.getTime() - a.measuredAt.getTime(),
    );
  }

  async getLatestMetric(
    metricType: MetricType,
  ): Promise<StakeholderMetric | null> {
    const history = await this.getMetricHistory(metricType);
    return history[0] ?? null;
  }

  // ── Maturity Assessment ──────────────────────────────────────────────

  async assessMaturity(context: {
    organizationId: string;
    assessedBy: string;
    hasRegistry: boolean;
    registryCoverage: number;
    hasEngagementStrategy: boolean;
    hasCommunicationPlan: boolean;
    hasFeedbackLoop: boolean;
    hasBiasAudit: boolean;
    hasValidationFramework: boolean;
    hasGoalAlignment: boolean;
    engagementRate: number;
    feedbackCloseRate: number;
    biasScore: number;
  }): Promise<MaturityAssessment> {
    const dimensions: Record<MaturityDimension, MaturityLevel> = {
      IDENTIFICATION: this.assessIdentification(context),
      ENGAGEMENT: this.assessEngagement(context),
      COMMUNICATION: this.assessCommunication(context),
      FEEDBACK: this.assessFeedback(context),
      BIAS_MANAGEMENT: this.assessBiasManagement(context),
      VALIDATION: this.assessValidation(context),
      ALIGNMENT: this.assessAlignment(context),
    };

    const levels = Object.values(dimensions);
    const overallLevel = Math.round(
      levels.reduce((sum, l) => sum + l, 0) / levels.length,
    ) as MaturityLevel;

    const recommendations = this.generateMaturityRecommendations(dimensions);

    return {
      id: generateId("maturity"),
      organizationId: context.organizationId,
      assessedAt: new Date(),
      assessedBy: context.assessedBy,
      dimensions,
      overallLevel,
      recommendations,
      nextAssessment: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    };
  }

  private assessIdentification(ctx: {
    hasRegistry: boolean;
    registryCoverage: number;
  }): MaturityLevel {
    if (!ctx.hasRegistry) return 1;
    if (ctx.registryCoverage < 50) return 2;
    if (ctx.registryCoverage < 90) return 3;
    if (ctx.registryCoverage < 95) return 4;
    return 5;
  }

  private assessEngagement(ctx: {
    hasEngagementStrategy: boolean;
    engagementRate: number;
  }): MaturityLevel {
    if (!ctx.hasEngagementStrategy) return 1;
    if (ctx.engagementRate < 30) return 2;
    if (ctx.engagementRate < 60) return 3;
    if (ctx.engagementRate < 80) return 4;
    return 5;
  }

  private assessCommunication(ctx: {
    hasCommunicationPlan: boolean;
  }): MaturityLevel {
    if (!ctx.hasCommunicationPlan) return 1;
    return 3; // Defined — plan exists
  }

  private assessFeedback(ctx: {
    hasFeedbackLoop: boolean;
    feedbackCloseRate: number;
  }): MaturityLevel {
    if (!ctx.hasFeedbackLoop) return 1;
    if (ctx.feedbackCloseRate < 50) return 2;
    if (ctx.feedbackCloseRate < 70) return 3;
    if (ctx.feedbackCloseRate < 90) return 4;
    return 5;
  }

  private assessBiasManagement(ctx: {
    hasBiasAudit: boolean;
    biasScore: number;
  }): MaturityLevel {
    if (!ctx.hasBiasAudit) return 1;
    if (ctx.biasScore < 30) return 2;
    if (ctx.biasScore < 60) return 3;
    if (ctx.biasScore < 80) return 4;
    return 5;
  }

  private assessValidation(ctx: {
    hasValidationFramework: boolean;
  }): MaturityLevel {
    if (!ctx.hasValidationFramework) return 1;
    return 3; // Defined — framework exists
  }

  private assessAlignment(ctx: { hasGoalAlignment: boolean }): MaturityLevel {
    if (!ctx.hasGoalAlignment) return 1;
    return 3; // Defined — alignment documented
  }

  private generateMaturityRecommendations(
    dimensions: Record<MaturityDimension, MaturityLevel>,
  ): string[] {
    const recommendations: string[] = [];

    for (const [dimension, level] of Object.entries(dimensions)) {
      if (level < 3) {
        recommendations.push(
          `${dimension}: Currently at Level ${level} (${MATURITY_LEVEL_NAMES[level]}). Target Level 3 (${MATURITY_LEVEL_NAMES[3]}): ${MATURITY_LEVEL_DESCRIPTIONS[dimension as MaturityDimension][3]}`,
        );
      }
      if (level < 5) {
        recommendations.push(
          `${dimension}: To reach Level ${level + 1} (${MATURITY_LEVEL_NAMES[(level + 1) as MaturityLevel]}): ${MATURITY_LEVEL_DESCRIPTIONS[dimension as MaturityDimension][(level + 1) as MaturityLevel]}`,
        );
      }
    }

    return recommendations;
  }

  // ── Dashboard Summary ────────────────────────────────────────────────

  async getDashboardSummary(): Promise<{
    targets: MetricTarget[];
    latestMetrics: Partial<Record<MetricType, StakeholderMetric>>;
    onTrack: number;
    behindTarget: number;
    aheadOfTarget: number;
  }> {
    const allTargets = Array.from(targets.values());
    const latestMetrics: Partial<Record<MetricType, StakeholderMetric>> = {};

    let onTrack = 0;
    let behindTarget = 0;
    let aheadOfTarget = 0;

    for (const target of allTargets) {
      const latest = await this.getLatestMetric(target.metricType);
      if (latest) {
        latestMetrics[target.metricType] = latest;

        if (
          target.metricType === "RESPONSE_TIME" ||
          target.metricType === "RESOLUTION_TIME"
        ) {
          // Lower is better
          if (latest.value <= target.target) aheadOfTarget++;
          else behindTarget++;
        } else {
          // Higher is better
          if (latest.value >= target.target) aheadOfTarget++;
          else if (latest.value >= target.target * 0.8) onTrack++;
          else behindTarget++;
        }
      }
    }

    return {
      targets: allTargets,
      latestMetrics,
      onTrack,
      behindTarget,
      aheadOfTarget,
    };
  }

  // ── Export ────────────────────────────────────────────────────────────

  async exportMetrics(): Promise<StakeholderMetric[]> {
    return [...metrics];
  }

  async exportTargets(): Promise<MetricTarget[]> {
    return Array.from(targets.values());
  }

  async clear(): Promise<void> {
    metrics.length = 0;
    targets.clear();
    nextId = 1;
  }
}
