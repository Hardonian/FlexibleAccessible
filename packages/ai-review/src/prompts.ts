import type { CriterionStatus } from "./types.js";

/**
 * WCAG 2.2 criteria that can be assessed via visual analysis.
 * Each entry includes the prompt segment for the vision model.
 */
export const VISUAL_WCAG_CRITERIA = [
  {
    id: "1.4.3",
    name: "Contrast (Minimum)",
    level: "AA",
    prompt:
      "Check text contrast ratios. Light text on light backgrounds or dark text on dark backgrounds may fail the 4.5:1 minimum (3:1 for large text).",
  },
  {
    id: "1.4.11",
    name: "Non-text Contrast",
    level: "AA",
    prompt:
      "Check UI component boundaries (buttons, inputs, icons) for sufficient contrast against their background (minimum 3:1).",
  },
  {
    id: "2.4.7",
    name: "Focus Visible",
    level: "AA",
    prompt:
      "Check if interactive elements would have visible focus indicators. Look for outline:none without replacement, or custom styles that might hide focus.",
  },
  {
    id: "1.4.12",
    name: "Text Spacing",
    level: "AA",
    prompt:
      "Assess if the layout would break if line-height is set to 1.5x, letter-spacing to 0.12em, word-spacing to 0.16em, and paragraph spacing to 2x font size.",
  },
  {
    id: "1.4.10",
    name: "Reflow",
    level: "AA",
    prompt:
      "Assess if content would reflow properly at 400% zoom (320px equivalent width). Look for horizontal overflow risks.",
  },
  {
    id: "1.4.13",
    name: "Content on Hover or Focus",
    level: "AA",
    prompt:
      "Identify elements that might show tooltips, dropdowns, or popups on hover. Check if such content would be dismissible, hoverable, and persistent.",
  },
  {
    id: "2.5.3",
    name: "Label in Name",
    level: "A",
    prompt:
      "Check if visible text labels on buttons and links match what would be the accessible name. Icons with visible labels should have the label as part of their accessible name.",
  },
  {
    id: "1.4.1",
    name: "Use of Color",
    level: "A",
    prompt:
      "Check if color is the sole means of conveying information (e.g., red for error, green for success) without additional visual indicators.",
  },
  {
    id: "1.3.3",
    name: "Sensory Characteristics",
    level: "A",
    prompt:
      "Check if instructions rely on shape, size, visual location, orientation, or sound (e.g., 'click the round button', 'see the menu on the right').",
  },
  {
    id: "3.2.3",
    name: "Consistent Navigation",
    level: "AA",
    prompt:
      "Check if navigation elements appear in a consistent location and order relative to other pages on the site.",
  },
  {
    id: "3.3.1",
    name: "Error Identification",
    level: "A",
    prompt:
      "Check form elements for clear error indication. Are error messages visible, specific, and associated with the relevant field?",
  },
  {
    id: "4.1.2",
    name: "Name, Role, Value",
    level: "A",
    prompt:
      "Check custom UI components (sliders, tabs, accordions) for proper ARIA roles and states that would convey their purpose to assistive technology.",
  },
];

export const JSON_SCHEMA = `{
  "page_id": "string",
  "url": "string",
  "timestamp": "ISO 8601 string",
  "model_version": "string",
  "latency_ms": "number",
  "overall_score": "number (0-100)",
  "criteria_status": [
    {
      "criterion_id": "string (e.g. '1.4.3')",
      "criterion_name": "string",
      "level": "string ('A' or 'AA')",
      "status": "string ('pass' | 'fail' | 'partial' | 'not_applicable' | 'uncertain')",
      "confidence": "number (0.0-1.0)",
      "issues": [
        {
          "description": "string",
          "severity": "string ('critical' | 'serious' | 'moderate' | 'minor')",
          "selector": "string (best-guess CSS selector)",
          "element_description": "string (human-readable)",
          "suggested_fix": "string",
          "evidence": "string (what was observed)"
        }
      ]
    }
  ],
  "requires_human_review": "boolean",
  "human_review_reasons": ["string"]
}`;

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
    input.axeViolations.length > 0
      ? input.axeViolations
          .map(
            (v) =>
              `- [${v.impact.toUpperCase()}] ${v.ruleId}: ${v.description} at ${v.selector}`,
          )
          .join("\n")
      : "- No automated violations detected";

  const criteriaList = VISUAL_WCAG_CRITERIA.map(
    (c) => `${c.id} ${c.name}: ${c.prompt}`,
  ).join("\n");

  return `You are an expert web accessibility auditor analyzing a screenshot of a web page.

## Page Context
- URL: ${input.url}
- Title: ${input.pageTitle}

## Known Automated Findings (from axe-core)
${axeList}

## Accessibility Tree Summary
${input.accessibilityTreeSummary.slice(0, 2000)}

## Task
Analyze the screenshot for WCAG 2.2 Level AA violations that automated tools CANNOT detect. Evaluate each criterion below:

${criteriaList}

## Rules
1. Only report issues you can EVIDENCE from the screenshot. Do not speculate.
2. Set "uncertain" status when a static screenshot cannot confirm pass/fail (e.g., focus visible requires interaction).
3. Set confidence based on how certain you are from the visual evidence alone.
4. Compute overall_score as: 100 - (sum of severity weights across failed criteria). Weights: critical=15, serious=10, moderate=5, minor=2.
5. Set requires_human_review=true if any criterion has confidence < 0.7 or status is "uncertain".

Return ONLY valid JSON (no markdown fences, no explanation before or after):
${JSON_SCHEMA}`;
}

/**
 * Build a simplified retry prompt when initial parse fails.
 */
export function buildRetryPrompt(input: {
  url: string;
  pageTitle: string;
}): string {
  return `Analyze this screenshot for the TOP 3 most visible accessibility issues.

Page: ${input.url} (${input.pageTitle})

Return ONLY this JSON (no markdown):
{
  "page_id": "unknown",
  "url": "${input.url}",
  "timestamp": "${new Date().toISOString()}",
  "model_version": "retry",
  "latency_ms": 0,
  "overall_score": 50,
  "criteria_status": [
    {
      "criterion_id": "1.4.3",
      "criterion_name": "Contrast (Minimum)",
      "level": "AA",
      "status": "uncertain",
      "confidence": 0.5,
      "issues": []
    }
  ],
  "requires_human_review": true,
  "human_review_reasons": ["Initial analysis failed, retry with simplified prompt"]
}`;
}

/**
 * Compute an overall score from criteria statuses.
 */
export function computeOverallScore(criteriaStatus: CriterionStatus[]): number {
  let deductions = 0;

  for (const criteria of criteriaStatus) {
    if (criteria.status !== "fail" && criteria.status !== "partial") continue;

    const weight = criteria.issues.some((i) => i.severity === "critical")
      ? 15
      : criteria.issues.some((i) => i.severity === "serious")
        ? 10
        : criteria.issues.some((i) => i.severity === "moderate")
          ? 5
          : 2;

    deductions += weight * criteria.confidence;
  }

  return Math.max(0, Math.round(100 - deductions));
}
