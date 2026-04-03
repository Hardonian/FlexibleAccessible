import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { ApiError } from "@aros/shared";
import { createHash } from "crypto";
import { lookup } from "node:dns/promises";

export const runtime = "nodejs";

const PUBLIC_SCAN_MAX_PAGES = 5;
const RATE_LIMIT_SECONDS = 300; // 5 minutes between scans per IP+domain

const scanSchema = z.object({
  domain: z.string().min(1, "Domain is required").max(253),
});

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "169.254.169.254", // cloud metadata endpoint
]);

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => Number.isNaN(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254)
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:");
}

export function isPrivateOrLoopbackAddress(address: string): boolean {
  return address.includes(":") ? isPrivateIpv6(address) : isPrivateIpv4(address);
}

export async function validatePublicScanTarget(hostname: string): Promise<void> {
  const normalizedHostname = hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(normalizedHostname) || normalizedHostname.endsWith(".local")) {
    throw new ApiError(
      "Private, loopback, and local network hosts are not allowed for public scans.",
      "PUBLIC_SCAN_HOST_BLOCKED",
      400,
    );
  }

  let resolvedAddress: string;
  try {
    const { address } = await lookup(normalizedHostname);
    resolvedAddress = address;
  } catch {
    throw ApiError.badRequest("Domain could not be resolved. Please enter a public hostname.");
  }
  if (isPrivateOrLoopbackAddress(resolvedAddress)) {
    throw new ApiError(
      "Resolved host points to a private or loopback address and cannot be scanned publicly.",
      "PUBLIC_SCAN_HOST_BLOCKED",
      400,
      { hostname: normalizedHostname },
    );
  }
}

async function normalizePublicScanDomain(rawDomain: string): Promise<{ domain: string; url: string }> {
  const candidate = rawDomain.startsWith("http://") || rawDomain.startsWith("https://")
    ? rawDomain
    : `https://${rawDomain}`;

  const parsed = new URL(candidate);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw ApiError.badRequest("Only HTTP and HTTPS URLs are allowed");
  }
  if (!parsed.hostname || !parsed.hostname.includes(".")) {
    throw ApiError.badRequest("Invalid domain format");
  }

  const normalizedDomain = parsed.hostname.toLowerCase();
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
      return apiError(ApiError.badRequest("Scan ID required"));
    }

    const scan = await prisma.publicScanResult.findUnique({ where: { id } });

    if (!scan) {
      return apiError(ApiError.notFound("Scan not found"));
    }
    if (scan.expiresAt && scan.expiresAt <= new Date()) {
      return apiError(new ApiError("Scan result has expired. Start a new scan to generate fresh evidence.", "SCAN_EXPIRED", 410));
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
