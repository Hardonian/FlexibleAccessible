"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasPermission } from "@aros/config";

async function requireSuggestionAccess(suggestionId: string, userId: string) {
  if (!suggestionId) {
    redirect("/remediation?error=missing_id");
  }

  const suggestion = await prisma.remediationSuggestion.findUnique({
    where: { id: suggestionId },
    select: {
      id: true,
      status: true,
      recipeId: true,
      finding: {
        select: {
          site: {
            select: {
              workspace: {
                select: {
                  organizationId: true,
                  organization: {
                    select: {
                      memberships: {
                        where: { userId },
                        take: 1,
                        select: { role: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      cluster: {
        select: {
          site: {
            select: {
              workspace: {
                select: {
                  organizationId: true,
                  organization: {
                    select: {
                      memberships: {
                        where: { userId },
                        take: 1,
                        select: { role: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!suggestion) {
    redirect("/remediation?error=not_found");
  }

  const orgMembership =
    suggestion.finding?.site.workspace.organization.memberships[0] ??
    suggestion.cluster?.site.workspace.organization.memberships[0];

  if (!orgMembership) {
    redirect("/remediation?error=forbidden");
  }

  return { suggestion, role: orgMembership.role };
}

export async function approveSuggestionAction(formData: FormData) {
  const user = await requireSession();
  const suggestionId = (formData.get("suggestionId") as string) || "";

  const { suggestion, role } = await requireSuggestionAccess(
    suggestionId,
    user.id,
  );

  if (!hasPermission(role, "suggestions:approve")) {
    redirect(`/remediation/${suggestionId}?error=forbidden`);
  }

  if (suggestion.status !== "DRAFT" && suggestion.status !== "VALIDATED") {
    redirect(`/remediation/${suggestionId}?error=invalid_transition`);
  }

  try {
    await prisma.remediationSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: "APPROVED",
        appliedBy: user.id,
        appliedAt: new Date(),
      },
    });
    if (suggestion.recipeId) {
      await prisma.remediationRecipe.update({
        where: { id: suggestion.recipeId },
        data: { successCount: { increment: 1 } },
      });
    }
  } catch {
    redirect(`/remediation/${suggestionId}?error=update_failed`);
  }

  redirect(`/remediation/${suggestionId}`);
}

export async function rejectSuggestionAction(formData: FormData) {
  const user = await requireSession();
  const suggestionId = (formData.get("suggestionId") as string) || "";

  const { suggestion, role } = await requireSuggestionAccess(
    suggestionId,
    user.id,
  );

  if (!hasPermission(role, "suggestions:approve")) {
    redirect(`/remediation/${suggestionId}?error=forbidden`);
  }

  if (suggestion.status === "REJECTED" || suggestion.status === "APPLIED") {
    redirect(`/remediation/${suggestionId}?error=invalid_transition`);
  }

  try {
    await prisma.remediationSuggestion.update({
      where: { id: suggestionId },
      data: { status: "REJECTED" },
    });
    if (suggestion.recipeId) {
      await prisma.remediationRecipe.update({
        where: { id: suggestion.recipeId },
        data: { rejectionCount: { increment: 1 } },
      });
    }
  } catch {
    redirect(`/remediation/${suggestionId}?error=update_failed`);
  }

  redirect(`/remediation/${suggestionId}`);
}

export async function exportSnippetAction(formData: FormData) {
  const user = await requireSession();
  const suggestionId = (formData.get("suggestionId") as string) || "";

  const { suggestion, role } = await requireSuggestionAccess(
    suggestionId,
    user.id,
  );

  if (!hasPermission(role, "suggestions:export")) {
    redirect(`/remediation/${suggestionId}?error=forbidden`);
  }

  if (suggestion.status !== "APPROVED" && suggestion.status !== "VALIDATED") {
    redirect(`/remediation/${suggestionId}?error=invalid_transition`);
  }

  try {
    await prisma.remediationSuggestion.update({
      where: { id: suggestionId },
      data: { status: "EXPORTED" },
    });
  } catch {
    redirect(`/remediation/${suggestionId}?error=update_failed`);
  }

  redirect(`/remediation/${suggestionId}`);
}
