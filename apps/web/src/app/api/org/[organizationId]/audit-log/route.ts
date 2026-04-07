import { NextResponse } from "next/server";
import { requireCanonicalOrgAccess } from "@/lib/server-org-boundary";
import { runOrgScopedQuery } from "@/lib/route-data-boundary";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api-utils";
import { z } from "zod";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
  format: z.enum(["json", "csv"]).optional().default("json"),
});

/**
 * GET /api/org/[organizationId]/audit-log
 * Org-scoped audit trail for buyers and auditors. Requires audit:view + paid org.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ organizationId: string }> },
) {
  try {
    const { organizationId } = await context.params;
    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      limit: searchParams.get("limit") ?? undefined,
      format: searchParams.get("format") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query" }, { status: 400 });
    }

    const ctx = await requireCanonicalOrgAccess(organizationId, "audit:view", {
      requirePaid: true,
    });

    const { limit, format } = parsed.data;

    const scoped = await runOrgScopedQuery(ctx, async (oid) =>
      prisma.auditLog.findMany({
        where: { organizationId: oid },
        orderBy: { createdAt: "desc" },
        take: limit,
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          userId: true,
          metadata: true,
          ipAddress: true,
          createdAt: true,
        },
      }),
    );
    if (!scoped.ok) {
      return NextResponse.json(
        { error: scoped.message },
        { status: scoped.statusCode ?? 500 },
      );
    }
    const rows = scoped.data;

    if (format === "csv") {
      const header = "id,createdAt,action,entityType,entityId,userId,ipAddress\n";
      const body = rows
        .map((r) =>
          [
            r.id,
            r.createdAt.toISOString(),
            csvEscape(r.action),
            csvEscape(r.entityType ?? ""),
            csvEscape(r.entityId ?? ""),
            csvEscape(r.userId ?? ""),
            csvEscape(r.ipAddress ?? ""),
          ].join(","),
        )
        .join("\n");
      return new NextResponse(header + body, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="audit-log-${organizationId.slice(0, 8)}.csv"`,
        },
      });
    }

    return NextResponse.json({
      organizationId,
      generatedAt: new Date().toISOString(),
      disclaimer:
        "Administrative audit of in-app actions. Not a legal chain-of-custody log; metadata shape may evolve.",
      count: rows.length,
      entries: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return apiError(e);
  }
}

function csvEscape(s: string): string {
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}
