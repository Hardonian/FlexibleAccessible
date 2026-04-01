import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/auth-guard";
import { StakeholderRegistry } from "@aros/stakeholders";

const registry = new StakeholderRegistry();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 },
      );
    }

    await requireOrgAccess(organizationId, "stakeholders:view", {
      requirePaid: true,
    });

    const summary = await registry.getSummary();
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      error instanceof Error &&
      error.message.includes("do not have access")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("[api/stakeholders/summary]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
