// ─── Stakeholder Registry API ──────────────────────────────────────────
// GET: List stakeholders with filtering
// POST: Create new stakeholder

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasPermission } from "@aros/config";
import {
  StakeholderRegistry,
  stakeholderCreateSchema,
} from "@aros/stakeholders";

const registry = new StakeholderRegistry();

export async function GET(request: Request) {
  try {
    const user = await requireSession();
    const { searchParams } = new URL(request.url);

    // Parse filter params
    const segment = searchParams.get("segment") || undefined;
    const power = searchParams.get("power") || undefined;
    const interest = searchParams.get("interest") || undefined;
    const engagementStatus = searchParams.get("engagementStatus") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const sortBy = (searchParams.get("sortBy") || "name") as
      | "name"
      | "segment"
      | "power"
      | "interest"
      | "engagementStatus"
      | "createdAt";
    const sortOrder = (searchParams.get("sortOrder") || "asc") as
      | "asc"
      | "desc";

    // Get membership for permission check
    const organizationId = searchParams.get("organizationId");
    if (organizationId) {
      const membership = await prisma.membership.findFirst({
        where: { userId: user.id, organizationId },
      });
      if (!membership || !hasPermission(membership.role, "stakeholders:view")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const result = await registry.list({
      segment: segment as any,
      power: power as any,
      interest: interest as any,
      engagementStatus: engagementStatus as any,
      search,
      page,
      pageSize,
      sortBy,
      sortOrder,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/stakeholders]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireSession();
    const body = await request.json();

    // Validate input
    const input = stakeholderCreateSchema.parse(body);

    // Get organization for permission check
    const organizationId = body.organizationId;
    if (organizationId) {
      const membership = await prisma.membership.findFirst({
        where: { userId: user.id, organizationId },
      });
      if (
        !membership ||
        !hasPermission(membership.role, "stakeholders:manage")
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const stakeholder = await registry.create(input);

    return NextResponse.json(stakeholder, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/stakeholders POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
