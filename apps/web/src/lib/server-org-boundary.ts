import { ApiError } from "@aros/shared";
import { requireOrgAccess } from "@/lib/auth-guard";
import { runOrgScopedQuery, type OrgMembershipCore } from "@/lib/route-data-boundary";
import type { Permission } from "@aros/config";

interface OrgBoundaryOptions {
  requirePaid?: boolean;
}

export async function requireCanonicalOrgAccess(
  organizationId: string | null | undefined,
  permission?: Permission,
  options: OrgBoundaryOptions = {},
): Promise<OrgMembershipCore> {
  if (!organizationId) {
    throw ApiError.badRequest("organizationId required");
  }

  const ctx = await requireOrgAccess(organizationId, permission, options);
  return { organizationId: ctx.organizationId, role: ctx.role };
}

export async function runCanonicalOrgQuery<T>(
  ctx: OrgMembershipCore,
  query: (organizationId: string) => Promise<T>,
): Promise<T> {
  const result = await runOrgScopedQuery(ctx, query);
  if (!result.ok) {
    throw ApiError.forbidden(result.message);
  }
  return result.data;
}
