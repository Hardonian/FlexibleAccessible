"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import type { ReviewStatus } from "@aros/db";

export async function updateReviewAction(formData: FormData) {
  const user = await requireSession();
  const taskId = formData.get("taskId") as string;
  const status = formData.get("status") as ReviewStatus;

  if (!taskId || !status) return;

  const task = await prisma.reviewTask.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      suggestion: {
        select: {
          cluster: {
            select: {
              site: {
                select: { workspace: { select: { organizationId: true } } },
              },
            },
          },
          finding: {
            select: {
              site: {
                select: { workspace: { select: { organizationId: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!task) return;

  const orgId =
    task.suggestion?.cluster?.site.workspace.organizationId ??
    task.suggestion?.finding?.site.workspace.organizationId;

  if (!orgId) return;

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, organizationId: orgId },
  });

  if (!membership) return;

  await prisma.reviewTask.update({
    where: { id: taskId },
    data: {
      status,
      reviewedAt:
        status === "APPROVED" || status === "REJECTED" ? new Date() : undefined,
    },
  });

  revalidatePath("/reviews");
}
