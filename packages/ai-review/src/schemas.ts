import { z } from "zod";

export const CriterionIssueSchema = z.object({
  description: z.string(),
  severity: z.enum(["critical", "serious", "moderate", "minor"]),
  selector: z.string(),
  element_description: z.string().optional(),
  suggested_fix: z.string().optional(),
  evidence: z.string().optional(),
});

export const CriterionStatusSchema = z.object({
  criterion_id: z.string(),
  criterion_name: z.string(),
  level: z.enum(["A", "AA", "AAA"]),
  status: z.enum(["pass", "fail", "partial", "not_applicable", "uncertain"]),
  confidence: z.number().min(0).max(1),
  issues: z.array(CriterionIssueSchema),
});

export const VisionAnalysisOutputSchema = z.object({
  page_id: z.string(),
  url: z.string().url(),
  timestamp: z.string(),
  model_version: z.string(),
  latency_ms: z.number(),
  overall_score: z.number().min(0).max(100),
  criteria_status: z.array(CriterionStatusSchema),
  requires_human_review: z.boolean(),
  human_review_reasons: z.array(z.string()),
});
