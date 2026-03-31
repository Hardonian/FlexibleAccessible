// ─── Bias Audit Types ──────────────────────────────────────────────────
// Systematic bias detection and mitigation for stakeholder analysis

import { z } from "zod";

export const BIAS_DIMENSIONS = [
  "ACCESSIBILITY_VISIBLE",
  "CONFIRMATION_BIAS",
  "SURVIVORSHIP_BIAS",
  "TECHNOLOGY_BIAS",
  "INTERSECTIONAL_BIAS",
  "GEOGRAPHIC_BIAS",
  "LANGUAGE_BIAS",
  "ECONOMIC_BIAS",
  "AGE_BIAS",
  "PATTERN_COMPLETION_BIAS",
  "ANCHORING_BIAS",
  "SELECTION_BIAS",
] as const;

export type BiasDimension = (typeof BIAS_DIMENSIONS)[number];

export const BIAS_SEVERITIES = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
  "INFO",
] as const;
export type BiasSeverity = (typeof BIAS_SEVERITIES)[number];

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
  mitigationStatus: z.enum(BIAS_MITIGATION_STATUSES).optional(),
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
  overallScore: number;
  criticalFindings: number;
  mitigatedCount: number;
  acceptedRiskCount: number;
  recommendations: string[];
  nextAuditDate: Date;
}

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
