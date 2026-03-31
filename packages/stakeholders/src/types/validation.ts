// ─── Validation Framework Types ────────────────────────────────────────
// Triangulation and continuous validation methods

import { z } from "zod";

export const VALIDATION_METHODS = [
  "STAKEHOLDER_WORKSHOP",
  "SURVEY_FEEDBACK",
  "USABILITY_TESTING",
  "AT_COMPATIBILITY_TEST",
  "EXTERNAL_BENCHMARKING",
  "TRIANGULATION",
  "RED_TEAM_REVIEW",
  "ACCESSIBILITY_AUDIT",
  "CONTINUOUS_FEEDBACK",
] as const;

export type ValidationMethod = (typeof VALIDATION_METHODS)[number];

export const VALIDATION_OUTCOMES = [
  "PASSED",
  "FAILED",
  "CONDITIONAL",
  "NEEDS_REVIEW",
] as const;

export type ValidationOutcome = (typeof VALIDATION_OUTCOMES)[number];

// Zod schemas
export const validationRecordSchema = z.object({
  method: z.enum(VALIDATION_METHODS),
  target: z.string().min(1), // what is being validated
  outcome: z.enum(VALIDATION_OUTCOMES),
  findings: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  evidence: z.array(z.string()).default([]),
  owner: z.string(),
  validatedAt: z.date(),
  nextValidation: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ValidationRecordInput = z.infer<typeof validationRecordSchema>;

export interface ValidationRecord {
  id: string;
  method: ValidationMethod;
  target: string;
  outcome: ValidationOutcome;
  findings: string[];
  recommendations: string[];
  evidence: string[];
  owner: string;
  validatedAt: Date;
  nextValidation?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Triangulation data sources
export interface TriangulationSource {
  id: string;
  name: string;
  type: "PRIMARY" | "SECONDARY" | "EXTERNAL";
  reliability: "HIGH" | "MEDIUM" | "LOW";
  lastAccessed: Date;
}

// Triangulation result
export interface TriangulationResult {
  target: string;
  sources: TriangulationSource[];
  agreements: string[];
  contradictions: string[];
  gaps: string[];
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  conclusion: string;
  recommendations: string[];
  conductedAt: Date;
}
