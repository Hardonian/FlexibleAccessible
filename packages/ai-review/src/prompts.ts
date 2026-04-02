import {
  ERROR_MODEL_VERSION,
  RETRY_MODEL_VERSION,
  A11Y_TREE_MAX_SUMMARY_LENGTH,
  RETRY_PROMPT_MESSAGE,
  RETRY_PROMPT_SECTIONS,
  UNKNOWN_PAGE_ID,
  VISION_PROMPT_SECTIONS,
} from "./constants.js";
import { VISUAL_WCAG_CRITERIA } from "./criteria.js";
export { VISUAL_WCAG_CRITERIA };
import type {
  CriterionStatus,
  VisionAnalysisInput,
  VisionAnalysisOutput,
} from "./types.js";

/**
 * Creates a structured error response when the AI model fails.
 * This prevents the entire pipeline from crashing.
 * @param input The original input to the analysis function.
 * @param reasons The reasons for the failure.
 * @returns A `VisionAnalysisOutput` object representing the failure.
 */
export function createErrorResponse(
  input: VisionAnalysisInput,
  reasons: string[],
  latency_ms: number = 0,
): VisionAnalysisOutput {
  return {
    page_id: UNKNOWN_PAGE_ID,
    url: input.url,
    timestamp: new Date().toISOString(),
    model_version: ERROR_MODEL_VERSION,
    latency_ms,
    overall_score: 0,
    criteria_status: [],
    requires_human_review: true,
    human_review_reasons: reasons,
  };
}

/**
 * Build the vision analysis prompt from input data.
 */
export function buildVisionPrompt(input: {
  url: string;
  pageTitle: string;
  axeViolations: Array<{
    ruleId: string;
    impact: string | null;
    selector: string;
    description: string;
  }>;
  accessibilityTreeSummary: string;
}): string {
  const axeList =
    input.axeViolations?.length > 0
      ? input.axeViolations
          .map(
            (v) =>
              `- [${(v.impact || "unknown").toUpperCase()}] ${v.ruleId}: ${
                v.description
              } at ${v.selector}`,
          )
          .join("\n")
      : VISION_PROMPT_SECTIONS.NO_AXE_VIOLATIONS;

  const criteriaList = VISUAL_WCAG_CRITERIA.map(
    (c) => `${c.id} ${c.name}: ${c.prompt}`,
  ).join("\n");

  return `${VISION_PROMPT_SECTIONS.ROLE}

${VISION_PROMPT_SECTIONS.CONTEXT_HEADER}
- URL: ${input.url}
- Title: ${input.pageTitle}

${VISION_PROMPT_SECTIONS.AXE_HEADER}
${axeList}

${VISION_PROMPT_SECTIONS.A11Y_TREE_HEADER}
${(input.accessibilityTreeSummary || "").slice(0, A11Y_TREE_MAX_SUMMARY_LENGTH)}

${VISION_PROMPT_SECTIONS.TASK_HEADER}
${VISION_PROMPT_SECTIONS.TASK_INSTRUCTION}

${criteriaList}

${VISION_PROMPT_SECTIONS.RULES_HEADER}
${VISION_PROMPT_SECTIONS.RULES_LIST}

Your output must conform to the provided JSON schema.`;
}

/**
 * Build a simplified retry response when initial parse fails.
 */
export function createRetryResponse(
  input: VisionAnalysisInput,
): VisionAnalysisOutput {
  return {
    page_id: UNKNOWN_PAGE_ID,
    url: input.url,
    timestamp: new Date().toISOString(),
    model_version: RETRY_MODEL_VERSION,
    latency_ms: 0,
    overall_score: 50,
    criteria_status: [
      {
        criterion_id: "1.4.3",
        criterion_name: "Contrast (Minimum)",
        level: "AA",
        status: "uncertain",
        confidence: 0.5,
        issues: [],
      },
    ],
    requires_human_review: true,
    human_review_reasons: [RETRY_PROMPT_MESSAGE],
  };
}

/**
 * Build a simplified retry prompt for when initial parsing fails.
 */
export function buildRetryPrompt(input: {
  url: string;
  pageTitle: string;
}): string {
  return `${VISION_PROMPT_SECTIONS.ROLE}

${VISION_PROMPT_SECTIONS.CONTEXT_HEADER}
- URL: ${input.url}
- Title: ${input.pageTitle}

${VISION_PROMPT_SECTIONS.TASK_HEADER}
Provide a SIMPLIFIED response with only the TOP 3 most critical accessibility issues.
Format your response as JSON with:
- overall_score (0-100)
- criteria_status: array with 3 most important criteria
- requires_human_review: true
- human_review_reasons: ["Retry prompt used"]

Be concise. Focus on the top 3 issues only.`;
}

/**
 * Compute an overall accessibility score from criterion statuses.
 * Returns a score from 0-100.
 */
export function computeOverallScore(criteria: CriterionStatus[]): number {
  if (criteria.length === 0) return 100;

  let totalDeduction = 0;
  const SEVERITY_WEIGHTS: Record<string, number> = {
    critical: 20,
    serious: 15,
    moderate: 10,
    minor: 5,
  };

  for (const criterion of criteria) {
    if (criterion.status === "pass" || criterion.status === "not_applicable") {
      continue;
    }

    if (criterion.status === "fail") {
      const issueCount = criterion.issues.length;
      for (const issue of criterion.issues) {
        const weight = SEVERITY_WEIGHTS[issue.severity] || 10;
        const confidenceFactor = criterion.confidence;
        totalDeduction += weight * confidenceFactor * Math.min(issueCount, 3);
      }
    } else if (criterion.status === "uncertain") {
      totalDeduction += 5 * criterion.confidence;
    }
  }

  return Math.max(0, Math.min(100, Math.round(100 - totalDeduction)));
}
