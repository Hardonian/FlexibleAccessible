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

export async function findVpatSite(ctx: OrgMembershipCore, siteId: string) {
  return runCanonicalOrgQuery(ctx, async (organizationId) =>
    prisma.site.findFirst({
      where: {
        id: siteId,
        workspace: { organizationId },
      },
      select: {
        id: true,
        name: true,
        domain: true,
      },
    }),
  );
}

export async function getOrganizationName(ctx: OrgMembershipCore) {
  return runCanonicalOrgQuery(ctx, async (organizationId) =>
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
  );
}

export async function createVpatReportRecord(
  ctx: OrgMembershipCore,
  input: { siteId: string; siteName: string; summaryText: string; report: object },
) {
  return runCanonicalOrgQuery(ctx, async () =>
    prisma.report.create({
      data: {
        siteId: input.siteId,
        type: "VPAT",
        title: `VPAT Report - ${input.siteName}`,
        content: input.report,
        summary: input.summaryText,
      },
    }),
  );
}
