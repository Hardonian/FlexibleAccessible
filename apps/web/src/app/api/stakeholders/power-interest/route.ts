// ─── Power/Interest Matrix API ─────────────────────────────────────────
// GET: Matrix summary
// POST: Create assessment

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasPermission } from "@aros/config";
import { PowerInterestMatrix } from "@aros/stakeholders";

const matrix = new PowerInterestMatrix();

export async function GET(request: Request) {
  try {
    const user = await requireSession();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (organizationId) {
      const membership = await prisma.membership.findFirst({
        where: { userId: user.id, organizationId },
      });
      if (!membership || !hasPermission(membership.role, "stakeholders:view")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const summary = await matrix.getMatrixSummary();
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/stakeholders/power-interest]", error);
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

    const entry = await matrix.createAssessment({
      stakeholderId: body.stakeholderId,
      stakeholderName: body.stakeholderName,
      segment: body.segment,
      power: body.power,
      interest: body.interest,
      notes: body.notes,
      assessedBy: user.id,
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/stakeholders/power-interest POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
