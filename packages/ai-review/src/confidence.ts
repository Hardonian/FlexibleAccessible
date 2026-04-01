import type { ReviewFinding, CriterionStatus } from "./types.js";
import {
  CONFIDENCE_AUTO_CREATE,
  CONFIDENCE_REVIEW_REQUIRED,
  CONFIDENCE_MINIMUM,
} from "./types.js";

export type ConfidenceAction =
  | "auto_create"
  | "review_required"
  | "evidence_only"
  | "discard";

export interface ScoredFinding extends ReviewFinding {
  action: ConfidenceAction;
}

/**
 * Determine the action to take based on confidence score.
 */
export function classifyConfidence(confidence: number): ConfidenceAction {
  if (confidence >= CONFIDENCE_AUTO_CREATE) return "auto_create";
  if (confidence >= CONFIDENCE_REVIEW_REQUIRED) return "review_required";
  if (confidence >= CONFIDENCE_MINIMUM) return "evidence_only";
  return "discard";
}

/**
 * Score and classify findings from vision analysis.
 */
export function scoreFindings(
  criteriaStatus: CriterionStatus[],
): ScoredFinding[] {
  const findings: ScoredFinding[] = [];

  for (const criteria of criteriaStatus) {
    if (criteria.status === "pass" || criteria.status === "not_applicable")
      continue;

    for (const issue of criteria.issues) {
      const action = classifyConfidence(criteria.confidence);

      if (action === "discard") continue;

      findings.push({
        criterionId: criteria.criterion_id,
        criterionName: criteria.criterion_name,
        level: criteria.level,
        status: criteria.status,
        confidence: criteria.confidence,
        severity: issue.severity,
        description: issue.description,
        selector: issue.selector,
        suggestedFix: issue.suggested_fix,
        source: "vision",
        action,
      });
    }
  }

  // Sort by confidence descending (highest confidence first)
  findings.sort((a, b) => b.confidence - a.confidence);

  return findings;
}

/**
 * Determine if human review is required based on findings.
 */
export function requiresHumanReview(criteriaStatus: CriterionStatus[]): {
  required: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  const uncertainCriteria = criteriaStatus.filter(
    (c) => c.status === "uncertain",
  );
  if (uncertainCriteria.length > 0) {
    reasons.push(
      `${uncertainCriteria.length} criteria cannot be confirmed from static screenshot: ${uncertainCriteria.map((c) => c.criterion_id).join(", ")}`,
    );
  }

  const lowConfidence = criteriaStatus.filter(
    (c) => c.confidence < CONFIDENCE_REVIEW_REQUIRED && c.status !== "pass",
  );
  if (lowConfidence.length > 0) {
    reasons.push(
      `${lowConfidence.length} criteria have confidence below ${CONFIDENCE_REVIEW_REQUIRED}`,
    );
  }

  return { required: reasons.length > 0, reasons };
}

/**
 * Aggregate statistics from scored findings.
 */
export function aggregateStats(findings: ScoredFinding[]): {
  total: number;
  autoCreate: number;
  reviewRequired: number;
  evidenceOnly: number;
  bySeverity: Record<string, number>;
  bySource: Record<string, number>;
} {
  const bySeverity: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  let autoCreate = 0;
  let reviewRequired = 0;
  let evidenceOnly = 0;

  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    bySource[f.source] = (bySource[f.source] ?? 0) + 1;
    if (f.action === "auto_create") autoCreate++;
    else if (f.action === "review_required") reviewRequired++;
    else evidenceOnly++;
  }

  return {
    total: findings.length,
    autoCreate,
    reviewRequired,
    evidenceOnly,
    bySeverity,
    bySource,
  };
}
