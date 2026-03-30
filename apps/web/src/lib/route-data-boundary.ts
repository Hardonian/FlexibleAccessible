import { prisma } from "./db";
import { cookies } from "next/headers";
import type { MemberRole } from "@aros/db";
import type { RoutePlatformTruth } from "@aros/core-services";

const ACTIVE_ORG_COOKIE = "aros_active_org";

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
 * Resolves the user's active org membership for dashboard routes.
 * Prefers the cookie-selected org, falls back to oldest membership.
 * When platform truth disallows DB reads, skips hitting Prisma for membership.
 */
export async function resolveDashboardOrgMembership(
  userId: string,
  truth: RoutePlatformTruth,
): Promise<OrgMembershipResolution> {
  if (!truth.allowOrgScopedDbReads) {
    return { kind: "platform_blocked", truth };
  }

  try {
    const cookieStore = await cookies();
    const preferredOrgId = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;

    if (preferredOrgId) {
      const preferred = await prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: preferredOrgId,
          },
        },
        select: { organizationId: true, role: true },
      });
      if (preferred) {
        return {
          kind: "ok",
          organizationId: preferred.organizationId,
          role: preferred.role,
        };
      }
    }

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
