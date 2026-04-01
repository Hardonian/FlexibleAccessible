import { NextResponse } from "next/server";
import { requireOrgAccess } from "@/lib/auth-guard";
import {
  FeedbackLoopManager,
  FEEDBACK_STATUSES,
  FEEDBACK_CATEGORIES,
} from "@aros/stakeholders";

const feedbackManager = new FeedbackLoopManager();

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

    const statusParam = searchParams.get("status");
    const categoryParam = searchParams.get("category");
    const stakeholderId = searchParams.get("stakeholderId");

    let items;
    if (stakeholderId) {
      items = await feedbackManager.listByStakeholder(stakeholderId);
    } else if (
      statusParam &&
      (FEEDBACK_STATUSES as readonly string[]).includes(statusParam)
    ) {
      items = await feedbackManager.listByStatus(
        statusParam as (typeof FEEDBACK_STATUSES)[number],
      );
    } else if (
      categoryParam &&
      (FEEDBACK_CATEGORIES as readonly string[]).includes(categoryParam)
    ) {
      items = await feedbackManager.listByCategory(
        categoryParam as (typeof FEEDBACK_CATEGORIES)[number],
      );
    } else {
      items = await feedbackManager.exportAll();
    }

    const summary = await feedbackManager.getSummary();

    return NextResponse.json({ items, summary });
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
    console.error("[api/stakeholders/feedback]", error);
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

    const item = await feedbackManager.create({
      stakeholderId: body.stakeholderId,
      stakeholderName: body.stakeholderName || "Unknown",
      category: body.category,
      priority: body.priority || "MEDIUM",
      title: body.title,
      description: body.description,
      source: body.source,
      tags: body.tags,
      attachments: body.attachments,
    });

    return NextResponse.json(item, { status: 201 });
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
    console.error("[api/stakeholders/feedback POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
