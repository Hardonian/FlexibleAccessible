import { describe, expect, it } from "vitest";
import {
  REVIEW_REASON_META,
  getReviewPriorityScore,
  groupReviewQueueTasks,
} from "@/lib/review-operations";
import type { ReviewQueueItem } from "@/lib/review-operations";

const now = new Date("2026-04-08T12:00:00.000Z");

function task(partial: Partial<ReviewQueueItem>): ReviewQueueItem {
  return {
    id: partial.id ?? "task-id",
    type: partial.type ?? "MANUAL_AUDIT",
    status: partial.status ?? "PENDING",
    createdAt: partial.createdAt ?? new Date("2026-04-06T12:00:00.000Z"),
    updatedAt: partial.updatedAt ?? new Date("2026-04-07T12:00:00.000Z"),
    reviewedAt: partial.reviewedAt ?? null,
    evidenceCount: partial.evidenceCount ?? 1,
    controlPlaneEvidenceCount: partial.controlPlaneEvidenceCount ?? 0,
  };
}

describe("review operations", () => {
  it("prioritizes overdue unresolved high-risk work above recent items", () => {
    const overdue = task({
      id: "overdue",
      type: "KEYBOARD_FLOW",
      createdAt: new Date("2026-04-01T12:00:00.000Z"),
    });
    const recent = task({
      id: "recent",
      type: "SUGGESTION_REVIEW",
      createdAt: new Date("2026-04-08T06:00:00.000Z"),
    });

    expect(getReviewPriorityScore(overdue, now)).toBeGreaterThan(
      getReviewPriorityScore(recent, now),
    );
  });

  it("groups tasks into overdue/active/pending/resolved buckets", () => {
    const grouped = groupReviewQueueTasks(
      [
        task({ id: "overdue", createdAt: new Date("2026-04-01T12:00:00.000Z") }),
        task({ id: "active", status: "IN_PROGRESS", createdAt: new Date("2026-04-08T09:00:00.000Z") }),
        task({ id: "pending", status: "PENDING", createdAt: new Date("2026-04-08T08:00:00.000Z") }),
        task({ id: "resolved", status: "APPROVED", reviewedAt: new Date("2026-04-08T10:00:00.000Z") }),
      ],
      now,
    );

    expect(grouped.overdue.map((t) => t.id)).toEqual(["overdue"]);
    expect(grouped.active.map((t) => t.id)).toEqual(["active"]);
    expect(grouped.pending.map((t) => t.id)).toEqual(["pending"]);
    expect(grouped.resolved.map((t) => t.id)).toEqual(["resolved"]);
  });

  it("tracks human-review truth state taxonomy", () => {
    expect(REVIEW_REASON_META.MANUAL_AUDIT.truthState).toBe(
      "requires_human_review",
    );
    expect(REVIEW_REASON_META.SUGGESTION_REVIEW.truthState).toBe("partial");
  });
});
