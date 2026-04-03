import { z } from "zod";
import { requireSession } from "@/lib/session";
import { requireCanonicalOrgAccess } from "@/lib/server-org-boundary";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { createFindingComment, listFindingComments } from "@/lib/comments/org-scoped-queries";

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
    await requireSession();
    const { searchParams } = new URL(request.url);
    const findingId = searchParams.get("findingId");
    const organizationId = searchParams.get("organizationId");

    if (!findingId || !organizationId) {
      return apiError({
        message: "findingId and organizationId required",
        code: "BAD_REQUEST",
      });
    }

    const ctx = await requireCanonicalOrgAccess(organizationId, "finding:view", {
      requirePaid: true,
    });

    const comments = await listFindingComments(ctx, findingId);

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

    const ctx = await requireCanonicalOrgAccess(
      parsed.organizationId,
      "finding:manage",
      { requirePaid: true },
    );

    const comment = await createFindingComment(ctx, {
      findingId: parsed.findingId,
      userId: user.id,
      body: parsed.body,
      parentId: parsed.parentId,
    });

    return apiSuccess(comment, 201);
  } catch (error) {
    return apiError(error);
  }
}
