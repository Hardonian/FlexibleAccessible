import { ApiError } from "@aros/shared";
import { prisma } from "@/lib/db";
import type { OrgMembershipCore } from "@/lib/route-data-boundary";
import { runCanonicalOrgQuery } from "@/lib/server-org-boundary";

export async function getCopilotFindingContext(
  ctx: OrgMembershipCore,
  findingId: string,
) {
  return runCanonicalOrgQuery(ctx, async (organizationId) => {
    const finding = await prisma.canonicalFinding.findFirst({
      where: {
        id: findingId,
        site: { workspace: { organizationId } },
      },
      include: {
        occurrences: {
          take: 3,
          include: { page: { select: { url: true, title: true } } },
        },
        suggestions: {
          take: 3,
          orderBy: { createdAt: "desc" },
          select: {
            type: true,
            suggestedCode: true,
            rationale: true,
            confidence: true,
            status: true,
          },
        },
        cluster: {
          select: {
            name: true,
            description: true,
            pageCount: true,
            findingCount: true,
          },
        },
      },
    });

    if (!finding) {
      throw ApiError.notFound("Finding not found");
    }

    return finding;
  });
}

export async function requireAiEnabled(ctx: OrgMembershipCore) {
  return runCanonicalOrgQuery(ctx, async (organizationId) => {
    const subscription = await prisma.subscription.findUnique({
      where: { organizationId },
      select: { aiEnabled: true },
    });
    return Boolean(subscription?.aiEnabled);
  });
}

export async function logAiCopilotUsage(
  ctx: OrgMembershipCore,
  input: {
    userId: string;
    model: string;
  },
) {
  return runCanonicalOrgQuery(ctx, async (organizationId) =>
    prisma.aiUsageLog.create({
      data: {
        organizationId,
        userId: input.userId,
        model: input.model,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        purpose: "copilot-chat",
      },
    }),
  );
}
