import { NextResponse } from "next/server";
import { z } from "zod";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { ApiError } from "@aros/shared";
import { getPublicScanById, getPublicScanEvidenceState, toPublicScanApiPayload } from "@/lib/public-scan/validity";
import { createPublicScanResult, findRecentPublicScanForRateLimit } from "@/lib/public-scan/queries";
import { validatePublicScanTarget } from "@/lib/public-scan/target-validation";
import { createHash } from "crypto";

export const runtime = "nodejs";

const PUBLIC_SCAN_MAX_PAGES = 5;
const RATE_LIMIT_SECONDS = 300; // 5 minutes between scans per IP+domain

const scanSchema = z.object({
  domain: z.string().min(1, "Domain is required").max(2048),
});

async function normalizePublicScanDomain(rawDomain: string): Promise<{ domain: string; url: string }> {
  if (rawDomain.length > 2048) {
    throw ApiError.badRequest("URL is too long");
  }

  const candidate = rawDomain.startsWith("http://") || rawDomain.startsWith("https://")
    ? rawDomain
    : `https://${rawDomain}`;

  const parsed = new URL(candidate);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw ApiError.badRequest("Only HTTP and HTTPS URLs are allowed");
  }
  if (parsed.username || parsed.password) {
    throw ApiError.badRequest("URLs with embedded credentials are not allowed");
  }
  if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
    throw ApiError.badRequest("Only default HTTP(S) ports are allowed");
  }
  if (parsed.search || parsed.hash) {
    throw ApiError.badRequest("Query strings and URL fragments are not allowed");
  }
  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    throw ApiError.badRequest("Invalid domain format");
  }

  const normalizedDomain = parsed.hostname.toLowerCase().replace(/\.$/, "");
  await validatePublicScanTarget(normalizedDomain);
  return {
    domain: normalizedDomain,
    url: `${parsed.protocol}//${normalizedDomain}${parsed.pathname === "/" ? "" : parsed.pathname}`
  };
}

/**
 * POST /api/public-scan
 * Trigger an anonymous instant accessibility scan (no auth required).
 * Rate limited per IP+domain to prevent abuse.
 * Returns a scan ID that can be polled or linked to a public results page.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = scanSchema.parse(body);

    const { domain, url } = await normalizePublicScanDomain(parsed.domain.trim());

    // Rate limit check: hash IP + domain for privacy
    const forwarded = request.headers.get("x-forwarded-for");
    const ip =
      forwarded?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const ipHash = createHash("sha256").update(`${ip}:${domain}`).digest("hex");

    const recentScan = await findRecentPublicScanForRateLimit({
      domain,
      ipHash,
      rateLimitSeconds: RATE_LIMIT_SECONDS,
    });

    if (recentScan) {
      const remainingSeconds = Math.max(
        0,
        Math.ceil(
          (recentScan.createdAt.getTime() +
            RATE_LIMIT_SECONDS * 1000 -
            Date.now()) /
            1000,
        ),
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: `Please wait ${remainingSeconds} seconds before scanning this domain again.`,
            details: { remainingSeconds, scanId: recentScan.id },
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(remainingSeconds),
          },
        },
      );
    }

    // Create scan record
    const scan = await createPublicScanResult({
      domain,
      url,
      status: "PENDING",
      maxPages: PUBLIC_SCAN_MAX_PAGES,
      ipHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    // Enqueue the scan job (fire and forget - client polls for results)
    const { Queue } = await import("bullmq");
    const { bullmqConnectionOptions } = await import("@aros/shared");
    const publicScanQueue = new Queue("public-scan", {
      connection: bullmqConnectionOptions(),
    });
    await publicScanQueue.add(
      "public-scan",
      {
        publicScanResultId: scan.id,
        domain,
        url,
        maxPages: PUBLIC_SCAN_MAX_PAGES,
      },
      {
        attempts: 1,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    );

    return apiSuccess(
      {
        id: scan.id,
        domain: scan.domain,
        status: scan.status,
        resultsUrl: `/scan/${encodeURIComponent(domain)}`,
        pollUrl: `/api/public-scan/${scan.id}`,
      },
      201,
    );
  } catch (error) {
    return apiError(error);
  }
}

/**
 * GET /api/public-scan/[id]
 * Poll for public scan results.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return apiError(ApiError.badRequest("Scan ID required"));
    }

    const scan = await getPublicScanById(id);

    if (!scan) {
      return apiError(ApiError.notFound("Scan not found"));
    }
    if (getPublicScanEvidenceState(scan) === "expired") {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "SCAN_EXPIRED",
            message:
              "Scan result has expired. Start a new scan to generate fresh evidence.",
            details: {
              evidenceState: "expired",
              expired: true,
            },
          },
        },
        { status: 410 },
      );
    }

    return apiSuccess(toPublicScanApiPayload(scan));
  } catch (error) {
    return apiError(error);
  }
}
