import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgAccess } from "@/lib/auth-guard";
import { PowerInterestMatrix } from "@aros/stakeholders";

const matrix = new PowerInterestMatrix();

const powerInterestSchema = z.object({
  organizationId: z.string().min(1),
  stakeholderId: z.string().min(1),
  stakeholderName: z.string().min(1).max(500),
  segment: z.string().min(1).max(200),
  power: z.enum(["HIGH", "MEDIUM", "LOW"]),
  interest: z.enum(["HIGH", "MEDIUM", "LOW"]),
  notes: z.string().max(5000).optional(),
});

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

    const summary = await matrix.getMatrixSummary();
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
    console.error("[api/stakeholders/power-interest]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = powerInterestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const {
      organizationId,
      stakeholderId,
      stakeholderName,
      segment,
      power,
      interest,
      notes,
    } = parsed.data;

    const ctx = await requireOrgAccess(organizationId, "stakeholders:manage", {
      requirePaid: true,
    });

    const entry = await matrix.createAssessment({
      stakeholderId,
      stakeholderName,
      segment,
      power,
      interest,
      notes,
      assessedBy: ctx.user.id,
    });

    return NextResponse.json(entry, { status: 201 });
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
    console.error("[api/stakeholders/power-interest POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
