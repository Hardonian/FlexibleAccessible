import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOrgAccess } from "@/lib/auth-guard";
import {
  FeedbackLoopManager,
  FEEDBACK_STATUSES,
  FEEDBACK_CATEGORIES,
} from "@aros/stakeholders";

const feedbackManager = new FeedbackLoopManager();

const feedbackCreateSchema = z.object({
  organizationId: z.string().min(1),
  stakeholderId: z.string().min(1),
  stakeholderName: z.string().max(255).optional(),
  category: z.enum(FEEDBACK_CATEGORIES as unknown as [string, ...string[]]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  title: z.string().min(1).max(500),
  description: z.string().min(1).max(5000),
  source: z.string().max(255).optional(),
  tags: z.array(z.string().max(100)).max(20).optional(),
  attachments: z.array(z.string().url().max(2048)).max(10).optional(),
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
    const parsed = feedbackCreateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { organizationId, ...feedbackInput } = parsed.data;

    await requireOrgAccess(organizationId, "stakeholders:manage", {
      requirePaid: true,
    });

    const item = await feedbackManager.create({
      stakeholderId: feedbackInput.stakeholderId,
      stakeholderName: feedbackInput.stakeholderName ?? "Unknown",
      category: feedbackInput.category as any,
      priority: feedbackInput.priority as any,
      title: feedbackInput.title,
      description: feedbackInput.description,
      source: feedbackInput.source,
      tags: feedbackInput.tags,
      attachments: feedbackInput.attachments,
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
