import type { EvidenceSource, FindingSourceType } from "@aros/db";

type JsonRecord = Record<string, unknown>;

export type FindingComparisonBasis =
  | "automated_fingerprint_per_site"
  | "not_comparable_non_automated_source"
  | "not_comparable_unknown_source";

export interface FindingProofSummary {
  comparisonBasis: FindingComparisonBasis;
  comparisonLimitations: string[];
  recurrence: {
    distinctScanRunsObserved: number;
    distinctScanRunsAbsentWhenOpen: number;
    isRecurringAcrossScanRuns: boolean;
  };
  completeness: {
    hasSummary: boolean;
    hasLatestObservationTimestamp: boolean;
    hasVerificationStatus: boolean;
    hasPageUrl: boolean;
    hasLineage: boolean;
  };
  lineage: {
    sourceType: string | null;
    scanRunId: string | null;
    rawViolationId: string | null;
    pageId: string | null;
    pageUrl: string | null;
  };
  latestVerificationStatus: string | null;
  latestObservationAt: string | null;
  /**
   * Lifecycle hint from stored timestamps, reopen count, verification status, and scan-run recurrence.
   * When comparisonBasis is not automated fingerprint, cross-run semantics are not_comparable.
   */
  changedSinceLastRun:
    | "newly_detected"
    | "regressed"
    | "persistent"
    | "improved_open_backlog"
    | "not_comparable"
    | "unknown";
}

function asRecord(value: unknown): JsonRecord | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function resolveComparisonBasis(input: {
  evidenceSource?: EvidenceSource | null;
  sourceType?: FindingSourceType | null;
}): { basis: FindingComparisonBasis; limitations: string[] } {
  if (input.evidenceSource == null && input.sourceType == null) {
    return {
      basis: "not_comparable_unknown_source",
      limitations: [
        "Evidence source is unknown; automated fingerprint cross-run comparison is not asserted.",
      ],
    };
  }

  if (
    input.evidenceSource === "AUTOMATED_AXE" &&
    input.sourceType === "SCAN"
  ) {
    return {
      basis: "automated_fingerprint_per_site",
      limitations: [
        "Identity is the per-site violation fingerprint from the scan engine; DOM changes can remap or split findings.",
        "Cross-run counts are distinct completed scan runs with stored verification rows, not page-level recurrence.",
      ],
    };
  }

  return {
    basis: "not_comparable_non_automated_source",
    limitations: [
      "Only automated scan findings use stable fingerprint identity across runs; this finding uses a different evidence or source path.",
    ],
  };
}

export function buildFindingProofSummary(input: {
  evidenceSummary: unknown;
  provenance: unknown;
  firstSeenAt: Date;
  lastSeenAt: Date;
  reopenedCount: number;
  distinctScanRunsObserved?: number;
  distinctScanRunsAbsentWhenOpen?: number;
  evidenceSource?: EvidenceSource | null;
  sourceType?: FindingSourceType | null;
}): FindingProofSummary {
  const evidenceSummary = asRecord(input.evidenceSummary);
  const provenance = asRecord(input.provenance);

  const latestObservationAt = asString(evidenceSummary?.latestObservationAt);
  const latestVerificationStatus = asString(
    evidenceSummary?.latestVerificationStatus,
  );
  const summaryPageUrl = asString(evidenceSummary?.pageUrl);

  const sourceType = asString(provenance?.sourceType);
  const scanRunId = asString(provenance?.scanRunId);
  const rawViolationId = asString(provenance?.rawViolationId);
  const pageId = asString(provenance?.pageId);
  const provenancePageUrl = asString(provenance?.pageUrl);

  const { basis: comparisonBasis, limitations: comparisonLimitations } =
    resolveComparisonBasis({
      evidenceSource: input.evidenceSource ?? null,
      sourceType: input.sourceType ?? null,
    });

  const distinctScanRunsObserved = Math.max(
    0,
    input.distinctScanRunsObserved ?? 0,
  );
  const distinctScanRunsAbsentWhenOpen = Math.max(
    0,
    input.distinctScanRunsAbsentWhenOpen ?? 0,
  );
  const isRecurringAcrossScanRuns = distinctScanRunsObserved > 1;

  let changedSinceLastRun: FindingProofSummary["changedSinceLastRun"] =
    "unknown";

  if (comparisonBasis !== "automated_fingerprint_per_site") {
    changedSinceLastRun = "not_comparable";
  } else if (input.reopenedCount > 0) {
    changedSinceLastRun = "regressed";
  } else if (
    latestVerificationStatus === "PASSED" &&
    distinctScanRunsAbsentWhenOpen > 0
  ) {
    changedSinceLastRun = "improved_open_backlog";
  } else if (input.firstSeenAt.getTime() === input.lastSeenAt.getTime()) {
    changedSinceLastRun = "newly_detected";
  } else if (input.lastSeenAt.getTime() > input.firstSeenAt.getTime()) {
    changedSinceLastRun = "persistent";
  }

  return {
    comparisonBasis,
    comparisonLimitations: comparisonLimitations,
    recurrence: {
      distinctScanRunsObserved,
      distinctScanRunsAbsentWhenOpen,
      isRecurringAcrossScanRuns,
    },
    completeness: {
      hasSummary: evidenceSummary != null,
      hasLatestObservationTimestamp: latestObservationAt != null,
      hasVerificationStatus: latestVerificationStatus != null,
      hasPageUrl: summaryPageUrl != null || provenancePageUrl != null,
      hasLineage:
        sourceType != null || scanRunId != null || rawViolationId != null,
    },
    lineage: {
      sourceType,
      scanRunId,
      rawViolationId,
      pageId,
      pageUrl: summaryPageUrl ?? provenancePageUrl,
    },
    latestVerificationStatus,
    latestObservationAt,
    changedSinceLastRun,
  };
}
