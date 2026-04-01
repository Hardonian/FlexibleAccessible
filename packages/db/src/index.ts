import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export { PrismaClient };
export * from "@prisma/client";

// Explicitly export enums that may not be included in wildcard export
export type {
  MemberRole,
  Severity,
  EvidenceSource,
  FindingSourceType,
  FindingTargetKind,
  FindingStatus,
  FindingTruthStatus,
  RuleEvaluationKind,
  SuggestionType,
  SuggestionStatus,
  RecipeReviewLevel,
  ReviewType,
  ReviewStatus,
  EvidenceKind,
  EvidenceLifecycleStatus,
  VerificationKind,
  VerificationStatus,
  GovernanceDecisionKind,
  GovernanceDecisionStatus,
  IntegrationType,
  PlanTier,
  SubscriptionStatus,
  CrawlStatus,
  PostCrawlScanKickoffStatus,
  ScanEnqueueFailureCode,
  ScanStatus,
  SiteEnvironment,
  PublicScanStatus,
  CreditTransactionType,
  WebhookSource,
  VisualReviewStatus,
} from "@prisma/client";
