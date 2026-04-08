import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import type { Prisma } from "@aros/db";
import Link from "next/link";
import { updateReviewAction } from "./actions";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { resolveDashboardOrgMembership } from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { hasPermission } from "@aros/config";
import { StatusBadge } from "@aros/ui";
import { TruthBadge } from "@/components/truth/truth-badge";
import {
  REVIEW_REASON_META,
  getReviewAgeHours,
  getReviewPriorityScore,
  groupReviewQueueTasks,
} from "@/lib/review-operations";

export const metadata = { title: "Reviews" };

const GROUP_LABELS = {
  overdue: "Overdue unresolved",
  active: "In progress",
  pending: "Pending review",
  resolved: "Recently resolved",
} as const;

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ review_error?: string }>;
}) {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const params = await searchParams;
  const now = new Date();

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
      take: 120,
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

  const groupedTasks = groupReviewQueueTasks(
    tasks.map((task) => ({
      id: task.id,
      type: task.type,
      status: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      reviewedAt: task.reviewedAt,
      evidenceCount: task._count.evidence,
      controlPlaneEvidenceCount: task._count.controlPlaneEvidence,
    })),
    now,
  );
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const pendingCount = tasks.filter((t) => t.status === "PENDING").length;
  const inProgressCount = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  const resolvedCount = tasks.filter((t) => ["APPROVED", "REJECTED", "NEEDS_CHANGES"].includes(t.status)).length;
  const unresolvedCount = pendingCount + inProgressCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Review Queue</h1>
          <p className="text-slate-500 mt-1">
            {pendingCount} pending · {inProgressCount} in progress · {unresolvedCount} unresolved · {resolvedCount} resolved
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/docs/reviews-and-manual-verification" className="btn-secondary text-xs">
            Review docs
          </Link>
          <Link href="/trust" className="btn-secondary text-xs">
            Trust posture
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-sm text-orange-900">
        Automation surfaces likely issues and draft remediation; reviewer decisions establish operational truth for this queue.
      </div>

      {reviewError && (
        <RouteReliabilityNotice variant="error" title="Review update failed">
          <p>{reviewError}</p>
        </RouteReliabilityNotice>
      )}

      {tasks.length === 0 ? (
        <div className="card text-center py-12 space-y-3">
          <p className="text-slate-500">No review tasks yet.</p>
          <p className="text-xs text-slate-400">
            New manual-review tasks appear when findings or suggestions require human judgment.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {(Object.keys(groupedTasks) as Array<keyof typeof groupedTasks>).map((groupKey) => {
            const entries = groupedTasks[groupKey];
            if (entries.length === 0) return null;

            return (
              <section key={groupKey} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                    {GROUP_LABELS[groupKey]} ({entries.length})
                  </h2>
                  {groupKey === "overdue" ? (
                    <span className="text-xs font-medium text-amber-700">
                      Older than 72h while unresolved
                    </span>
                  ) : null}
                </div>

                <div className="space-y-3">
                  {entries.map((entry) => {
                    const task = taskById.get(entry.id);
                    if (!task) return null;

                    const reasonMeta = REVIEW_REASON_META[task.type];
                    const ageHours = getReviewAgeHours(entry, now);
                    const totalEvidence = task._count.evidence + task._count.controlPlaneEvidence;
                    const priorityScore = getReviewPriorityScore(entry, now);
                    const evidenceState =
                      totalEvidence === 0
                        ? "No evidence attached yet"
                        : `${task._count.evidence} automation artifact(s), ${task._count.controlPlaneEvidence} control-plane artifact(s)`;

                    return (
                      <article key={task.id} className="card space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <ReviewStatusBadge status={task.status} />
                              <TruthBadge state={reasonMeta.truthState} />
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                                {reasonMeta.taxonomy}
                              </span>
                              {groupKey === "overdue" ? (
                                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                                  Escalation candidate
                                </span>
                              ) : null}
                            </div>

                            <h3 className="text-sm font-semibold text-slate-900">{task.title}</h3>
                            {task.description ? (
                              <p className="text-sm text-slate-600">{task.description}</p>
                            ) : null}
                            <p className="text-xs text-slate-600">{reasonMeta.description}</p>
                            <p className="text-xs text-slate-500">Reviewer expectation: {reasonMeta.reviewerExpectation}</p>

                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                              {task.assignee ? (
                                <span>
                                  Assigned: {task.assignee.name ?? task.assignee.email}
                                </span>
                              ) : (
                                <span>Assigned: unassigned</span>
                              )}
                              <span>Evidence: {totalEvidence}</span>
                              <span>Age: {ageHours}h</span>
                              <span>Priority score: {priorityScore}</span>
                            </div>
                          </div>

                          {task.suggestion && task.suggestionId ? (
                            <Link
                              href={`/remediation/${task.suggestionId}`}
                              className="btn-ghost text-xs"
                            >
                              Open suggestion
                            </Link>
                          ) : null}
                        </div>

                        <details className="rounded-lg border border-slate-200 p-3">
                          <summary className="cursor-pointer text-sm font-medium text-slate-800">
                            Evidence and rationale context
                          </summary>
                          <div className="mt-3 space-y-2 text-sm text-slate-600">
                            <p>Review reason taxonomy: {reasonMeta.taxonomy}</p>
                            <p>{evidenceState}</p>
                            <p>Suggestion attached: {task.suggestion ? "yes" : "no"}</p>
                            {task.notes ? <p>Latest reviewer note: {task.notes}</p> : <p>No reviewer note yet.</p>}
                            {task.reviewedAt ? (
                              <p>Last reviewed: {task.reviewedAt.toLocaleString()}</p>
                            ) : (
                              <p>Not marked reviewed yet.</p>
                            )}
                          </div>
                        </details>

                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                          For confirmed/false-positive/escalation actions, include rationale and references to evidence IDs when available.
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {task.status === "PENDING" && (
                            <ReviewActionForm
                              organizationId={orgRes.organizationId}
                              taskId={task.id}
                              status="IN_PROGRESS"
                              label="Start review"
                              notePlaceholder="What are you verifying first?"
                            />
                          )}
                          <ReviewActionForm
                            organizationId={orgRes.organizationId}
                            taskId={task.id}
                            status="APPROVED"
                            label="Mark confirmed"
                            notePlaceholder="Why is this confirmed? Include evidence IDs."
                          />
                          <ReviewActionForm
                            organizationId={orgRes.organizationId}
                            taskId={task.id}
                            status="REJECTED"
                            label="Mark false positive"
                            notePlaceholder="Why is this a false positive?"
                          />
                          <ReviewActionForm
                            organizationId={orgRes.organizationId}
                            taskId={task.id}
                            status="NEEDS_CHANGES"
                            label="Needs escalation"
                            notePlaceholder="What escalation or changes are required?"
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
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
  notePlaceholder,
}: {
  organizationId: string;
  taskId: string;
  status: "IN_PROGRESS" | "APPROVED" | "REJECTED" | "NEEDS_CHANGES";
  label: string;
  notePlaceholder: string;
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
        placeholder={notePlaceholder}
        className="input h-8 w-64 text-xs"
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
