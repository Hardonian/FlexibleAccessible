// ─── Bias Audit Types ──────────────────────────────────────────────────
// Systematic bias detection and mitigation for stakeholder analysis

import { z } from "zod";

// Bias dimensions relevant to accessibility stakeholder analysis
export const BIAS_DIMENSIONS = [
  "ACCESSIBILITY_VISIBLE", // Focus on visible disabilities, ignoring cognitive/invisible
  "CONFIRMATION_BIAS", // Seeking evidence that confirms existing beliefs
  "SURVIVORSHIP_BIAS", // Only studying successful cases
  "TECHNOLOGY_BIAS", // Digital-first bias, ignoring analog alternatives
  "INTERSECTIONAL_BIAS", // Ignoring compound barriers
  "GEOGRAPHIC_BIAS", // Western/developed-world assumptions
  "LANGUAGE_BIAS", // English-only analysis
  "ECONOMIC_BIAS", // Tech-savvy, well-resourced assumptions
  "AGE_BIAS", // Younger tech-focused bias
  "PATTERN_COMPLETION_BIAS", // Filling gaps with assumptions
  "ANCHORING_BIAS", // Over-relying on first data point
  "SELECTION_BIAS", // Non-representative sample
] as const;

export type BiasDimension = (typeof BIAS_DIMENSIONS)[number];

// Severity of bias finding
export const BIAS_SEVERITIES = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFO",
] as const;
export type BiasSeverity = (typeof BIAS_SEVERITIES)[number];

// Status of bias mitigation
export const BIAS_MITIGATION_STATUSES = [
  "IDENTIFIED",
  "ACKNOWLEDGED",
  "MITIGATION_PLANNED",
  "MITIGATION_IN_PROGRESS",
  "MITIGATED",
  "ACCEPTED_RISK",
] as const;

export type BiasMitigationStatus = (typeof BIAS_MITIGATION_STATUSES)[number];

// Zod schemas
export const biasAuditEntrySchema = z.object({
  dimension: z.enum(BIAS_DIMENSIONS),
  severity: z.enum(BIAS_SEVERITIES),
  finding: z.string().min(1),
  evidence: z.string().optional(),
  mitigationPlan: z.string().optional(),
  mitigationStatus: z.enum(BIAS_MITIGATION_STATUSES).default("IDENTIFIED"),
  owner: z.string().optional(),
  dueDate: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type BiasAuditEntryInput = z.infer<typeof biasAuditEntrySchema>;

export interface BiasAuditEntry {
  id: string;
  dimension: BiasDimension;
  severity: BiasSeverity;
  finding: string;
  evidence?: string;
  mitigationPlan?: string;
  mitigationStatus: BiasMitigationStatus;
  owner?: string;
  dueDate?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BiasAuditResult {
  id: string;
  organizationId: string;
  auditedAt: Date;
  auditedBy: string;
  entries: BiasAuditEntry[];
  overallScore: number; // 0-100, higher = less biased
  criticalFindings: number;
  mitigatedCount: number;
  acceptedRiskCount: number;
  recommendations: string[];
  nextAuditDate: Date;
}

// Red team review protocol
export interface RedTeamReview {
  id: string;
  analysisId: string;
  reviewers: string[];
  challengerQuestions: string[];
  alternativeHypotheses: string[];
  contradictions: string[];
  weakAssumptions: string[];
  recommendations: string[];
  outcome: "PASS" | "FAIL" | "CONDITIONAL";
  notes?: string;
  conductedAt: Date;
}
