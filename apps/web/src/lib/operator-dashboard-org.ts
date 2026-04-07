import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { MemberRole } from "@aros/db";
import { resolveOperatorScopedMembership } from "@/lib/operator-org-resolution";
import { loadMembershipsForOperatorResolution } from "@/lib/operator-membership-db";

const ACTIVE_ORG_COOKIE = "aros_active_org";

export type OperatorDashboardPageContext =
  | { kind: "no_membership" }
  | { kind: "no_operator_access" }
  | {
      kind: "ok";
      organizationId: string;
      organizationName: string;
      role: MemberRole;
    };

/**
 * Single resolution path for `/system/operator` UI — matches `requireOperatorAccess`
 * in `system/operator/actions.ts` (cookie + `org:system:view` on eligible memberships).
 */
export async function resolveOperatorDashboardPageContext(
  userId: string,
): Promise<OperatorDashboardPageContext> {
  const memberships = await loadMembershipsForOperatorResolution(userId);
  if (memberships.length === 0) {
    return { kind: "no_membership" };
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
    return { kind: "no_operator_access" };
  }

  const org = await prisma.organization.findUnique({
    where: { id: resolved.organizationId },
    select: { id: true, name: true },
  });
  if (!org) {
    return { kind: "no_operator_access" };
  }

  return {
    kind: "ok",
    organizationId: org.id,
    organizationName: org.name,
    role: resolved.role,
  };
}
