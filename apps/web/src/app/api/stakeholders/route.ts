import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/auth-guard";
import {
  StakeholderRegistry,
  stakeholderCreateSchema,
  type StakeholderSegment,
  type PowerLevel,
  type InterestLevel,
  type EngagementStatus,
} from "@aros/stakeholders";

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

    const segment = searchParams.get("segment") as StakeholderSegment | null;
    const power = searchParams.get("power") as PowerLevel | null;
    const interest = searchParams.get("interest") as InterestLevel | null;
    const engagementStatus = searchParams.get(
      "engagementStatus",
    ) as EngagementStatus | null;
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

    const result = await registry.list({
      segment: segment ?? undefined,
      power: power ?? undefined,
      interest: interest ?? undefined,
      engagementStatus: engagementStatus ?? undefined,
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
    if (
      error instanceof Error &&
      error.message.includes("do not have access")
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    const body = await request.json();
    const organizationId = body.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 },
      );
    }

    await requireOrgAccess(organizationId, "stakeholders:manage", {
      requirePaid: true,
    });

    const input = stakeholderCreateSchema.parse({
      name: body.name,
      email: body.email,
      organization: organizationId,
      role: body.role,
      segment: body.segment,
      power: body.power,
      interest: body.interest,
      engagementStatus: body.engagementStatus,
      phone: body.phone,
      preferredChannel: body.preferredChannel,
      accessibilityNeeds: body.accessibilityNeeds,
      notes: body.notes,
      tags: body.tags,
      underrepresentedGroups: body.underrepresentedGroups,
      region: body.region,
      language: body.language,
      metadata: body.metadata,
    });

    const stakeholder = await registry.create(input);

    return NextResponse.json(stakeholder, { status: 201 });
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
    console.error("[api/stakeholders POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
