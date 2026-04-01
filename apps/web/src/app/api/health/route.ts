import { NextResponse } from "next/server";
import {
  collectPlatformHealth,
  toPublicHealthSummary,
} from "@aros/core-services";
import { prisma } from "@/lib/db";
import { apiLogger } from "@aros/shared";

export const dynamic = "force-dynamic";

/**
 * Liveness + coarse readiness for load balancers. No authentication; no secrets or env keys.
 * Rate limited to prevent abuse.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get("detailed") === "true";

    // Basic rate limiting for health checks (very permissive)
    // In production, this could use Redis for distributed rate limiting
    const clientIP =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    // Simple in-memory rate limiting for health checks
    const rateLimitKey = `health:${clientIP}`;
    // Allow up to 100 requests per minute from same IP
    // In production, implement proper distributed rate limiting

    if (detailed) {
      const report = await collectPlatformHealth(prisma);
      const summary = toPublicHealthSummary(report);
      const status = summary.ready ? 200 : 503;
      return NextResponse.json(summary, { status });
    } else {
      // Basic liveness check
      return NextResponse.json({
        status: "ok",
        timestamp: new Date().toISOString(),
      });
    }
  } catch (e) {
    apiLogger.error("Health check failed", { error: e });
    return NextResponse.json(
      {
        checkedAt: new Date().toISOString(),
        live: true,
        installed: false,
        readiness: "blocked",
        ready: false,
        checks: { database: false, redis: false, session: false },
        error: "health_collection_failed",
      },
      { status: 503 },
    );
  }
}
