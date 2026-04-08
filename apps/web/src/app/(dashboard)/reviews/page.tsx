import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import type { Prisma, ReviewType } from "@aros/db";
import Link from "next/link";
import { updateReviewAction } from "./actions";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { resolveDashboardOrgMembership } from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { hasPermission } from "@aros/config";
import { StatusBadge } from "@aros/ui";
import { TruthBadge } from "@/components/truth/truth-badge";

export const metadata = { title: "Reviews" };

const REVIEW_REASON: Record<ReviewType, string> = {
  ALT_TEXT_REVIEW: "Visual context ambiguity for alt text quality.",
  CONTENT_CLARITY: "Language clarity or meaning requires human interpretation.",
  KEYBOARD_FLOW: "Keyboard and focus order behavior can be context-sensitive.",
  SCREEN_READER: "Landmark and reading-order behavior needs AT verification.",
  SUGGESTION_REVIEW: "Generated suggestion requires reviewer confirmation.",
  MANUAL_AUDIT: "Rule requires explicit human verification.",
};

const REVIEW_REASON_STATE: Record<
  ReviewType,
  "requires_human_review" | "partial"
> = {
  ALT_TEXT_REVIEW: "partial",
  CONTENT_CLARITY: "requires_human_review",
  KEYBOARD_FLOW: "requires_human_review",
  SCREEN_READER: "requires_human_review",
  SUGGESTION_REVIEW: "partial",
  MANUAL_AUDIT: "requires_human_review",
};

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ review_error?: string }>;
}) {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const params = await searchParams;
  let canViewSystem = false;
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      select: { role: true },
    });
    for (const membership of memberships) {
      if (hasPermission(membership.role, "org:system:view")) {
        canViewSystem = true;
        break;
      }
    }
  } catch {
    canViewSystem = false;
  }

  const reviewError = params.review_error
    ? ({
        missing_task: "Review task not specified.",
        invalid_status: "Invalid review status.",
        not_found: "Review task not found.",
        no_org: "Could not determine organization for this review.",
        forbidden: "You do not have permission to update this review.",
        update_failed: "Failed to update review. Please try again.",
        stale_session:
          "Your organization context changed. Refresh the page and try again.",
      }[params.review_error] ?? "An error occurred.")
    : null;

  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind === "platform_blocked") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Review Queue</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Reviews require a working database"
          showSystemLink={canViewSystem}
        >
          <p>
            The review queue cannot be loaded until core data services are
            healthy.
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Review Queue</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Could not verify organization"
          showSystemLink={canViewSystem}
        >
          <p>{orgRes.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "none") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Review Queue</h1>
        <RouteReliabilityNotice
          variant="info"
          title="No organization membership"
        >
          <p>You need an organization to view review tasks.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const reviewListInclude = {
    assignee: { select: { name: true, email: true } },
    suggestion: {
      select: { type: true, originalCode: true, suggestedCode: true },
    },
    _count: { select: { evidence: true, controlPlaneEvidence: true } },
  } satisfies Prisma.ReviewTaskInclude;

  type ReviewListRow = Prisma.ReviewTaskGetPayload<{
    include: typeof reviewListInclude;
  }>;

  let tasks: ReviewListRow[] = [];
  let loadError: string | null = null;
  try {
    tasks = await prisma.reviewTask.findMany({
      where: {
        suggestion: {
          OR: [
            {
              finding: {
                site: { workspace: { organizationId: orgRes.organizationId } },
              },
            },
            {
              cluster: {
                site: { workspace: { organizationId: orgRes.organizationId } },
              },
            },
          ],
        },
      },
      include: reviewListInclude,
      take: 80,
    });
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Database error";
    console.error("[reviews] query failed", e);
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Review Queue</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Review queue unavailable"
          showSystemLink={canViewSystem}
        >
          <p>Could not load review tasks ({loadError}).</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const sortedTasks = [...tasks].sort((a, b) => {
    const priority = (task: ReviewListRow) => {
      const ageHours = (Date.now() - task.createdAt.getTime()) / 3_600_000;
      const statusScore =
        task.status === "PENDING" ? 4 : task.status === "IN_PROGRESS" ? 2 : 0;
      const reviewRisk = task.type === "MANUAL_AUDIT" || task.type === "KEYBOARD_FLOW" ? 2 : 1;
      const staleBoost = ageHours > 72 ? 2 : 0;
      return statusScore + reviewRisk + staleBoost;
    };

    const diff = priority(b) - priority(a);
    if (diff !== 0) return diff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const pendingCount = tasks.filter((t) => t.status === "PENDING").length;
  const inProgressCount = tasks.filter(
    (t) => t.status === "IN_PROGRESS",
  ).length;
  const unresolvedCount = tasks.filter(
    (t) => t.status === "PENDING" || t.status === "IN_PROGRESS",
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Review Queue</h1>
        <p className="text-slate-500 mt-1">
          {pendingCount} pending, {inProgressCount} in progress, {unresolvedCount} unresolved
        </p>
      </div>

      <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
        Automated scanners reduce manual effort, but do not establish final conformance on their own.
        Use this queue to document reviewer outcomes and rationale.
      </div>

      {reviewError && (
        <RouteReliabilityNotice variant="error" title="Review update failed">
          <p>{reviewError}</p>
        </RouteReliabilityNotice>
      )}

      {sortedTasks.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-500">No review tasks yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedTasks.map((task) => {
            const ageHours = Math.floor((Date.now() - task.createdAt.getTime()) / 3_600_000);
            const stale = ageHours > 72;

            return (
              <article key={task.id} className="card space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <ReviewStatusBadge status={task.status} />
                      <TruthBadge state={REVIEW_REASON_STATE[task.type]} />
                      {stale ? (
                        <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                          Stale queue item
                        </span>
                      ) : null}
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
                    {task.description ? (
                      <p className="text-sm text-slate-600">{task.description}</p>
                    ) : null}
                    <p className="text-xs text-slate-500">{REVIEW_REASON[task.type]}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-400">
                      {task.assignee && (
                        <span>
                          Assigned to: {task.assignee.name ?? task.assignee.email}
                        </span>
                      )}
                      <span>Evidence: {task._count.evidence + task._count.controlPlaneEvidence}</span>
                      <span>Age: {ageHours}h</span>
                    </div>
                  </div>
                  {task.suggestion && task.suggestionId ? (
                    <Link
                      href={`/remediation/${task.suggestionId}`}
                      className="btn-ghost text-xs"
                    >
                      View suggestion
                    </Link>
                  ) : null}
                </div>

                <details className="rounded-lg border border-slate-200 p-3">
                  <summary className="cursor-pointer text-sm font-medium text-slate-800">Evidence and reviewer notes</summary>
                  <div className="mt-3 space-y-2 text-sm text-slate-600">
                    <p>Task type: {task.type.replaceAll("_", " ").toLowerCase()}</p>
                    <p>Automation evidence artifacts: {task._count.evidence}</p>
                    <p>Control-plane evidence artifacts: {task._count.controlPlaneEvidence}</p>
                    <p>Suggestion attached: {task.suggestion ? "yes" : "no"}</p>
                    {task.notes ? <p>Latest reviewer note: {task.notes}</p> : <p>No reviewer note yet.</p>}
                  </div>
                </details>

                <div className="flex flex-wrap gap-2">
                  {task.status === "PENDING" && (
                    <ReviewActionForm
                      organizationId={orgRes.organizationId}
                      taskId={task.id}
                      status="IN_PROGRESS"
                      label="Start review"
                    />
                  )}
                  <ReviewActionForm
                    organizationId={orgRes.organizationId}
                    taskId={task.id}
                    status="APPROVED"
                    label="Mark confirmed"
                  />
                  <ReviewActionForm
                    organizationId={orgRes.organizationId}
                    taskId={task.id}
                    status="REJECTED"
                    label="Mark false positive"
                  />
                  <ReviewActionForm
                    organizationId={orgRes.organizationId}
                    taskId={task.id}
                    status="NEEDS_CHANGES"
                    label="Needs escalation"
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReviewActionForm({
  organizationId,
  taskId,
  status,
  label,
}: {
  organizationId: string;
  taskId: string;
  status: "IN_PROGRESS" | "APPROVED" | "REJECTED" | "NEEDS_CHANGES";
  label: string;
}) {
  return (
    <form action={updateReviewAction} className="flex items-center gap-2">
      <input type="hidden" name="expectedOrganizationId" value={organizationId} />
      <input type="hidden" name="taskId" value={taskId} />
      <input type="hidden" name="status" value={status} />
      <label className="sr-only" htmlFor={`${taskId}-${status}-note`}>
        Reviewer note
      </label>
      <input
        id={`${taskId}-${status}-note`}
        name="note"
        placeholder="Optional reviewer note"
        className="input h-8 w-52 text-xs"
        maxLength={2000}
      />
      <button type="submit" className="btn-secondary text-xs">
        {label}
      </button>
    </form>
  );
}

function ReviewStatusBadge({ status }: { status: string }) {
  return <StatusBadge status={status} />;
}
