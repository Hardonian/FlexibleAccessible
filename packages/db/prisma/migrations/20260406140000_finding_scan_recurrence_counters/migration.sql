-- Durable recurrence signals: distinct scan runs where a finding was observed vs absent (automated scan scope).

ALTER TABLE "canonical_findings" ADD COLUMN "distinctScanRunsObserved" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "canonical_findings" ADD COLUMN "distinctScanRunsAbsentWhenOpen" INTEGER NOT NULL DEFAULT 0;

-- Backfill observed: distinct scan runs with SCAN_RECHECK FAILED (per-fingerprint observation path).
UPDATE "canonical_findings" cf
SET "distinctScanRunsObserved" = sub.cnt
FROM (
  SELECT "canonicalFindingId", COUNT(DISTINCT "scanRunId") AS cnt
  FROM "finding_verification_runs"
  WHERE
    "kind" = 'SCAN_RECHECK'
    AND "status" = 'FAILED'
    AND "scanRunId" IS NOT NULL
  GROUP BY "canonicalFindingId"
) sub
WHERE cf."id" = sub."canonicalFindingId"
  AND cf."evidenceSource" = 'AUTOMATED_AXE'
  AND cf."sourceType" = 'SCAN';

-- Backfill absent-while-open: finalize path marks reason fingerprint_absent_from_scan.
-- Uses current workflow status as a proxy for legacy rows (historical status-at-run is not stored).
UPDATE "canonical_findings" cf
SET "distinctScanRunsAbsentWhenOpen" = sub.cnt
FROM (
  SELECT v."canonicalFindingId", COUNT(DISTINCT v."scanRunId") AS cnt
  FROM "finding_verification_runs" v
  INNER JOIN "canonical_findings" f ON f."id" = v."canonicalFindingId"
  WHERE
    v."kind" = 'SCAN_RECHECK'
    AND v."status" = 'PASSED'
    AND v."scanRunId" IS NOT NULL
    AND v."metadata"->>'reason' = 'fingerprint_absent_from_scan'
    AND f."status" NOT IN ('RESOLVED', 'MITIGATED', 'FALSE_POSITIVE', 'WONT_FIX')
    AND f."evidenceSource" = 'AUTOMATED_AXE'
    AND f."sourceType" = 'SCAN'
  GROUP BY v."canonicalFindingId"
) sub
WHERE cf."id" = sub."canonicalFindingId";
