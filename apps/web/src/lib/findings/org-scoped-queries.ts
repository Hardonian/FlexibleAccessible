import { prisma } from "@/lib/db";
import { runOrgScopedQuery, type OrgMembershipCore } from "@/lib/route-data-boundary";

/**
 * Fetches all sites strictly isolated to the verified organization.
 * Navigates the relation: Site -> Workspace -> Organization
 */
export async function getScopedSites(ctx: OrgMembershipCore) {
  return runOrgScopedQuery(ctx, async (organizationId) => {
    return prisma.site.findMany({
      where: {
        workspace: {
          organizationId: organizationId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  });
}

/**
 * Fetches canonical findings strictly isolated to the verified organization.
 * Navigates the deep relation: Finding -> Occurrence -> Page -> Site -> Workspace -> Org
 */
export async function getScopedFindings(ctx: OrgMembershipCore, limit = 50) {
  return runOrgScopedQuery(ctx, async (organizationId) => {
    return prisma.canonicalFinding.findMany({
      where: {
        occurrences: {
          some: {
            page: {
              site: {
                workspace: {
                  organizationId: organizationId,
                },
              },
            },
          },
        },
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  });
}

/**
 * Fetches organization members strictly isolated to the verified organization.
 */
export async function getScopedMembers(ctx: OrgMembershipCore) {
  return runOrgScopedQuery(ctx, async (organizationId) => {
    return prisma.membership.findMany({
      where: { organizationId: organizationId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  });
}