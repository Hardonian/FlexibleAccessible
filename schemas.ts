import { z } from "zod";

/**
 * Zod schema for a single issue identified by the vision model.
 */
export const CriterionIssueSchema = z.object({
  description: z.string(),
  severity: z.enum(["critical", "serious", "moderate", "minor"]),
  selector: z.string().describe("A best-guess CSS selector for the element."),
  element_description: z
    .string()
    .describe("A human-readable description of the element."),
  suggested_fix: z.string(),
  evidence: z
    .string()
    .describe("What was observed in the screenshot to justify the finding."),
});

/**
 * Zod schema for the status of a single WCAG criterion.
 */
export const CriterionStatusSchema = z.object({
  criterion_id: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "Must be a valid WCAG criterion ID like '1.4.3'"),
  criterion_name: z.string(),
  level: z.enum(["A", "AA"]),
  status: z.enum(["pass", "fail", "partial", "not_applicable", "uncertain"]),
  confidence: z.number().min(0).max(1),
  issues: z.array(CriterionIssueSchema),
});

/**
 * Zod schema for the entire vision analysis output.
 */
export const VisionAnalysisOutputSchema = z.object({
  page_id: z.string(),
  url: z.string().url(),
  timestamp: z.string().datetime(),
  model_version: z.string(),
  latency_ms: z.number(),
  overall_score: z.number().min(0).max(100),
  criteria_status: z.array(CriterionStatusSchema),
  requires_human_review: z.boolean(),
  human_review_reasons: z.array(z.string()),
});