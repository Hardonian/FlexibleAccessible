import { prisma } from "@/lib/db";
import type { OrgMembershipCore } from "@/lib/route-data-boundary";
import { runCanonicalOrgQuery } from "@/lib/server-org-boundary";

export async function listFindingsForReport(ctx: OrgMembershipCore, siteId?: string | null) {
  return runCanonicalOrgQuery(ctx, async (organizationId) =>
    prisma.canonicalFinding.findMany({
      where: {
        site: {
          workspace: { organizationId },
          ...(siteId ? { id: siteId } : {}),
        },
      },
      include: {
        occurrences: {
          include: { page: { select: { url: true, title: true } } },
          take: 100,
        },
        evidenceRecords: {
          take: 20,
          orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }],
        },
        verificationRuns: {
          take: 10,
          orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
        },
        governanceDecisions: {
          take: 10,
          orderBy: [{ createdAt: "desc" }],
          select: {
            id: true,
            kind: true,
            status: true,
            rationale: true,
            justification: true,
            expiresAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ impact: "asc" }, { occurrenceCount: "desc" }],
    }),
  );
}
