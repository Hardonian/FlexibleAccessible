-- Evidence source + scan linkage + occurrence uniqueness + FindingStatus enum refresh

ALTER TABLE "canonical_findings" ADD CONSTRAINT "canonical_findings_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "EvidenceSource" AS ENUM ('AUTOMATED_AXE', 'MANUAL_REVIEW', 'IMPORTED');

ALTER TABLE "canonical_findings" ADD COLUMN "evidenceSource" "EvidenceSource" NOT NULL DEFAULT 'AUTOMATED_AXE';
ALTER TABLE "canonical_findings" ADD COLUMN "lastScanRunId" TEXT;
ALTER TABLE "canonical_findings" ADD COLUMN "lastVerifiedAt" TIMESTAMP(3);
ALTER TABLE "canonical_findings" ADD COLUMN "statusChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "canonical_findings" ADD COLUMN "statusChangedById" TEXT;
ALTER TABLE "canonical_findings" ADD COLUMN "statusNote" TEXT;
ALTER TABLE "canonical_findings" ADD COLUMN "reopenedCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "canonical_findings" ADD CONSTRAINT "canonical_findings_statusChangedById_fkey" FOREIGN KEY ("statusChangedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "canonical_findings" ADD CONSTRAINT "canonical_findings_lastScanRunId_fkey" FOREIGN KEY ("lastScanRunId") REFERENCES "scan_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "canonical_findings_lastScanRunId_idx" ON "canonical_findings"("lastScanRunId");
CREATE INDEX "canonical_findings_evidenceSource_idx" ON "canonical_findings"("evidenceSource");

-- Replace FindingStatus enum (map FIXED -> RESOLVED)
CREATE TYPE "FindingStatus_new" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS', 'RESOLVED', 'MITIGATED', 'FALSE_POSITIVE', 'WONT_FIX');

ALTER TABLE "canonical_findings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "canonical_findings" ALTER COLUMN "status" TYPE "FindingStatus_new" USING (
  CASE "status"::text
    WHEN 'FIXED' THEN 'RESOLVED'::"FindingStatus_new"
    ELSE ("status"::text)::"FindingStatus_new"
  END
);
ALTER TABLE "canonical_findings" ALTER COLUMN "status" SET DEFAULT 'OPEN'::"FindingStatus_new";

DROP TYPE "FindingStatus";
ALTER TYPE "FindingStatus_new" RENAME TO "FindingStatus";

-- Occurrence: optional evidence pointer + stable uniqueness
ALTER TABLE "finding_occurrences" ADD COLUMN "lastRawViolationId" TEXT;

ALTER TABLE "finding_occurrences" ADD CONSTRAINT "finding_occurrences_lastRawViolationId_fkey" FOREIGN KEY ("lastRawViolationId") REFERENCES "raw_violations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Keep one row per (canonical finding, page); prefer latest lastSeenAt
DELETE FROM "finding_occurrences" a
USING "finding_occurrences" b
WHERE a."canonicalFindingId" = b."canonicalFindingId"
  AND a."pageId" = b."pageId"
  AND (
    a."lastSeenAt" < b."lastSeenAt"
    OR (a."lastSeenAt" = b."lastSeenAt" AND a."id" > b."id")
  );

CREATE UNIQUE INDEX "finding_occurrences_canonicalFindingId_pageId_key" ON "finding_occurrences"("canonicalFindingId", "pageId");

CREATE INDEX "finding_occurrences_lastRawViolationId_idx" ON "finding_occurrences"("lastRawViolationId");

-- Append-only remediation / status audit trail
CREATE TABLE "finding_status_events" (
    "id" TEXT NOT NULL,
    "canonicalFindingId" TEXT NOT NULL,
    "fromStatus" "FindingStatus",
    "toStatus" "FindingStatus" NOT NULL,
    "note" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finding_status_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "finding_status_events_canonicalFindingId_idx" ON "finding_status_events"("canonicalFindingId");
CREATE INDEX "finding_status_events_createdAt_idx" ON "finding_status_events"("createdAt");

ALTER TABLE "finding_status_events" ADD CONSTRAINT "finding_status_events_canonicalFindingId_fkey" FOREIGN KEY ("canonicalFindingId") REFERENCES "canonical_findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "finding_status_events" ADD CONSTRAINT "finding_status_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
