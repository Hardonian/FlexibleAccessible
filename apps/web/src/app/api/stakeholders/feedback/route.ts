// ─── Feedback API ──────────────────────────────────────────────────────
// GET: List feedback items
// POST: Create feedback item

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasPermission } from "@aros/config";
import { FeedbackLoopManager } from "@aros/stakeholders";

const feedbackManager = new FeedbackLoopManager();

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

    const status = searchParams.get("status") as any;
    const category = searchParams.get("category") as any;
    const stakeholderId = searchParams.get("stakeholderId");

    let items;
    if (stakeholderId) {
      items = await feedbackManager.listByStakeholder(stakeholderId);
    } else if (status) {
      items = await feedbackManager.listByStatus(status);
    } else if (category) {
      items = await feedbackManager.listByCategory(category);
    } else {
      items = await feedbackManager.exportAll();
    }

    const summary = await feedbackManager.getSummary();

    return NextResponse.json({ items, summary });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    const user = await requireSession();
    const body = await request.json();

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
    console.error("[api/stakeholders/feedback POST]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
