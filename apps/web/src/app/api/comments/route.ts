import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requireOrgAccess } from "@/lib/auth-guard";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { ApiError } from "@aros/shared";

const commentSchema = z.object({
  findingId: z.string().min(1),
  organizationId: z.string().min(1),
  body: z.string().min(1).max(5000),
  parentId: z.string().optional(),
});

/**
 * GET /api/comments?findingId=xxx&organizationId=yyy
 * List threaded comments on a finding.
 */
export async function GET(request: Request) {
  try {
    const user = await requireSession();
    const { searchParams } = new URL(request.url);
    const findingId = searchParams.get("findingId");
    const organizationId = searchParams.get("organizationId");

    if (!findingId || !organizationId) {
      return apiError({
        message: "findingId and organizationId required",
        code: "BAD_REQUEST",
      });
    }

    const ctx = await requireOrgAccess(organizationId, "finding:view", {
      requirePaid: true,
    });

    const comments = await prisma.findingComment.findMany({
      where: {
        canonicalFindingId: findingId,
        organizationId: ctx.organizationId,
        parentId: null, // Top-level comments only
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        replies: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess(comments);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * POST /api/comments
 * Add a comment to a finding. Supports threaded replies via parentId.
 */
export async function POST(request: Request) {
  try {
    const user = await requireSession();
    const body = await request.json();
    const parsed = commentSchema.parse(body);

    const ctx = await requireOrgAccess(
      parsed.organizationId,
      "finding:manage",
      { requirePaid: true },
    );

    // Verify finding access
    const finding = await prisma.canonicalFinding.findFirst({
      where: {
        id: parsed.findingId,
        site: { workspace: { organizationId: ctx.organizationId } },
      },
    });

    if (!finding) {
      return apiError(ApiError.notFound("Finding not found"));
    }

    // If parentId, verify parent exists and belongs to same finding
    if (parsed.parentId) {
      const parent = await prisma.findingComment.findFirst({
        where: {
          id: parsed.parentId,
          canonicalFindingId: parsed.findingId,
        },
      });

      if (!parent) {
        return apiError(ApiError.notFound("Parent comment not found"));
      }
    }

    const comment = await prisma.findingComment.create({
      data: {
        canonicalFindingId: parsed.findingId,
        userId: user.id,
        organizationId: ctx.organizationId,
        body: parsed.body,
        parentId: parsed.parentId,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    return apiSuccess(comment, 201);
  } catch (error) {
    return apiError(error);
  }
}
