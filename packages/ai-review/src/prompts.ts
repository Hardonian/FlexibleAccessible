import {
  ERROR_MODEL_VERSION,
  RETRY_MODEL_VERSION,
  RETRY_PROMPT_MESSAGE,
  RETRY_PROMPT_SECTIONS,
  UNKNOWN_PAGE_ID,
  VISION_PROMPT_SECTIONS,
} from "./constants.js";
import { VISUAL_WCAG_CRITERIA } from "./criteria.js";
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
): VisionAnalysisOutput {
  return {
    page_id: UNKNOWN_PAGE_ID,
    url: input.url,
    timestamp: new Date().toISOString(),
    model_version: ERROR_MODEL_VERSION,
    latency_ms: 0,
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
    impact: string;
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
${(input.accessibilityTreeSummary || "").slice(0, 2000)}

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
