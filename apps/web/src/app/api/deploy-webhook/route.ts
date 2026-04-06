import { NextResponse } from "next/server";
import { requireCanonicalOrgAccess } from "@/lib/server-org-boundary";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { ApiError } from "@aros/shared";
import { createHmac, timingSafeEqual } from "crypto";
import { createPendingScanRun, findActiveDeployWebhookByDomain, listDeployWebhooks } from "@/lib/integrations/org-scoped-queries";
import { deployWebhookSubscriptionAllowed } from "@/lib/deploy-webhook-plan-gate";

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
      }
      // No signature header and no secret configured → reject (fail-closed)
    } else if (headers["x-webhook-secret"]) {
      // Generic custom webhook validated via a shared secret header
      source = "CUSTOM";
      const customSecret = process.env.CUSTOM_WEBHOOK_SECRET;
      if (
        customSecret &&
        headers["x-webhook-secret"].length === customSecret.length
      ) {
        isValid = timingSafeEqual(
          Buffer.from(headers["x-webhook-secret"]),
          Buffer.from(customSecret),
        );
      }
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

    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body);
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_JSON",
            message: "Request body is not valid JSON",
          },
        },
        { status: 400 },
      );
    }

    // Extract domain/URL from payload
    let deployUrl = "";
    let branch = "main";

    const get = (
      obj: Record<string, unknown>,
      key: string,
    ): string | undefined => {
      const val = obj[key];
      return typeof val === "string" ? val : undefined;
    };
    const getNested = (
      obj: Record<string, unknown>,
      key: string,
    ): Record<string, unknown> | undefined => {
      const val = obj[key];
      return typeof val === "object" && val !== null
        ? (val as Record<string, unknown>)
        : undefined;
    };

    switch (source) {
      case "VERCEL": {
        const dep = getNested(payload, "deployment");
        deployUrl = get(dep ?? {}, "url") ?? get(payload, "url") ?? "";
        const meta = dep ? getNested(dep, "meta") : undefined;
        branch = meta ? (get(meta, "githubCommitRef") ?? "main") : "main";
        deployUrl = `https://${deployUrl}`;
        break;
      }
      case "NETLIFY":
        deployUrl = get(payload, "ssl_url") ?? get(payload, "url") ?? "";
        branch = get(payload, "branch") ?? "main";
        break;
      case "GITHUB_DEPLOY": {
        const ghDep = getNested(payload, "deployment");
        const ghPayload = ghDep ? getNested(ghDep, "payload") : undefined;
        deployUrl =
          (ghPayload ? get(ghPayload, "web_url") : undefined) ??
          (ghDep ? get(ghDep, "target_url") : undefined) ??
          "";
        branch = ghDep ? (get(ghDep, "ref") ?? "main") : "main";
        break;
      }
      default:
        deployUrl = get(payload, "url") ?? get(payload, "deploy_url") ?? "";
        branch = get(payload, "branch") ?? "main";
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
    const deployWebhook = await findActiveDeployWebhookByDomain(domain);

    if (!deployWebhook) {
      // No matching config - acknowledge but don't scan
      return apiSuccess({
        message: "No matching deploy webhook configured",
        domain,
      });
    }

    // Deploy-triggered scans are a Professional+ automation; require paid access in good standing.
    const subscription = deployWebhook.site.workspace.organization.subscription;
    if (!deployWebhookSubscriptionAllowed(subscription)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "PLAN_UPGRADE_REQUIRED",
            message:
              "Deploy webhooks require Professional (or Enterprise) with an active or trialing subscription.",
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
    const scanRun = await createPendingScanRun(deployWebhook.siteId);

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

    const ctx = await requireCanonicalOrgAccess(organizationId, "integrations:view", {
      requirePaid: true,
      planMinimum: "PROFESSIONAL",
    });

    const webhooks = await listDeployWebhooks(ctx);

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
