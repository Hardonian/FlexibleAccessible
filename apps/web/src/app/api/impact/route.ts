import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requireOrgAccess } from "@/lib/auth-guard";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { ApiError } from "@aros/shared";
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
    const user = await requireSession();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const siteId = searchParams.get("siteId");

    if (!organizationId || !siteId) {
      return apiError({
        message: "organizationId and siteId required",
        code: "BAD_REQUEST",
      });
    }

    const ctx = await requireOrgAccess(organizationId, "finding:view", {
      requirePaid: true,
    });

    // Verify site access
    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        workspace: { organizationId: ctx.organizationId },
      },
    });

    if (!site) {
      return apiError(ApiError.notFound("Site not found"));
    }

    // Check if impacts are stale (> 1 hour old)
    const latestImpact = await prisma.clusterImpact.findFirst({
      where: { cluster: { siteId } },
      orderBy: { computedAt: "desc" },
    });

    const isStale =
      !latestImpact ||
      Date.now() - latestImpact.computedAt.getTime() > 60 * 60 * 1000;

    if (isStale) {
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
    const user = await requireSession();
    const body = await request.json();
    const { organizationId, siteId } = body;

    if (!organizationId || !siteId) {
      return apiError({
        message: "organizationId and siteId required",
        code: "BAD_REQUEST",
      });
    }

    const ctx = await requireOrgAccess(organizationId, "finding:manage", {
      requirePaid: true,
    });

    const site = await prisma.site.findFirst({
      where: {
        id: siteId,
        workspace: { organizationId: ctx.organizationId },
      },
    });

    if (!site) {
      return apiError(ApiError.notFound("Site not found"));
    }

    const results = await computeClusterImpacts(siteId);

    return apiSuccess({
      message: `Recomputed ${results.length} cluster impacts`,
      clusters: results.length,
    });
  } catch (error) {
    return apiError(error);
  }
}
