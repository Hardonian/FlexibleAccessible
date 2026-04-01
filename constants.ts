/**
 * This file contains constants used throughout the AI review package
 * to ensure consistency and avoid magic strings/numbers.
 */

// Models and API configuration
export const LATEST_GEMINI_MODEL = "gemini-1.5-pro-latest";
export const JSON_RESPONSE_MIME_TYPE = "application/json";
export const PNG_MIME_TYPE = "image/png";

// Error messages and states
export const ERROR_MODEL_VERSION = "error";
export const UNKNOWN_PAGE_ID = "unknown";
export const AI_FAILURE_MESSAGE = "The AI model failed to generate a review.";
export const AI_BLOCK_MESSAGE_PREFIX = "AI response was blocked. Reason: ";
export const UNKNOWN_REASON = "Unknown";

// Retry prompt values
export const RETRY_MODEL_VERSION = "retry";
export const RETRY_PROMPT_MESSAGE =
  "Initial analysis failed, retry with simplified prompt";

// Scoring weights for client-side calculation
export const SEVERITY_WEIGHTS = {
  critical: 15,
  serious: 10,
  moderate: 5,
  minor: 2,
};

// Vision prompt sections
export const VISION_PROMPT_SECTIONS = {
  ROLE: "You are an expert web accessibility auditor analyzing a screenshot of a web page.",
  CONTEXT_HEADER: "## Page Context",
  AXE_HEADER: "## Known Automated Findings (from axe-core)",
  NO_AXE_VIOLATIONS: "- No automated violations detected",
  A11Y_TREE_HEADER: "## Accessibility Tree Summary",
  TASK_HEADER: "## Task",
  TASK_INSTRUCTION:
    "Analyze the screenshot for WCAG 2.2 Level AA violations that automated tools CANNOT detect. Evaluate each criterion below:",
  RULES_HEADER: "## Rules",
  RULES_LIST: [
    "Only report issues you can EVIDENCE from the screenshot. Do not speculate.",
    'Set "uncertain" status when a static screenshot cannot confirm pass/fail (e.g., focus visible requires interaction).',
    "Set confidence based on how certain you are from the visual evidence alone.",
    "Compute overall_score as: 100 - (sum of severity weights across failed criteria). Weights: critical=15, serious=10, moderate=5, minor=2.",
    'Set requires_human_review=true if any criterion has confidence < 0.7 or status is "uncertain".',
  ].join("\n"),
};

// Retry prompt sections
export const RETRY_PROMPT_SECTIONS = {
  INSTRUCTION:
    "Analyze this screenshot for the TOP 3 most visible accessibility issues.",
  JSON_INSTRUCTION: "Return ONLY this JSON (no markdown):",
};