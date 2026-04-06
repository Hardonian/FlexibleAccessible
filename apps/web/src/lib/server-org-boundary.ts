import { ApiError, AppError } from "@aros/shared";
import { requireOrgAccess } from "@/lib/auth-guard";
import { runOrgScopedQuery, type OrgMembershipCore } from "@/lib/route-data-boundary";
import type { Permission, PlanTier } from "@aros/config";
import { planMeetsMinimum } from "@aros/config";

interface OrgBoundaryOptions {
  requirePaid?: boolean;
  /** Minimum self-serve tier on the plan ladder (FREE < STARTER < PROFESSIONAL < ENTERPRISE). */
  planMinimum?: PlanTier;
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

  if (options.planMinimum) {
    const tier = ctx.subscription?.plan ?? "FREE";
    if (!planMeetsMinimum(tier, options.planMinimum)) {
      throw new ApiError(
        `This capability requires ${options.planMinimum} or higher on this organization.`,
        "PLAN_UPGRADE_REQUIRED",
        403,
      );
    }
  }

  return { organizationId: ctx.organizationId, role: ctx.role };
}

export async function runCanonicalOrgQuery<T>(
  ctx: OrgMembershipCore,
  query: (organizationId: string) => Promise<T>,
): Promise<T> {
  const result = await runOrgScopedQuery(ctx, query);
  if (!result.ok) {
    if (result.statusCode != null && result.code != null) {
      throw new AppError(result.message, result.code, result.statusCode);
    }
    throw ApiError.forbidden(result.message);
  }
  return result.data;
}
