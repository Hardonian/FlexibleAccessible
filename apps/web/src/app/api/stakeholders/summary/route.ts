// ─── Stakeholder Summary API ───────────────────────────────────────────
// GET: Stakeholder analysis summary (counts, distributions)

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasPermission } from "@aros/config";
import { StakeholderRegistry } from "@aros/stakeholders";

const registry = new StakeholderRegistry();

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

    const summary = await registry.getSummary();
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[api/stakeholders/summary]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
