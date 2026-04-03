import { prisma } from "@/lib/db";
import type { OrgMembershipCore } from "@/lib/route-data-boundary";
import { runCanonicalOrgQuery } from "@/lib/server-org-boundary";

export async function findGithubActionSite(ctx: OrgMembershipCore, siteId: string) {
  return runCanonicalOrgQuery(ctx, async (organizationId) =>
    prisma.site.findFirst({
      where: {
        id: siteId,
        workspace: { organizationId },
      },
      include: {
        workspace: {
          include: { organization: true },
        },
      },
    }),
  );
}

export async function createPendingScanRun(siteId: string) {
  return prisma.scanRun.create({
    data: {
      siteId,
      status: "PENDING",
    },
  });
}

export async function listDeployWebhooks(ctx: OrgMembershipCore) {
  return runCanonicalOrgQuery(ctx, async (organizationId) =>
    prisma.deployWebhook.findMany({
      where: { organizationId },
      include: { site: { select: { id: true, name: true, domain: true } } },
      orderBy: { createdAt: "desc" },
    }),
  );
}

export async function findActiveDeployWebhookByDomain(domain: string) {
  return prisma.deployWebhook.findFirst({
    where: {
      isActive: true,
      site: { domain },
    },
    include: {
      site: {
        include: {
          workspace: {
            include: {
              organization: {
                include: {
                  subscription: true,
                },
              },
            },
          },
        },
      },
    },
  });
}
