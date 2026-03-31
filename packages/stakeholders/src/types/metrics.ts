// ─── Metrics & Maturity Types ──────────────────────────────────────────
// Measurement framework for stakeholder engagement success

import { z } from "zod";

// Maturity dimensions
export const MATURITY_DIMENSIONS = [
  "IDENTIFICATION",
  "ENGAGEMENT",
  "COMMUNICATION",
  "FEEDBACK",
  "BIAS_MANAGEMENT",
  "VALIDATION",
  "ALIGNMENT",
] as const;

export type MaturityDimension = (typeof MATURITY_DIMENSIONS)[number];

// Maturity levels
export const MATURITY_LEVELS = [1, 2, 3, 4, 5] as const;
export type MaturityLevel = (typeof MATURITY_LEVELS)[number];

export const MATURITY_LEVEL_NAMES: Record<MaturityLevel, string> = {
  1: "Initial",
  2: "Developing",
  3: "Defined",
  4: "Managed",
  5: "Optimizing",
};

export const MATURITY_LEVEL_DESCRIPTIONS: Record<
  MaturityDimension,
  Record<MaturityLevel, string>
> = {
  IDENTIFICATION: {
    1: "Ad-hoc identification",
    2: "Partial registry",
    3: "Complete registry",
    4: "Dynamic tracking",
    5: "Predictive modeling",
  },
  ENGAGEMENT: {
    1: "Reactive engagement",
    2: "Responsive engagement",
    3: "Proactive engagement",
    4: "Integrated engagement",
    5: "Continuous engagement",
  },
  COMMUNICATION: {
    1: "One-way communication",
    2: "Two-way communication",
    3: "Multi-channel communication",
    4: "Personalized communication",
    5: "Adaptive communication",
  },
  FEEDBACK: {
    1: "No feedback collection",
    2: "Surveys",
    3: "Active collection",
    4: "Closed-loop feedback",
    5: "Predictive feedback",
  },
  BIAS_MANAGEMENT: {
    1: "Unaware of bias",
    2: "Aware of bias",
    3: "Checklisted bias management",
    4: "Systematic bias management",
    5: "Embedded bias management",
  },
  VALIDATION: {
    1: "No validation",
    2: "Event-based validation",
    3: "Periodic validation",
    4: "Continuous validation",
    5: "Predictive validation",
  },
  ALIGNMENT: {
    1: "No goal alignment",
    2: "Partial alignment",
    3: "Documented alignment",
    4: "Measured alignment",
    5: "Optimized alignment",
  },
};

// Metric types
export const METRIC_TYPES = [
  "ENGAGEMENT_COVERAGE",
  "SURVEY_RESPONSE_RATE",
  "WORKING_GROUP_PARTICIPATION",
  "FEEDBACK_CLOSE_RATE",
  "SATISFACTION_SCORE",
  "AT_COMPATIBILITY",
  "ACCESSIBILITY_CONFORMANCE",
  "STAKEHOLDER_COVERAGE",
  "RESPONSE_TIME",
  "RESOLUTION_TIME",
] as const;

export type MetricType = (typeof METRIC_TYPES)[number];

// Zod schemas
export const metricTargetSchema = z.object({
  metricType: z.enum(METRIC_TYPES),
  baseline: z.number().nullable(),
  target: z.number(),
  current: z.number().nullable(),
  unit: z.string(),
  deadline: z.date().optional(),
});

export type MetricTargetInput = z.infer<typeof metricTargetSchema>;

export interface MetricTarget {
  id: string;
  metricType: MetricType;
  baseline: number | null;
  target: number;
  current: number | null;
  unit: string;
  deadline?: Date;
  trend: "IMPROVING" | "STABLE" | "DECLINING" | "UNKNOWN";
  createdAt: Date;
  updatedAt: Date;
}

export interface StakeholderMetric {
  id: string;
  metricType: MetricType;
  value: number;
  unit: string;
  measuredAt: Date;
  measuredBy: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface MaturityAssessment {
  id: string;
  organizationId: string;
  assessedAt: Date;
  assessedBy: string;
  dimensions: Record<MaturityDimension, MaturityLevel>;
  overallLevel: MaturityLevel;
  recommendations: string[];
  nextAssessment: Date;
}
