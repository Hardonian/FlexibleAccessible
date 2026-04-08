import type { ReviewStatus, ReviewType } from "@aros/db";

export type ReviewReasonMeta = {
  taxonomy: string;
  description: string;
  reviewerExpectation: string;
  truthState: "requires_human_review" | "partial";
};

export const REVIEW_REASON_META: Record<ReviewType, ReviewReasonMeta> = {
  ALT_TEXT_REVIEW: {
    taxonomy: "Perception and context",
    description: "Visual context ambiguity for alt text quality.",
    reviewerExpectation:
      "Confirm intent, audience context, and whether alternate text preserves meaning.",
    truthState: "partial",
  },
  CONTENT_CLARITY: {
    taxonomy: "Language and comprehension",
    description: "Language clarity or meaning requires human interpretation.",
    reviewerExpectation:
      "Validate readability and intent in the authored context; automation cannot infer audience comprehension.",
    truthState: "requires_human_review",
  },
  KEYBOARD_FLOW: {
    taxonomy: "Interaction behavior",
    description: "Keyboard and focus order behavior can be context-sensitive.",
    reviewerExpectation:
      "Verify tab order, focus visibility, and trapped-focus risk through real keyboard walkthroughs.",
    truthState: "requires_human_review",
  },
  SCREEN_READER: {
    taxonomy: "Assistive technology behavior",
    description: "Landmark and reading-order behavior needs AT verification.",
    reviewerExpectation:
      "Use target screen readers to validate reading order and semantic landmarks.",
    truthState: "requires_human_review",
  },
  SUGGESTION_REVIEW: {
    taxonomy: "Remediation quality",
    description: "Generated suggestion requires reviewer confirmation.",
    reviewerExpectation:
      "Confirm fix safety, regressions, and whether generated suggestions fit authoring constraints.",
    truthState: "partial",
  },
  MANUAL_AUDIT: {
    taxonomy: "Policy and governance",
    description: "Rule requires explicit human verification.",
    reviewerExpectation:
      "Record reviewer rationale and, when needed, escalation path before marking resolved.",
    truthState: "requires_human_review",
  },
};

export type ReviewQueueItem = {
  id: string;
  type: ReviewType;
  status: ReviewStatus;
  createdAt: Date;
  updatedAt: Date;
  reviewedAt: Date | null;
  evidenceCount: number;
  controlPlaneEvidenceCount: number;
};

export type ReviewQueueGroupKey =
  | "overdue"
  | "active"
  | "pending"
  | "resolved";

export function getReviewPriorityScore(task: ReviewQueueItem, now = new Date()): number {
  const ageHours = getReviewAgeHours(task, now);
  const unresolved = task.status === "PENDING" || task.status === "IN_PROGRESS";
  const statusWeight =
    task.status === "PENDING" ? 5 : task.status === "IN_PROGRESS" ? 3 : 0;
  const riskWeight = task.type === "MANUAL_AUDIT" || task.type === "KEYBOARD_FLOW" ? 3 : 1;
  const overdueWeight = unresolved && ageHours >= 72 ? 4 : 0;
  const evidenceWeight = task.evidenceCount + task.controlPlaneEvidenceCount === 0 ? 1 : 0;
  return statusWeight + riskWeight + overdueWeight + evidenceWeight;
}

export function getReviewAgeHours(task: Pick<ReviewQueueItem, "createdAt">, now = new Date()): number {
  return Math.floor((now.getTime() - task.createdAt.getTime()) / 3_600_000);
}

export function groupReviewQueueTasks(
  tasks: ReviewQueueItem[],
  now = new Date(),
): Record<ReviewQueueGroupKey, ReviewQueueItem[]> {
  const sorted = [...tasks].sort((a, b) => {
    const priorityDiff = getReviewPriorityScore(b, now) - getReviewPriorityScore(a, now);
    if (priorityDiff !== 0) return priorityDiff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return sorted.reduce<Record<ReviewQueueGroupKey, ReviewQueueItem[]>>(
    (acc, task) => {
      const ageHours = getReviewAgeHours(task, now);
      if ((task.status === "PENDING" || task.status === "IN_PROGRESS") && ageHours >= 72) {
        acc.overdue.push(task);
      } else if (task.status === "IN_PROGRESS") {
        acc.active.push(task);
      } else if (task.status === "PENDING") {
        acc.pending.push(task);
      } else {
        acc.resolved.push(task);
      }
      return acc;
    },
    { overdue: [], active: [], pending: [], resolved: [] },
  );
}
