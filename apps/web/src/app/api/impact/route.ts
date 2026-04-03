import { requireSession } from "@/lib/session";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { requireCanonicalOrgAccess } from "@/lib/server-org-boundary";
import { isImpactStale, verifyOrgSiteAccess } from "@/lib/impact/org-scoped-queries";
import {
  computeClusterImpacts,
  getParetoAnalysis,
} from "@/lib/impact/compute-cluster-impact";

/**
 * GET /api/impact?organizationId=xxx&siteId=yyy
 * Get impact projection for site clusters. Computes on-the-fly if stale.
 */
export async function GET(request: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const siteId = searchParams.get("siteId");

    if (!organizationId || !siteId) {
      return apiError({
        message: "organizationId and siteId required",
        code: "BAD_REQUEST",
      });
    }

    const ctx = await requireCanonicalOrgAccess(organizationId, "finding:view", {
      requirePaid: true,
    });

    await verifyOrgSiteAccess(ctx, siteId);

    const stale = await isImpactStale(ctx, siteId);

    if (stale) {
      await computeClusterImpacts(siteId);
    }

    const pareto = await getParetoAnalysis(siteId);

    return apiSuccess(pareto);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * POST /api/impact
 * Force recompute impact scores for a site.
 */
export async function POST(request: Request) {
  try {
    await requireSession();
    const body = await request.json();
    const { organizationId, siteId } = body;

    if (!organizationId || !siteId) {
      return apiError({
        message: "organizationId and siteId required",
        code: "BAD_REQUEST",
      });
    }

    const ctx = await requireCanonicalOrgAccess(organizationId, "finding:manage", {
      requirePaid: true,
    });

    await verifyOrgSiteAccess(ctx, siteId);

    const results = await computeClusterImpacts(siteId);

    return apiSuccess({
      message: `Recomputed ${results.length} cluster impacts`,
      clusters: results.length,
    });
  } catch (error) {
    return apiError(error);
  }
}
