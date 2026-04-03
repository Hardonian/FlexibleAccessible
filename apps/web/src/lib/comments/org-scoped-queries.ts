import { prisma } from "@/lib/db";
import { ApiError } from "@aros/shared";
import type { OrgMembershipCore } from "@/lib/route-data-boundary";
import { runCanonicalOrgQuery } from "@/lib/server-org-boundary";

export async function listFindingComments(ctx: OrgMembershipCore, findingId: string) {
  return runCanonicalOrgQuery(ctx, async (organizationId) =>
    prisma.findingComment.findMany({
      where: {
        canonicalFindingId: findingId,
        organizationId,
        parentId: null,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        replies: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  );
}

export async function createFindingComment(
  ctx: OrgMembershipCore,
  input: {
    findingId: string;
    userId: string;
    body: string;
    parentId?: string;
  },
) {
  return runCanonicalOrgQuery(ctx, async (organizationId) => {
    const finding = await prisma.canonicalFinding.findFirst({
      where: {
        id: input.findingId,
        site: { workspace: { organizationId } },
      },
      select: { id: true },
    });

    if (!finding) {
      throw ApiError.notFound("Finding not found");
    }

    if (input.parentId) {
      const parent = await prisma.findingComment.findFirst({
        where: {
          id: input.parentId,
          canonicalFindingId: input.findingId,
          organizationId,
        },
        select: { id: true },
      });

      if (!parent) {
        throw ApiError.notFound("Parent comment not found");
      }
    }

    return prisma.findingComment.create({
      data: {
        canonicalFindingId: input.findingId,
        userId: input.userId,
        organizationId,
        body: input.body,
        parentId: input.parentId,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  });
}
