import type { FindingTruthStatus, Severity } from "@aros/db";

const SEVERITY_RANK: Record<Severity, number> = {
  CRITICAL: 0,
  SERIOUS: 1,
  MODERATE: 2,
  MINOR: 3,
};

/** Deterministic triage score (lower = address first). Evidence-backed reasons only. */
export function scoreFindingPriority(input: {
  impact: Severity;
  truthStatus: FindingTruthStatus;
  distinctScanRunsObserved: number;
  occurrenceCount: number;
  reopenedCount: number;
}): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = SEVERITY_RANK[input.impact] * 1000;

  if (input.truthStatus === "OPEN" || input.truthStatus === "INCONCLUSIVE") {
    reasons.push("Truth status still open or inconclusive for automated verification.");
    score -= 80;
  }

  if (input.reopenedCount > 0) {
    reasons.push(
      `Regressed after closure ${input.reopenedCount} time(s) (workflow reopened on re-detection).`,
    );
    score -= 60;
  }

  if (input.distinctScanRunsObserved > 1) {
    reasons.push(
      `Seen across ${input.distinctScanRunsObserved} completed scan runs (stable fingerprint).`,
    );
    score -= Math.min(50, 10 * input.distinctScanRunsObserved);
  }

  if (input.occurrenceCount > 1) {
    reasons.push(
      `High observation volume: ${input.occurrenceCount} automated observations recorded.`,
    );
    score -= Math.min(40, 5 * Math.min(input.occurrenceCount, 8));
  }

  return { score, reasons };
}
