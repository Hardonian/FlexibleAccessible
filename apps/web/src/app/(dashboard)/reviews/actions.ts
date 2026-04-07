"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import type { ReviewStatus } from "@aros/db";
import type { Prisma } from "@aros/db";
import { requireOrgAccess } from "@/lib/auth-guard";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { resolveDashboardOrgMembership } from "@/lib/route-data-boundary";
import {
  loadReviewTaskForOrg,
  updateReviewTaskStatusForOrg,
} from "@/lib/dashboard-org-scoped-prisma";
import {
  assertFormOrgMatchesActive,
  parseExpectedOrgFromForm,
} from "@/lib/dashboard-form-org";

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

  const platformTruth = await getRoutePlatformTruth();
  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);
  if (orgRes.kind !== "ok") {
    redirect("/reviews?review_error=not_found");
  }

  const expectedOrg = parseExpectedOrgFromForm(formData);
  if (!assertFormOrgMatchesActive(expectedOrg, orgRes.organizationId)) {
    redirect("/reviews?review_error=stale_session");
  }

  await requireOrgAccess(orgRes.organizationId, "review:manage", {
    requirePaid: true,
  });

  const task = await loadReviewTaskForOrg(taskId, orgRes.organizationId);
  if (!task) {
    redirect("/reviews?review_error=not_found");
  }

  const data: Prisma.ReviewTaskUpdateInput = {
    status: reviewStatus,
    assignee: { connect: { id: user.id } },
    reviewedAt:
      reviewStatus === "APPROVED" || reviewStatus === "REJECTED"
        ? new Date()
        : undefined,
  };

  const updated = await updateReviewTaskStatusForOrg(
    taskId,
    orgRes.organizationId,
    data,
  );
  if (!updated) {
    redirect("/reviews?review_error=update_failed");
  }

  revalidatePath("/reviews");
}
