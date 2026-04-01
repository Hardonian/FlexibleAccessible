import { VISUAL_WCAG_CRITERIA } from "./criteria.js";

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
              `- [${(v.impact || "unknown").toUpperCase()}] ${v.ruleId}: ${v.description} at ${v.selector}`,
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
${(input.accessibilityTreeSummary || "").slice(0, 2000)}

## Task
Analyze the screenshot for WCAG 2.2 Level AA violations that automated tools CANNOT detect. Evaluate each criterion below:

${criteriaList}

## Rules
1. Only report issues you can EVIDENCE from the screenshot. Do not speculate.
2. Set "uncertain" status when a static screenshot cannot confirm pass/fail (e.g., focus visible requires interaction).
3. Set confidence based on how certain you are from the visual evidence alone.
4. Compute overall_score as: 100 - (sum of severity weights across failed criteria). Weights: critical=15, serious=10, moderate=5, minor=2.
5. Set requires_human_review=true if any criterion has confidence < 0.7 or status is "uncertain".

Your output must conform to the provided JSON schema.`;
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
  "url": ${JSON.stringify(input.url)},
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
  if (!criteriaStatus || !Array.isArray(criteriaStatus)) return 100;

  let deductions = 0;

  for (const criteria of criteriaStatus) {
    if (criteria.status !== "fail" && criteria.status !== "partial") continue;

    const issues = criteria.issues || [];
    const weight = issues.some((i) => i.severity === "critical")
      ? 15
      : issues.some((i) => i.severity === "serious")
        ? 10
        : issues.some((i) => i.severity === "moderate")
          ? 5
          : 2;

    deductions += weight * (criteria.confidence ?? 1);
  }

  return Math.max(0, Math.round(100 - deductions));
}
