"use server";

import { cookies } from "next/headers";
import { requireSession } from "@/lib/session";
import type { MemberRole } from "@aros/db";
import { ApiError } from "@aros/shared";
import { resolveOperatorScopedMembership } from "@/lib/operator-org-resolution";
import { loadMembershipsForOperatorResolution } from "@/lib/operator-membership-db";
import {
  createOperatorDismissAudit,
  fetchOperatorHealthPayload,
} from "@/lib/operator-console-queries";

export type {
  StaleSite,
  OrgWithSubscription,
  FailedRun,
  AgedFinding,
  HighImpactCluster,
  WorkQueueItem,
  AccountHealthRollup,
  CustomerWorkQueue,
  RenewalWatchlist,
  ExceptionRouting,
  OperatorHealthPayload,
} from "@/lib/operator-console-types";

const ACTIVE_ORG_COOKIE = "aros_active_org";

async function requireOperatorAccess(): Promise<{
  user: { id: string; email: string; name: string | null };
  organizationId: string;
  role: MemberRole;
}> {
  const user = await requireSession();

  const memberships = await loadMembershipsForOperatorResolution(user.id);

  if (memberships.length === 0) {
    throw ApiError.forbidden("No organization membership found");
  }

  const cookieStore = await cookies();
  const preferredOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

  const resolved = resolveOperatorScopedMembership(
    memberships.map((m) => ({
      organizationId: m.organizationId,
      role: m.role,
      createdAt: m.createdAt,
    })),
    preferredOrgId ?? undefined,
    "org:system:view",
  );

  if (!resolved) {
    throw ApiError.forbidden("Missing permission: org:system:view");
  }

  return {
    user,
    organizationId: resolved.organizationId,
    role: resolved.role,
  };
}

export async function getOperatorHealthData() {
  const ctx = await requireOperatorAccess();
  return fetchOperatorHealthPayload(ctx.organizationId);
}

export async function dismissWorkQueueItem(itemId: string): Promise<void> {
  const ctx = await requireOperatorAccess();

  await createOperatorDismissAudit({
    organizationId: ctx.organizationId,
    userId: ctx.user.id,
    itemId,
  });
}
