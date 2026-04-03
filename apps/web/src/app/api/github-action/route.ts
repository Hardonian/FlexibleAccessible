import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCanonicalOrgAccess } from "@/lib/server-org-boundary";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { ApiError } from "@aros/shared";
import { Queue } from "bullmq";
import { bullmqConnectionOptions } from "@aros/shared";
import { createPendingScanRun, findGithubActionSite } from "@/lib/integrations/org-scoped-queries";

export const runtime = "nodejs";

const scanActionSchema = z.object({
  organizationId: z.string().min(1),
  siteId: z.string().min(1),
  /** PR number for commenting results back. */
  pullRequestNumber: z.number().optional(),
  /** Repository full name (owner/repo). */
  repoFullName: z.string().optional(),
  /** SHA of the commit that triggered the scan. */
  commitSha: z.string().optional(),
  /** Fail threshold: if score drops below this, return non-zero exit. */
  failThreshold: z.number().min(0).max(100).optional(),
  /** Fail on severity: if any issues of this severity exist, return non-zero. */
  failOn: z.enum(["critical", "serious", "moderate", "minor"]).optional(),
});

/**
 * POST /api/github-action
 * Triggered by the AROS GitHub Action. Starts a scan and optionally comments
 * results back on a PR.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = scanActionSchema.parse(body);
    const ctx = await requireCanonicalOrgAccess(parsed.organizationId, "scan:start", {
      requirePaid: true,
    });

    // Verify site exists and user has access
    const site = await findGithubActionSite(ctx, parsed.siteId);

    if (!site) {
      return apiError(ApiError.notFound("Site not found"));
    }

    // Create scan run
    const scanRun = await createPendingScanRun(site.id);

    // Enqueue scan
    const scanQueue = new Queue("scan", {
      connection: bullmqConnectionOptions(),
    });
    await scanQueue.add(
      "scan",
      {
        scanRunId: scanRun.id,
        siteId: site.id,
      },
      {
        attempts: 1,
        removeOnComplete: { count: 100 },
      },
    );

    return apiSuccess({
      scanRunId: scanRun.id,
      siteId: site.id,
      siteName: site.name,
      status: "PENDING",
      pollUrl: `/api/github-action/status/${scanRun.id}?organizationId=${encodeURIComponent(parsed.organizationId)}`,
      failThreshold: parsed.failThreshold,
      failOn: parsed.failOn,
      pullRequestNumber: parsed.pullRequestNumber,
      repoFullName: parsed.repoFullName,
      commitSha: parsed.commitSha,
    });
  } catch (error) {
    return apiError(error);
  }
}
