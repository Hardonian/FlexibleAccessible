import { hasPermission } from "@aros/config";
import type {
  FindingGovernanceDecision,
  FindingSourceType,
  FindingStatus,
  FindingTruthStatus,
  GovernanceDecisionKind,
  GovernanceDecisionStatus,
  MemberRole,
  Prisma,
  PrismaClient,
  VerificationStatus,
} from "@aros/db";
import { prisma } from "@aros/db";
import {
  shouldReopenOnAutomatedDetection,
  type FindingStatusValue,
} from "@aros/shared";
import type { NormalizedViolation } from "@aros/scan-engine";

type TxLike = PrismaClient | Prisma.TransactionClient;

type ActiveGovernanceKind = GovernanceDecisionKind | null;

const CLOSED_WORKFLOW_STATUSES = new Set<FindingStatus>([
  "RESOLVED",
  "MITIGATED",
]);
const NO_FIX_WORKFLOW_STATUSES = new Set<FindingStatus>([
  "FALSE_POSITIVE",
  "WONT_FIX",
]);

export function deriveFindingTruthStatus(input: {
  workflowStatus: FindingStatus;
  latestVerificationStatus: VerificationStatus | null;
  activeGovernanceKind: ActiveGovernanceKind;
}): FindingTruthStatus {
  if (input.latestVerificationStatus === "PASSED") {
    return "VERIFIED_FIXED";
  }

  if (input.activeGovernanceKind === "SUPPRESSION") {
    return "SUPPRESSED";
  }

  if (
    input.activeGovernanceKind === "WAIVER" ||
    input.activeGovernanceKind === "OVERRIDE"
  ) {
    return "WAIVED";
  }

  if (input.latestVerificationStatus === "FAILED") {
    return "OPEN";
  }

  if (input.latestVerificationStatus === "INCONCLUSIVE") {
    return "INCONCLUSIVE";
  }

  if (input.latestVerificationStatus === "ERRORED") {
    return "ERRORED";
  }

  if (CLOSED_WORKFLOW_STATUSES.has(input.workflowStatus)) {
    return "FIXED_PENDING_VERIFICATION";
  }

  if (NO_FIX_WORKFLOW_STATUSES.has(input.workflowStatus)) {
    return "INCONCLUSIVE";
  }

  return "OPEN";
}

export async function expireGovernanceDecisionsForSite(
  prisma: TxLike,
  siteId: string,
  now = new Date(),
) {
  await prisma.findingGovernanceDecision.updateMany({
    where: {
      siteId,
      status: "ACTIVE",
      expiresAt: { lt: now },
    },
    data: {
      status: "EXPIRED",
    },
  });
}

async function getLatestVerificationStatus(
  prisma: TxLike,
  canonicalFindingId: string,
): Promise<VerificationStatus | null> {
  const latest = await prisma.findingVerificationRun.findFirst({
    where: { canonicalFindingId },
    orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
    select: { status: true },
  });
  return latest?.status ?? null;
}

async function getActiveGovernanceKind(
  prisma: TxLike,
  canonicalFindingId: string,
  now = new Date(),
): Promise<ActiveGovernanceKind> {
  const decision = await prisma.findingGovernanceDecision.findFirst({
    where: {
      canonicalFindingId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
    },
    orderBy: { createdAt: "desc" },
    select: { kind: true },
  });
  return decision?.kind ?? null;
}

async function buildTruthStatus(
  prisma: TxLike,
  canonicalFindingId: string,
  workflowStatus: FindingStatus,
  siteId: string,
  now = new Date(),
) {
  await expireGovernanceDecisionsForSite(prisma, siteId, now);
  const [latestVerificationStatus, activeGovernanceKind] = await Promise.all([
    getLatestVerificationStatus(prisma, canonicalFindingId),
    getActiveGovernanceKind(prisma, canonicalFindingId, now),
  ]);

  return deriveFindingTruthStatus({
    workflowStatus,
    latestVerificationStatus,
    activeGovernanceKind,
  });
}

export async function recordFindingEvidence(input: {
  findingId: string;
  kind: string;
  label?: string;
  summary?: string;
  textValue?: string;
  jsonValue?: any;
  metadata?: any;
  scanRunId?: string;
  pageId?: string;
  capturedAt?: Date;
}) {
  const finding = await prisma.canonicalFinding.findUnique({
    where: { id: input.findingId },
    select: { siteId: true },
  });

  if (!finding) throw new Error(`Finding ${input.findingId} not found`);

  return prisma.findingEvidence.create({
    data: {
      siteId: finding.siteId,
      canonicalFindingId: input.findingId,
      scanRunId: input.scanRunId,
      pageId: input.pageId,
      kind: input.kind as any,
      label: input.label || input.kind,
      summary: input.summary,
      textValue: input.textValue,
      jsonValue: (input.jsonValue || input.metadata) as any,
      capturedAt: input.capturedAt ?? new Date(),
    },
  });
}

export async function recomputeFindingTruthStatus(
  prisma: TxLike,
  canonicalFindingId: string,
): Promise<FindingTruthStatus | null> {
  const finding = await prisma.canonicalFinding.findUnique({
    where: { id: canonicalFindingId },
    select: { id: true, siteId: true, status: true },
  });
  if (!finding) return null;

  const truthStatus = await buildTruthStatus(
    prisma,
    finding.id,
    finding.status,
    finding.siteId,
    new Date(),
  );

  await prisma.canonicalFinding.update({
    where: { id: finding.id },
    data: { truthStatus },
  });

  return truthStatus;
}

export async function recordAutomatedFindingObservation(
  prisma: PrismaClient,
  input: {
    siteId: string;
    scanRunId: string;
    pageId: string;
    pageUrl: string;
    pageTitle?: string | null;
    rawViolationId: string;
    observedAt?: Date;
    violation: NormalizedViolation;
  },
) {
  const observedAt = input.observedAt ?? new Date();

  return prisma.$transaction(async (tx) => {
    await expireGovernanceDecisionsForSite(tx, input.siteId, observedAt);

    const existing = await tx.canonicalFinding.findUnique({
      where: { fingerprint: input.violation.fingerprint },
      select: {
        id: true,
        siteId: true,
        status: true,
        reopenedCount: true,
      },
    });

    let findingId = existing?.id ?? null;
    let workflowStatus = (existing?.status ?? "OPEN") as FindingStatus;
    const shouldReopen =
      existing != null &&
      shouldReopenOnAutomatedDetection(existing.status as FindingStatusValue) &&
      (existing.status === "RESOLVED" || existing.status === "MITIGATED");

    if (!existing) {
      const created = await tx.canonicalFinding.create({
        data: {
          siteId: input.siteId,
          sourceType: "SCAN",
          targetKind: input.violation.selector ? "SELECTOR" : "PAGE",
          targetLocator: {
            selector: input.violation.selector,
            pageUrl: input.pageUrl,
            pageId: input.pageId,
          } as Prisma.InputJsonValue,
          ruleId: input.violation.ruleId,
          normalizedRuleKey: input.violation.normalizedRuleKey,
          ruleVersion: input.violation.ruleVersion,
          evaluationKind: input.violation.evaluationKind,
          wcagVersion: input.violation.wcagVersion,
          wcagCriteria: input.violation.wcagCriteria,
          impact: input.violation.impact,
          confidence: input.violation.confidence,
          description: input.violation.description,
          helpUrl: input.violation.helpUrl,
          wcagTags: input.violation.wcagTags,
          fingerprint: input.violation.fingerprint,
          evidenceSource: "AUTOMATED_AXE",
          status: "OPEN",
          truthStatus: "OPEN",
          occurrenceCount: 1,
          lastScanRunId: input.scanRunId,
          lastVerifiedAt: observedAt,
          provenance: {
            sourceType: "SCAN",
            scanRunId: input.scanRunId,
            rawViolationId: input.rawViolationId,
            pageId: input.pageId,
            pageUrl: input.pageUrl,
          } as Prisma.InputJsonValue,
          evidenceSummary: {
            latestObservationAt: observedAt.toISOString(),
            latestVerificationStatus: "FAILED",
            pageUrl: input.pageUrl,
          } as Prisma.InputJsonValue,
        },
      });
      findingId = created.id;
      workflowStatus = created.status;
    } else {
      workflowStatus = shouldReopen ? "OPEN" : existing.status;
      const activeGovernanceKind = await getActiveGovernanceKind(
        tx,
        existing.id,
        observedAt,
      );
      const truthStatus = deriveFindingTruthStatus({
        workflowStatus,
        latestVerificationStatus: "FAILED",
        activeGovernanceKind,
      });

      await tx.canonicalFinding.update({
        where: { id: existing.id },
        data: {
          lastSeenAt: observedAt,
          lastVerifiedAt: observedAt,
          occurrenceCount: { increment: 1 },
          lastScanRunId: input.scanRunId,
          targetKind: input.violation.selector ? "SELECTOR" : "PAGE",
          targetLocator: {
            selector: input.violation.selector,
            pageUrl: input.pageUrl,
            pageId: input.pageId,
          } as Prisma.InputJsonValue,
          normalizedRuleKey: input.violation.normalizedRuleKey,
          ruleVersion: input.violation.ruleVersion,
          evaluationKind: input.violation.evaluationKind,
          wcagVersion: input.violation.wcagVersion,
          wcagCriteria: input.violation.wcagCriteria,
          confidence: input.violation.confidence,
          truthStatus,
          provenance: {
            sourceType: "SCAN",
            scanRunId: input.scanRunId,
            rawViolationId: input.rawViolationId,
            pageId: input.pageId,
            pageUrl: input.pageUrl,
          } as Prisma.InputJsonValue,
          evidenceSummary: {
            latestObservationAt: observedAt.toISOString(),
            latestVerificationStatus: "FAILED",
            pageUrl: input.pageUrl,
          } as Prisma.InputJsonValue,
          ...(shouldReopen
            ? {
                status: "OPEN",
                reopenedCount: { increment: 1 },
              }
            : {}),
        },
      });

      if (shouldReopen) {
        await tx.findingStatusEvent.create({
          data: {
            canonicalFindingId: existing.id,
            fromStatus: existing.status,
            toStatus: "OPEN",
            note: "Automated verification re-detected this finding.",
          },
        });
      }
    }

    if (!findingId) {
      throw new Error("Could not resolve canonical finding for observation");
    }

    await tx.findingOccurrence.upsert({
      where: {
        canonicalFindingId_pageId: {
          canonicalFindingId: findingId,
          pageId: input.pageId,
        },
      },
      create: {
        canonicalFindingId: findingId,
        pageId: input.pageId,
        selector: input.violation.selector,
        elementHtml: input.violation.elementHtml,
        lastRawViolationId: input.rawViolationId,
      },
      update: {
        lastSeenAt: observedAt,
        resolved: false,
        selector: input.violation.selector,
        elementHtml: input.violation.elementHtml,
        lastRawViolationId: input.rawViolationId,
      },
    });

    const verificationRun = await tx.findingVerificationRun.create({
      data: {
        siteId: input.siteId,
        canonicalFindingId: findingId,
        scanRunId: input.scanRunId,
        kind: "SCAN_RECHECK",
        status: "FAILED",
        startedAt: observedAt,
        completedAt: observedAt,
        outcomeSummary:
          "Automated verification detected the finding in the latest scan.",
        metadata: {
          pageId: input.pageId,
          pageUrl: input.pageUrl,
          fingerprint: input.violation.fingerprint,
        } as Prisma.InputJsonValue,
      },
    });

    const evidenceRows: Prisma.FindingEvidenceCreateManyInput[] = [
      {
        siteId: input.siteId,
        canonicalFindingId: findingId,
        scanRunId: input.scanRunId,
        pageId: input.pageId,
        verificationRunId: verificationRun.id,
        kind: "RULE_EVALUATION",
        label: input.violation.ruleId,
        summary: input.violation.explainability,
        jsonValue: {
          description: input.violation.description,
          explainability: input.violation.explainability,
          normalizedRuleKey: input.violation.normalizedRuleKey,
          ruleVersion: input.violation.ruleVersion,
          evaluationKind: input.violation.evaluationKind,
          wcagVersion: input.violation.wcagVersion,
          wcagCriteria: input.violation.wcagCriteria,
          confidence: input.violation.confidence,
          rawViolationId: input.rawViolationId,
          helpUrl: input.violation.helpUrl,
        } as Prisma.InputJsonValue,
        capturedAt: observedAt,
      },
      {
        siteId: input.siteId,
        canonicalFindingId: findingId,
        scanRunId: input.scanRunId,
        pageId: input.pageId,
        kind: "DOM_SNIPPET",
        label: "Observed DOM excerpt",
        summary:
          input.violation.elementContext ||
          "DOM snippet captured during automated scan.",
        textValue: input.violation.elementHtml,
        capturedAt: observedAt,
      },
      {
        siteId: input.siteId,
        canonicalFindingId: findingId,
        scanRunId: input.scanRunId,
        pageId: input.pageId,
        kind: "SELECTOR_TRACE",
        label: "Selector trace",
        textValue: input.violation.selector,
        jsonValue: {
          selector: input.violation.selector,
          pageId: input.pageId,
          pageUrl: input.pageUrl,
        } as Prisma.InputJsonValue,
        capturedAt: observedAt,
      },
      {
        siteId: input.siteId,
        canonicalFindingId: findingId,
        scanRunId: input.scanRunId,
        pageId: input.pageId,
        verificationRunId: verificationRun.id,
        kind: "PAGE_METADATA",
        label: "Observed page",
        summary: input.pageTitle ?? input.pageUrl,
        jsonValue: {
          pageId: input.pageId,
          pageUrl: input.pageUrl,
          pageTitle: input.pageTitle ?? null,
        } as Prisma.InputJsonValue,
        capturedAt: observedAt,
      },
      {
        siteId: input.siteId,
        canonicalFindingId: findingId,
        scanRunId: input.scanRunId,
        pageId: input.pageId,
        verificationRunId: verificationRun.id,
        kind: "VERIFICATION_RESULT",
        label: "Verification result",
        summary:
          "Automated verification failed because the issue is still present.",
        jsonValue: {
          status: "FAILED",
          fingerprint: input.violation.fingerprint,
          scanRunId: input.scanRunId,
        } as Prisma.InputJsonValue,
        capturedAt: observedAt,
      },
    ];

    await tx.findingEvidence.createMany({ data: evidenceRows });

    return {
      canonicalFindingId: findingId,
      verificationRunId: verificationRun.id,
    };
  });
}

export async function finalizeAutomatedScanVerification(
  prisma: PrismaClient,
  input: {
    siteId: string;
    scanRunId: string;
    observedFingerprints: string[];
    completedAt?: Date;
  },
) {
  const completedAt = input.completedAt ?? new Date();

  await expireGovernanceDecisionsForSite(prisma, input.siteId, completedAt);

  const findings = await prisma.canonicalFinding.findMany({
    where: {
      siteId: input.siteId,
      evidenceSource: "AUTOMATED_AXE",
      sourceType: "SCAN",
      fingerprint: { notIn: input.observedFingerprints },
    },
    select: {
      id: true,
      status: true,
    },
  });

  const verificationRuns: Array<{
    canonicalFindingId: string;
    verificationRunId: string;
  }> = [];

  for (const finding of findings) {
    await prisma.$transaction(async (tx) => {
      const verificationRun = await tx.findingVerificationRun.create({
        data: {
          siteId: input.siteId,
          canonicalFindingId: finding.id,
          scanRunId: input.scanRunId,
          kind: "SCAN_RECHECK",
          status: "PASSED",
          startedAt: completedAt,
          completedAt,
          outcomeSummary:
            "Automated verification did not detect this finding in the latest scan.",
          metadata: {
            scanRunId: input.scanRunId,
            reason: "fingerprint_absent_from_scan",
          } as Prisma.InputJsonValue,
        },
      });

      const activeGovernanceKind = await getActiveGovernanceKind(
        tx,
        finding.id,
        completedAt,
      );
      const truthStatus = deriveFindingTruthStatus({
        workflowStatus: finding.status,
        latestVerificationStatus: "PASSED",
        activeGovernanceKind,
      });

      await tx.canonicalFinding.update({
        where: { id: finding.id },
        data: {
          lastScanRunId: input.scanRunId,
          lastVerifiedAt: completedAt,
          truthStatus,
          evidenceSummary: {
            latestObservationAt: completedAt.toISOString(),
            latestVerificationStatus: "PASSED",
            scanRunId: input.scanRunId,
          } as Prisma.InputJsonValue,
        },
      });

      await tx.findingOccurrence.updateMany({
        where: {
          canonicalFindingId: finding.id,
          resolved: false,
        },
        data: {
          resolved: true,
        },
      });

      await tx.findingEvidence.create({
        data: {
          siteId: input.siteId,
          canonicalFindingId: finding.id,
          scanRunId: input.scanRunId,
          verificationRunId: verificationRun.id,
          kind: "VERIFICATION_RESULT",
          label: "Verification result",
          summary:
            "Automated verification passed because the finding was not re-detected in the latest scan.",
          jsonValue: {
            status: "PASSED",
            scanRunId: input.scanRunId,
          } as Prisma.InputJsonValue,
          capturedAt: completedAt,
        },
      });

      verificationRuns.push({
        canonicalFindingId: finding.id,
        verificationRunId: verificationRun.id,
      });
    });
  }

  return verificationRuns;
}

type GovernanceMutationResult =
  | { ok: true; decisionId: string; truthStatus: FindingTruthStatus }
  | {
      ok: false;
      code:
        | "forbidden"
        | "not_found"
        | "invalid_kind"
        | "missing_rationale"
        | "invalid_expiry";
    };

function normalizeDecisionKind(input: string): GovernanceDecisionKind | null {
  if (input === "WAIVER" || input === "SUPPRESSION" || input === "OVERRIDE") {
    return input;
  }
  return null;
}

async function loadFindingScopedToOrg(
  prisma: TxLike,
  findingId: string,
  organizationId: string,
) {
  return prisma.canonicalFinding.findFirst({
    where: {
      id: findingId,
      site: { workspace: { organizationId } },
    },
    select: {
      id: true,
      siteId: true,
      status: true,
      site: { select: { workspace: { select: { organizationId: true } } } },
    },
  });
}

export async function createFindingGovernanceDecision(input: {
  prisma: PrismaClient;
  findingId: string;
  organizationId: string;
  userId: string;
  userRole: MemberRole;
  kind: string;
  rationale: string;
  justification?: string | null;
  expiresAt?: Date | null;
}): Promise<GovernanceMutationResult> {
  if (!hasPermission(input.userRole, "finding:manage")) {
    return { ok: false, code: "forbidden" };
  }

  const kind = normalizeDecisionKind(input.kind);
  if (!kind) {
    return { ok: false, code: "invalid_kind" };
  }

  const rationale = input.rationale.trim();
  if (!rationale) {
    return { ok: false, code: "missing_rationale" };
  }

  if (input.expiresAt && Number.isNaN(input.expiresAt.getTime())) {
    return { ok: false, code: "invalid_expiry" };
  }

  const finding = await loadFindingScopedToOrg(
    input.prisma,
    input.findingId,
    input.organizationId,
  );

  if (!finding) {
    return { ok: false, code: "not_found" };
  }

  const now = new Date();
  const justification = input.justification?.trim() || null;

  return input.prisma.$transaction(async (tx) => {
    await expireGovernanceDecisionsForSite(tx, finding.siteId, now);

    await tx.findingGovernanceDecision.updateMany({
      where: {
        canonicalFindingId: finding.id,
        status: "ACTIVE",
      },
      data: {
        status: "REVOKED",
        revokedAt: now,
        revokedById: input.userId,
      },
    });

    const decision = await tx.findingGovernanceDecision.create({
      data: {
        siteId: finding.siteId,
        canonicalFindingId: finding.id,
        kind,
        status: "ACTIVE",
        rationale,
        justification,
        expiresAt: input.expiresAt ?? null,
        createdById: input.userId,
        approvedById: input.userId,
        approvedAt: now,
        metadata: {
          createdFrom: "finding-detail",
        } as Prisma.InputJsonValue,
      },
    });

    const latestVerificationStatus = await getLatestVerificationStatus(
      tx,
      finding.id,
    );
    const truthStatus = deriveFindingTruthStatus({
      workflowStatus: finding.status,
      latestVerificationStatus,
      activeGovernanceKind: decision.kind,
    });

    await tx.canonicalFinding.update({
      where: { id: finding.id },
      data: { truthStatus },
    });

    await tx.findingEvidence.create({
      data: {
        siteId: finding.siteId,
        canonicalFindingId: finding.id,
        governanceDecisionId: decision.id,
        kind: "GOVERNANCE_NOTE",
        label: `${decision.kind.toLowerCase()} decision`,
        summary: rationale,
        textValue: justification,
        jsonValue: {
          kind: decision.kind,
          expiresAt: decision.expiresAt?.toISOString() ?? null,
          status: decision.status,
        } as Prisma.InputJsonValue,
        capturedAt: now,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: "finding.governance_created",
        entityType: "FindingGovernanceDecision",
        entityId: decision.id,
        metadata: {
          findingId: finding.id,
          kind: decision.kind,
          expiresAt: decision.expiresAt?.toISOString() ?? null,
        },
      },
    });

    return { ok: true, decisionId: decision.id, truthStatus } as const;
  });
}

export async function revokeFindingGovernanceDecision(input: {
  prisma: PrismaClient;
  decisionId: string;
  organizationId: string;
  userId: string;
  userRole: MemberRole;
}): Promise<GovernanceMutationResult> {
  if (!hasPermission(input.userRole, "finding:manage")) {
    return { ok: false, code: "forbidden" };
  }

  const decision = await input.prisma.findingGovernanceDecision.findFirst({
    where: {
      id: input.decisionId,
      finding: {
        site: { workspace: { organizationId: input.organizationId } },
      },
    },
    select: {
      id: true,
      status: true,
      kind: true,
      siteId: true,
      canonicalFindingId: true,
      finding: { select: { status: true } },
    },
  });

  if (!decision) {
    return { ok: false, code: "not_found" };
  }

  const now = new Date();

  return input.prisma.$transaction(async (tx) => {
    await tx.findingGovernanceDecision.update({
      where: { id: decision.id },
      data: {
        status: decision.status === "EXPIRED" ? "EXPIRED" : "REVOKED",
        revokedAt: now,
        revokedById: input.userId,
      },
    });

    const [latestVerificationStatus, activeGovernanceKind] = await Promise.all([
      getLatestVerificationStatus(tx, decision.canonicalFindingId),
      getActiveGovernanceKind(tx, decision.canonicalFindingId, now),
    ]);

    const truthStatus = deriveFindingTruthStatus({
      workflowStatus: decision.finding.status,
      latestVerificationStatus,
      activeGovernanceKind,
    });

    await tx.canonicalFinding.update({
      where: { id: decision.canonicalFindingId },
      data: { truthStatus },
    });

    await tx.findingEvidence.create({
      data: {
        siteId: decision.siteId,
        canonicalFindingId: decision.canonicalFindingId,
        governanceDecisionId: decision.id,
        kind: "GOVERNANCE_NOTE",
        label: "governance revoked",
        summary: `Revoked ${decision.kind.toLowerCase()} decision.`,
        jsonValue: {
          kind: decision.kind,
          revokedAt: now.toISOString(),
        } as Prisma.InputJsonValue,
        capturedAt: now,
      },
    });

    await tx.auditLog.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        action: "finding.governance_revoked",
        entityType: "FindingGovernanceDecision",
        entityId: decision.id,
        metadata: {
          findingId: decision.canonicalFindingId,
          kind: decision.kind,
        },
      },
    });

    return { ok: true, decisionId: decision.id, truthStatus } as const;
  });
}

export function deriveWorkflowTruthStatus(
  workflowStatus: FindingStatus,
  activeGovernanceKind: ActiveGovernanceKind,
): FindingTruthStatus {
  return deriveFindingTruthStatus({
    workflowStatus,
    latestVerificationStatus: null,
    activeGovernanceKind,
  });
}

export async function getActiveFindingGovernanceDecision(
  prisma: PrismaClient,
  canonicalFindingId: string,
): Promise<FindingGovernanceDecision | null> {
  await expireGovernanceDecisionsForSite(
    prisma,
    (
      await prisma.canonicalFinding.findUnique({
        where: { id: canonicalFindingId },
        select: { siteId: true },
      })
    )?.siteId ?? "",
  );

  return prisma.findingGovernanceDecision.findFirst({
    where: {
      canonicalFindingId,
      status: "ACTIVE",
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });
}
