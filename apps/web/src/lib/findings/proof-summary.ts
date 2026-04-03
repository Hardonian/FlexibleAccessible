type JsonRecord = Record<string, unknown>;

export interface FindingProofSummary {
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
  changedSinceLastRun: "newly_detected" | "regressed" | "persistent" | "unknown";
}

function asRecord(value: unknown): JsonRecord | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function buildFindingProofSummary(input: {
  evidenceSummary: unknown;
  provenance: unknown;
  firstSeenAt: Date;
  lastSeenAt: Date;
  reopenedCount: number;
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

  let changedSinceLastRun: FindingProofSummary["changedSinceLastRun"] = "unknown";
  if (input.reopenedCount > 0) {
    changedSinceLastRun = "regressed";
  } else if (input.firstSeenAt.getTime() === input.lastSeenAt.getTime()) {
    changedSinceLastRun = "newly_detected";
  } else if (input.lastSeenAt.getTime() > input.firstSeenAt.getTime()) {
    changedSinceLastRun = "persistent";
  }

  return {
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
