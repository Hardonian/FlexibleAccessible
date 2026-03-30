import { prisma } from "./db";
import type { MemberRole } from "@aros/db";
import type { RoutePlatformTruth } from "@aros/core-services";

export type OrgMembershipCore = {
  organizationId: string;
  role: MemberRole;
};

export type OrgMembershipResolution =
  | { kind: "ok"; organizationId: string; role: MemberRole }
  | { kind: "none" }
  | { kind: "platform_blocked"; truth: RoutePlatformTruth }
  | { kind: "error"; message: string };

/**
 * Resolves the user's primary org membership for dashboard routes.
 * When platform truth disallows DB reads, skips hitting Prisma for membership (avoids noisy errors).
 */
export async function resolveDashboardOrgMembership(
  userId: string,
  truth: RoutePlatformTruth,
): Promise<OrgMembershipResolution> {
  if (!truth.allowOrgScopedDbReads) {
    return { kind: "platform_blocked", truth };
  }

  try {
    const row = await prisma.membership.findFirst({
      where: { userId },
      select: { organizationId: true, role: true },
      orderBy: { createdAt: "asc" },
    });
    if (!row) return { kind: "none" };
    return { kind: "ok", organizationId: row.organizationId, role: row.role };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database error";
    console.error("[route-data-boundary] membership resolution failed", e);
    return { kind: "error", message };
  }
}

export type OrgScopedQueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };

export async function runOrgScopedQuery<T>(
  ctx: OrgMembershipCore,
  fn: (organizationId: string) => Promise<T>,
): Promise<OrgScopedQueryResult<T>> {
  try {
    const data = await fn(ctx.organizationId);
    return { ok: true, data };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database error";
    console.error("[route-data-boundary] org-scoped query failed", e);
    return { ok: false, message };
  }
}
