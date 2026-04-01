"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import type { ReviewStatus } from "@aros/db";
import { hasPermission } from "@aros/config";
import { getEntitlementState } from "@/lib/auth-guard";

const VALID_REVIEW_STATUSES: ReviewStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "APPROVED",
  "REJECTED",
  "NEEDS_CHANGES",
];

export async function updateReviewAction(formData: FormData) {
  const user = await requireSession();
  const taskId = formData.get("taskId") as string;
  const status = (formData.get("status") as string) || "";

  if (!taskId) {
    redirect("/reviews?review_error=missing_task");
  }

  if (!VALID_REVIEW_STATUSES.includes(status as ReviewStatus)) {
    redirect("/reviews?review_error=invalid_status");
  }

  const reviewStatus = status as ReviewStatus;

  const task = await prisma.reviewTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      suggestion: {
        select: {
          cluster: {
            select: {
              site: {
                select: {
                  workspace: { select: { organizationId: true } },
                },
              },
            },
          },
          finding: {
            select: {
              site: {
                select: {
                  workspace: { select: { organizationId: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!task) {
    redirect("/reviews?review_error=not_found");
  }

  const orgId =
    task.suggestion?.cluster?.site.workspace.organizationId ??
    task.suggestion?.finding?.site.workspace.organizationId;

  if (!orgId) {
    redirect("/reviews?review_error=no_org");
  }

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, organizationId: orgId },
    select: { role: true },
  });

  if (!membership) {
    redirect("/reviews?review_error=forbidden");
  }

  if (!hasPermission(membership.role, "review:manage")) {
    redirect("/reviews?review_error=forbidden");
  }

  const entitlement = getEntitlementState(
    await prisma.subscription.findUnique({
      where: { organizationId: orgId },
      select: {
        plan: true,
        status: true,
        maxDomains: true,
        maxPagesPerCrawl: true,
        maxScansPerMonth: true,
        maxSeats: true,
        aiEnabled: true,
        aiTokenLimit: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    }),
  );

  if (!entitlement.hasPaidAccess) {
    redirect("/settings/billing?status=upgrade_required&from=%2Freviews");
  }

  try {
    await prisma.reviewTask.update({
      where: { id: taskId },
      data: {
        status: reviewStatus,
        assigneeId: user.id,
        reviewedAt:
          reviewStatus === "APPROVED" || reviewStatus === "REJECTED"
            ? new Date()
            : undefined,
      },
    });
  } catch {
    redirect("/reviews?review_error=update_failed");
  }

  revalidatePath("/reviews");
}
