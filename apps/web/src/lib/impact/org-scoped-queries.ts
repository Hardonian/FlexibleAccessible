import { prisma } from "@/lib/db";
import { ApiError } from "@aros/shared";
import type { OrgMembershipCore } from "@/lib/route-data-boundary";
import { runCanonicalOrgQuery } from "@/lib/server-org-boundary";

export async function verifyOrgSiteAccess(ctx: OrgMembershipCore, siteId: string) {
  return runCanonicalOrgQuery(ctx, async (organizationId) => {
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        workspace: { organizationId },
      },
      select: { id: true, name: true },
    });

    if (!site) {
      throw ApiError.notFound("Site not found");
    }

    return site;
  });
}

export async function isImpactStale(ctx: OrgMembershipCore, siteId: string) {
  return runCanonicalOrgQuery(ctx, async () => {
    const latestImpact = await prisma.clusterImpact.findFirst({
      where: { cluster: { siteId } },
      orderBy: { computedAt: "desc" },
      select: { computedAt: true },
    });

    return (
      !latestImpact ||
      Date.now() - latestImpact.computedAt.getTime() > 60 * 60 * 1000
    );
  });
}
