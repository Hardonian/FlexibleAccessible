import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { createHash } from "crypto";

export const runtime = "nodejs";

const PUBLIC_SCAN_MAX_PAGES = 5;
const RATE_LIMIT_SECONDS = 300; // 5 minutes between scans per IP+domain

const scanSchema = z.object({
  domain: z
    .string()
    .min(1, "Domain is required")
    .max(253)
    .regex(
      /^(?:https?:\/\/)?(?:www\.)?([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,})(?:\/.*)?$/,
      "Invalid domain format",
    ),
});

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

    // Normalize domain: strip protocol and trailing slashes
    let domain = parsed.domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
    const url = domain.startsWith("http") ? domain : `https://${domain}`;

    // Rate limit check: hash IP + domain for privacy
    const forwarded = request.headers.get("x-forwarded-for");
    const ip =
      forwarded?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const ipHash = createHash("sha256").update(`${ip}:${domain}`).digest("hex");

    const recentScan = await prisma.publicScanResult.findFirst({
      where: {
        domain,
        ipHash,
        createdAt: { gte: new Date(Date.now() - RATE_LIMIT_SECONDS * 1000) },
      },
      orderBy: { createdAt: "desc" },
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
    const scan = await prisma.publicScanResult.create({
      data: {
        domain,
        url,
        status: "PENDING",
        maxPages: PUBLIC_SCAN_MAX_PAGES,
        ipHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h TTL
      },
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
      return apiError({ message: "Scan ID required", code: "BAD_REQUEST" });
    }

    const scan = await prisma.publicScanResult.findUnique({
      where: { id },
    });

    if (!scan) {
      return apiError({ message: "Scan not found", code: "NOT_FOUND" });
    }

    return apiSuccess({
      id: scan.id,
      domain: scan.domain,
      status: scan.status,
      score: scan.score,
      totalViolations: scan.totalViolations,
      criticalCount: scan.criticalCount,
      seriousCount: scan.seriousCount,
      moderateCount: scan.moderateCount,
      minorCount: scan.minorCount,
      pagesScanned: scan.pagesScanned,
      violations: scan.violations,
      screenshotKeys: scan.screenshotKeys,
      createdAt: scan.createdAt,
      completedAt: scan.completedAt,
    });
  } catch (error) {
    return apiError(error);
  }
}
