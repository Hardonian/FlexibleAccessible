export const ERROR_MODEL_VERSION = "error";
export const RETRY_MODEL_VERSION = "retry-v1";
export const UNKNOWN_PAGE_ID = "unknown";

export const A11Y_TREE_MAX_SUMMARY_LENGTH = 2000;

export const VISION_TIMEOUT_MS = 30_000;

export const AI_FAILURE_MESSAGE = "The AI model failed to generate a review.";
export const AI_BLOCK_MESSAGE_PREFIX = "AI response was blocked. Reason: ";
export const UNKNOWN_REASON = "Unknown";

export const PNG_MIME_TYPE = "image/png";
export const DEBUG_PROMPT_LENGTH = 500;

export const VISION_PROMPT_SECTIONS = {
  ROLE: `You are an expert web accessibility auditor specialized in WCAG 2.1 compliance.
Your task is to analyze screenshots and accessibility data to identify visual accessibility issues.`,
  CONTEXT_HEADER: "Page Context:",
  AXE_HEADER: "Automated Accessibility Test Results (axe-core):",
  A11Y_TREE_HEADER: "Accessibility Tree Summary:",
  NO_AXE_VIOLATIONS: "(No automated violations detected)",
  TASK_HEADER: "Your Task:",
  TASK_INSTRUCTION: `Analyze the provided screenshot and accessibility data.
Identify WCAG 2.1 visual accessibility violations including:
- Insufficient color contrast
- Missing or insufficient focus indicators
- Small or hard-to-click targets
- Text spacing issues
- Missing or improper use of landmarks
- Content readability problems`,
  RULES_HEADER: "WCAG Criteria to Evaluate:",
  RULES_LIST: `1.1.1 Non-text Content: Images have text alternatives
1.3.1 Info and Relationships: Structure is programmatically determinable
1.4.1 Use of Color: Color is not the only visual means of conveying information
1.4.3 Contrast (Minimum): Text has adequate contrast
1.4.4 Resize Text: Text can be resized without loss of functionality
2.1.1 Keyboard: All functionality available by keyboard
2.4.1 Bypass Blocks: Skip navigation is provided
2.4.3 Focus Order: Focus order is logical
2.4.7 Focus Visible: Keyboard focus is visible
3.2.1 On Focus: Components do not change on focus`,
};

export const RETRY_PROMPT_MESSAGE =
  "AI model failed to parse initial response. Marking all criteria as uncertain.";

export const RETRY_PROMPT_SECTIONS = {
  ...VISION_PROMPT_SECTIONS,
  TASK_INSTRUCTION: `Initial analysis failed to parse. Provide a simplified response with only:
- overall_score (0-100)
- criteria_status array with one entry per WCAG criterion
- requires_human_review: true
- human_review_reasons: ["Retry prompt used"]`,
};
