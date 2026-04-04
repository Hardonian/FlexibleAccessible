import { PUBLIC_SCAN_EVIDENCE_TTL_MS } from "@aros/config";
import { prisma } from "@/lib/db";

export type PublicEvidenceState =
  | "valid"
  | "expired"
  | "missing"
  | "incomplete"
  | "failed";

type PublicScanCore = {
  id: string;
  domain: string;
  status: string;
  score: number | null;
  totalViolations: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  pagesScanned: number;
  violations: unknown;
  screenshotKeys: unknown;
  createdAt: Date;
  completedAt: Date | null;
  expiresAt: Date | null;
};

export function getPublicScanEvidenceState(
  scan: Pick<PublicScanCore, "expiresAt" | "status" | "completedAt"> | null,
  now = new Date(),
): PublicEvidenceState {
  if (!scan) return "missing";
  if (scan.status === "FAILED") return "failed";
  if (scan.status !== "COMPLETED" || !scan.completedAt) return "incomplete";
  // Fail closed: completed rows must carry a future expiry to be treated as current public proof.
  if (!scan.expiresAt || scan.expiresAt <= now) return "expired";
  return "valid";
}

export function toPublicScanApiPayload(scan: PublicScanCore) {
  const evidenceState = getPublicScanEvidenceState(scan);
  return {
    id: scan.id,
    domain: scan.domain,
    status: scan.status,
    evidenceState,
    score: scan.score,
    totalViolations: scan.totalViolations,
    criticalCount: scan.criticalCount,
    seriousCount: scan.seriousCount,
    moderateCount: scan.moderateCount,
    minorCount: scan.minorCount,
    pagesScanned: scan.pagesScanned,
    violations: scan.violations,
    screenshotKeys: scan.screenshotKeys,
    createdAt: scan.createdAt,
    completedAt: scan.completedAt,
    expiresAt: scan.expiresAt,
    evidenceExpiresAt:
      evidenceState === "valid" && scan.expiresAt ? scan.expiresAt : null,
  };
}

export async function getPublicScanById(id: string): Promise<PublicScanCore | null> {
  return prisma.publicScanResult.findUnique({
    where: { id },
    select: {
      id: true,
      domain: true,
      status: true,
      score: true,
      totalViolations: true,
      criticalCount: true,
      seriousCount: true,
      moderateCount: true,
      minorCount: true,
      pagesScanned: true,
      violations: true,
      screenshotKeys: true,
      createdAt: true,
      completedAt: true,
      expiresAt: true,
    },
  });
}

export async function getLatestValidPublicScanForDomain(
  domain: string,
  options: { requireCompleted: boolean },
): Promise<PublicScanCore | null> {
  return prisma.publicScanResult.findFirst({
    where: {
      domain,
      // NULL expiresAt is never current evidence (legacy or inconsistent rows).
      expiresAt: { gt: new Date() },
      ...(options.requireCompleted
        ? {
            status: "COMPLETED",
            completedAt: { not: null },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      domain: true,
      status: true,
      score: true,
      totalViolations: true,
      criticalCount: true,
      seriousCount: true,
      moderateCount: true,
      minorCount: true,
      pagesScanned: true,
      violations: true,
      screenshotKeys: true,
      createdAt: true,
      completedAt: true,
      expiresAt: true,
    },
  });
}
