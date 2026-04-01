import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireOrgAccess } from "@/lib/auth-guard";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { ApiError } from "@aros/shared";
import { createHmac, timingSafeEqual } from "crypto";

export const runtime = "nodejs";

/**
 * POST /api/deploy-webhook
 * Receives deploy notifications from Vercel, Netlify, or GitHub Actions.
 * Triggers a post-deploy scan for the matching site.
 * Signature verification per source.
 */
export async function POST(request: Request) {
  try {
    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());

    // Determine webhook source from headers
    let source: string;
    let isValid = false;

    if (headers["x-vercel-signature"]) {
      source = "VERCEL";
      isValid = verifyVercelSignature(body, headers["x-vercel-signature"]);
    } else if (headers["x-webhook-signature"]) {
      source = "NETLIFY";
      isValid = verifyNetlifySignature(body, headers["x-webhook-signature"]);
    } else if (headers["x-github-event"] === "deployment_status") {
      source = "GITHUB_DEPLOY";
      // GitHub webhooks use HMAC-SHA256 via x-hub-signature-256
      const githubSig = headers["x-hub-signature-256"];
      if (githubSig) {
        isValid = verifyGitHubSignature(body, githubSig);
      } else {
        // No signature header – only allow if no GitHub webhook secret is configured
        // (development fallback; in production GITHUB_WEBHOOK_SECRET should always be set)
        isValid = !process.env.GITHUB_WEBHOOK_SECRET;
      }
    } else if (headers["x-webhook-secret"]) {
      // Generic custom webhook validated via a shared secret header
      source = "CUSTOM";
      const customSecret = process.env.CUSTOM_WEBHOOK_SECRET;
      isValid =
        !!customSecret &&
        timingSafeEqual(
          Buffer.from(headers["x-webhook-secret"]),
          Buffer.from(customSecret),
        );
    } else {
      // Unknown source with no recognisable auth header – reject
      source = "UNKNOWN";
      isValid = false;
    }

    if (!isValid) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_SIGNATURE",
            message: "Invalid webhook signature",
          },
        },
        { status: 401 },
      );
    }

    const payload = JSON.parse(body);

    // Extract domain/URL from payload
    let deployUrl: string;
    let branch: string;

    switch (source) {
      case "VERCEL":
        deployUrl = payload.deployment?.url ?? payload.url ?? "";
        branch = payload.deployment?.meta?.githubCommitRef ?? "main";
        deployUrl = `https://${deployUrl}`;
        break;
      case "NETLIFY":
        deployUrl = payload.ssl_url ?? payload.url ?? "";
        branch = payload.branch ?? "main";
        break;
      case "GITHUB_DEPLOY":
        deployUrl =
          payload.deployment?.payload?.web_url ??
          payload.deployment?.target_url ??
          "";
        branch = payload.deployment?.ref ?? "main";
        break;
      default:
        deployUrl = payload.url ?? payload.deploy_url ?? "";
        branch = payload.branch ?? "main";
    }

    if (!deployUrl) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "NO_URL", message: "Could not extract deploy URL" },
        },
        { status: 400 },
      );
    }

    const domain = new URL(deployUrl).hostname;

    // Find matching deploy webhook configuration
    const deployWebhook = await prisma.deployWebhook.findFirst({
      where: {
        isActive: true,
        site: { domain },
      },
      include: {
        site: {
          include: {
            workspace: {
              include: {
                organization: {
                  include: {
                    subscription: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!deployWebhook) {
      // No matching config - acknowledge but don't scan
      return apiSuccess({
        message: "No matching deploy webhook configured",
        domain,
      });
    }

    // Additional security: Verify organization has active subscription for webhooks
    const subscription = deployWebhook.site.workspace.organization.subscription;
    if (!subscription || subscription.status !== "ACTIVE") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SUBSCRIPTION_INACTIVE",
            message: "Deploy webhooks require active subscription",
          },
        },
        { status: 403 },
      );
    }

    // Check branch filter
    if (
      deployWebhook.branches.length > 0 &&
      !deployWebhook.branches.includes(branch)
    ) {
      return apiSuccess({
        message: `Branch ${branch} not in monitored branches`,
        domain,
      });
    }

    // Create scan run
    const scanRun = await prisma.scanRun.create({
      data: {
        siteId: deployWebhook.siteId,
        status: "PENDING",
      },
    });

    // Enqueue scan
    const { Queue } = await import("bullmq");
    const { bullmqConnectionOptions } = await import("@aros/shared");
    const scanQueue = new Queue("scan", {
      connection: bullmqConnectionOptions(),
    });
    await scanQueue.add("scan", {
      scanRunId: scanRun.id,
      siteId: deployWebhook.siteId,
    });

    return apiSuccess({
      message: "Post-deploy scan triggered",
      scanRunId: scanRun.id,
      siteId: deployWebhook.siteId,
      domain,
      branch,
    });
  } catch (error) {
    return apiError(error);
  }
}

/**
 * GET /api/deploy-webhook?organizationId=xxx
 * List deploy webhook configurations for an org.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return apiError({
        message: "organizationId required",
        code: "BAD_REQUEST",
      });
    }

    await requireOrgAccess(organizationId, "integrations:view", {
      requirePaid: true,
    });

    const webhooks = await prisma.deployWebhook.findMany({
      where: { organizationId },
      include: { site: { select: { id: true, name: true, domain: true } } },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(webhooks);
  } catch (error) {
    return apiError(error);
  }
}

function verifyVercelSignature(body: string, signature: string): boolean {
  const secret = process.env.VERCEL_WEBHOOK_SECRET;
  if (!secret) return false;

  const hmac = createHmac("sha1", secret).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
  } catch {
    return false;
  }
}

function verifyNetlifySignature(body: string, signature: string): boolean {
  const secret = process.env.NETLIFY_WEBHOOK_SECRET;
  if (!secret) return false;

  const hmac = createHmac("sha256", secret).update(body).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(hmac), Buffer.from(signature));
  } catch {
    return false;
  }
}

function verifyGitHubSignature(body: string, signature: string): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return false;

  // GitHub sends "sha256=<hex-digest>"
  const expectedPrefix = "sha256=";
  if (!signature.startsWith(expectedPrefix)) return false;

  const hmac = createHmac("sha256", secret).update(body).digest("hex");
  const expected = `${expectedPrefix}${hmac}`;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
