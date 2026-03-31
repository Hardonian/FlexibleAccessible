-- CreateEnum
CREATE TYPE "FindingSourceType" AS ENUM ('CRAWL', 'SCAN', 'REPO', 'PR', 'RUNTIME', 'MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "FindingTargetKind" AS ENUM ('URL', 'PAGE', 'FLOW', 'COMPONENT', 'SELECTOR', 'FILE', 'DESIGN_NODE');

-- CreateEnum
CREATE TYPE "FindingTruthStatus" AS ENUM ('OPEN', 'FIXED_PENDING_VERIFICATION', 'VERIFIED_FIXED', 'WAIVED', 'SUPPRESSED', 'INCONCLUSIVE', 'STALE', 'ERRORED');

-- CreateEnum
CREATE TYPE "RuleEvaluationKind" AS ENUM ('DETERMINISTIC', 'HEURISTIC', 'MODEL_ASSISTED');

-- CreateEnum
CREATE TYPE "RecipeReviewLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('SCREENSHOT', 'HTML_SNAPSHOT', 'DOM_SNIPPET', 'SELECTOR_TRACE', 'RULE_EVALUATION', 'PAGE_METADATA', 'VERIFICATION_RESULT', 'ERROR_CONTEXT', 'REMEDIATION_PROPOSAL', 'REVIEWER_NOTE', 'GOVERNANCE_NOTE');

-- CreateEnum
CREATE TYPE "EvidenceLifecycleStatus" AS ENUM ('READY', 'MISSING', 'FAILED');

-- CreateEnum
CREATE TYPE "VerificationKind" AS ENUM ('SCAN_RECHECK', 'DOM_ASSERTION', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'RUNNING', 'PASSED', 'FAILED', 'INCONCLUSIVE', 'ERRORED');

-- CreateEnum
CREATE TYPE "GovernanceDecisionKind" AS ENUM ('WAIVER', 'SUPPRESSION', 'OVERRIDE');

-- CreateEnum
CREATE TYPE "GovernanceDecisionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED');

-- AlterTable
ALTER TABLE "canonical_findings"
ADD COLUMN     "sourceType" "FindingSourceType" NOT NULL DEFAULT 'SCAN',
ADD COLUMN     "targetKind" "FindingTargetKind" NOT NULL DEFAULT 'SELECTOR',
ADD COLUMN     "targetLocator" JSONB,
ADD COLUMN     "normalizedRuleKey" TEXT,
ADD COLUMN     "ruleVersion" TEXT,
ADD COLUMN     "evaluationKind" "RuleEvaluationKind" NOT NULL DEFAULT 'DETERMINISTIC',
ADD COLUMN     "wcagVersion" TEXT,
ADD COLUMN     "wcagCriteria" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
ADD COLUMN     "truthStatus" "FindingTruthStatus" NOT NULL DEFAULT 'OPEN',
ADD COLUMN     "provenance" JSONB,
ADD COLUMN     "evidenceSummary" JSONB;

-- AlterTable
ALTER TABLE "remediation_suggestions"
ADD COLUMN     "recipeId" TEXT;

-- CreateTable
CREATE TABLE "remediation_recipes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "ruleId" TEXT NOT NULL,
    "defectClass" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "applicableTargets" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "frameworks" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "strategy" TEXT NOT NULL,
    "guidance" TEXT NOT NULL,
    "verificationSteps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "riskNotes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "requiredReviewLevel" "RecipeReviewLevel" NOT NULL DEFAULT 'MEDIUM',
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "rejectionCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remediation_recipes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finding_verification_runs" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "canonicalFindingId" TEXT NOT NULL,
    "scanRunId" TEXT,
    "remediationSuggestionId" TEXT,
    "kind" "VerificationKind" NOT NULL DEFAULT 'SCAN_RECHECK',
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "triggeredById" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "outcomeSummary" TEXT,
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finding_verification_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finding_governance_decisions" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "canonicalFindingId" TEXT NOT NULL,
    "kind" "GovernanceDecisionKind" NOT NULL,
    "status" "GovernanceDecisionStatus" NOT NULL DEFAULT 'ACTIVE',
    "rationale" TEXT NOT NULL,
    "justification" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "revokedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finding_governance_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finding_evidence" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "canonicalFindingId" TEXT,
    "scanRunId" TEXT,
    "pageId" TEXT,
    "remediationSuggestionId" TEXT,
    "verificationRunId" TEXT,
    "governanceDecisionId" TEXT,
    "reviewTaskId" TEXT,
    "kind" "EvidenceKind" NOT NULL,
    "lifecycleStatus" "EvidenceLifecycleStatus" NOT NULL DEFAULT 'READY',
    "label" TEXT NOT NULL,
    "summary" TEXT,
    "storageKey" TEXT,
    "mimeType" TEXT,
    "textValue" TEXT,
    "jsonValue" JSONB,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finding_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "canonical_findings_truthStatus_idx" ON "canonical_findings"("truthStatus");

-- CreateIndex
CREATE INDEX "canonical_findings_sourceType_idx" ON "canonical_findings"("sourceType");

-- CreateIndex
CREATE UNIQUE INDEX "remediation_recipes_organizationId_ruleId_defectClass_key" ON "remediation_recipes"("organizationId", "ruleId", "defectClass");

-- CreateIndex
CREATE INDEX "remediation_recipes_organizationId_idx" ON "remediation_recipes"("organizationId");

-- CreateIndex
CREATE INDEX "remediation_recipes_ruleId_idx" ON "remediation_recipes"("ruleId");

-- CreateIndex
CREATE INDEX "finding_verification_runs_siteId_idx" ON "finding_verification_runs"("siteId");

-- CreateIndex
CREATE INDEX "finding_verification_runs_canonicalFindingId_idx" ON "finding_verification_runs"("canonicalFindingId");

-- CreateIndex
CREATE INDEX "finding_verification_runs_scanRunId_idx" ON "finding_verification_runs"("scanRunId");

-- CreateIndex
CREATE INDEX "finding_verification_runs_status_idx" ON "finding_verification_runs"("status");

-- CreateIndex
CREATE INDEX "finding_governance_decisions_siteId_idx" ON "finding_governance_decisions"("siteId");

-- CreateIndex
CREATE INDEX "finding_governance_decisions_canonicalFindingId_idx" ON "finding_governance_decisions"("canonicalFindingId");

-- CreateIndex
CREATE INDEX "finding_governance_decisions_status_idx" ON "finding_governance_decisions"("status");

-- CreateIndex
CREATE INDEX "finding_governance_decisions_expiresAt_idx" ON "finding_governance_decisions"("expiresAt");

-- CreateIndex
CREATE INDEX "finding_evidence_siteId_idx" ON "finding_evidence"("siteId");

-- CreateIndex
CREATE INDEX "finding_evidence_canonicalFindingId_idx" ON "finding_evidence"("canonicalFindingId");

-- CreateIndex
CREATE INDEX "finding_evidence_scanRunId_idx" ON "finding_evidence"("scanRunId");

-- CreateIndex
CREATE INDEX "finding_evidence_pageId_idx" ON "finding_evidence"("pageId");

-- CreateIndex
CREATE INDEX "finding_evidence_verificationRunId_idx" ON "finding_evidence"("verificationRunId");

-- CreateIndex
CREATE INDEX "finding_evidence_governanceDecisionId_idx" ON "finding_evidence"("governanceDecisionId");

-- CreateIndex
CREATE INDEX "finding_evidence_kind_idx" ON "finding_evidence"("kind");

-- AddForeignKey
ALTER TABLE "remediation_recipes" ADD CONSTRAINT "remediation_recipes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remediation_suggestions" ADD CONSTRAINT "remediation_suggestions_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "remediation_recipes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_verification_runs" ADD CONSTRAINT "finding_verification_runs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_verification_runs" ADD CONSTRAINT "finding_verification_runs_canonicalFindingId_fkey" FOREIGN KEY ("canonicalFindingId") REFERENCES "canonical_findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_verification_runs" ADD CONSTRAINT "finding_verification_runs_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "scan_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_verification_runs" ADD CONSTRAINT "finding_verification_runs_remediationSuggestionId_fkey" FOREIGN KEY ("remediationSuggestionId") REFERENCES "remediation_suggestions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_verification_runs" ADD CONSTRAINT "finding_verification_runs_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_governance_decisions" ADD CONSTRAINT "finding_governance_decisions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_governance_decisions" ADD CONSTRAINT "finding_governance_decisions_canonicalFindingId_fkey" FOREIGN KEY ("canonicalFindingId") REFERENCES "canonical_findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_governance_decisions" ADD CONSTRAINT "finding_governance_decisions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_governance_decisions" ADD CONSTRAINT "finding_governance_decisions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_governance_decisions" ADD CONSTRAINT "finding_governance_decisions_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_evidence" ADD CONSTRAINT "finding_evidence_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_evidence" ADD CONSTRAINT "finding_evidence_canonicalFindingId_fkey" FOREIGN KEY ("canonicalFindingId") REFERENCES "canonical_findings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_evidence" ADD CONSTRAINT "finding_evidence_scanRunId_fkey" FOREIGN KEY ("scanRunId") REFERENCES "scan_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_evidence" ADD CONSTRAINT "finding_evidence_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_evidence" ADD CONSTRAINT "finding_evidence_remediationSuggestionId_fkey" FOREIGN KEY ("remediationSuggestionId") REFERENCES "remediation_suggestions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_evidence" ADD CONSTRAINT "finding_evidence_verificationRunId_fkey" FOREIGN KEY ("verificationRunId") REFERENCES "finding_verification_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_evidence" ADD CONSTRAINT "finding_evidence_governanceDecisionId_fkey" FOREIGN KEY ("governanceDecisionId") REFERENCES "finding_governance_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finding_evidence" ADD CONSTRAINT "finding_evidence_reviewTaskId_fkey" FOREIGN KEY ("reviewTaskId") REFERENCES "review_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
