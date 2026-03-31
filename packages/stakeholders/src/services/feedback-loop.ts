// ─── Feedback Loop Manager ─────────────────────────────────────────────
// Closed-loop feedback tracking with lifecycle management
// Fills gap: No feedback loop mechanisms, feedback disappears, no evidence of impact

import type {
  FeedbackItem,
  FeedbackCreateInput,
  FeedbackUpdateInput,
  FeedbackStatus,
  FeedbackCategory,
  FeedbackPriority,
  FeedbackSummary,
  FeedbackLifecycleEvent,
} from "../types/feedback";
import {
  FEEDBACK_STATUSES,
  FEEDBACK_CATEGORIES,
  FEEDBACK_PRIORITIES,
} from "../types/feedback";

const feedbackItems = new Map<string, FeedbackItem>();
const lifecycleEvents = new Map<string, FeedbackLifecycleEvent[]>();
let nextId = 1;

function generateId(prefix: string): string {
  return `${prefix}-${String(nextId++).padStart(4, "0")}`;
}

export class FeedbackLoopManager {
  // ── CRUD ─────────────────────────────────────────────────────────────

  async create(input: {
    stakeholderId: string;
    stakeholderName: string;
    category: FeedbackCategory;
    priority: FeedbackPriority;
    title: string;
    description: string;
    source?: string;
    tags?: string[];
    attachments?: string[];
  }): Promise<FeedbackItem> {
    const id = generateId("feedback");
    const now = new Date();

    const item: FeedbackItem = {
      id,
      stakeholderId: input.stakeholderId,
      stakeholderName: input.stakeholderName,
      category: input.category,
      priority: input.priority,
      status: "RECEIVED",
      title: input.title,
      description: input.description,
      source: input.source,
      tags: input.tags ?? [],
      attachments: input.attachments ?? [],
      responseTimeDays: null,
      createdAt: now,
      updatedAt: now,
    };

    feedbackItems.set(id, item);
    this.addLifecycleEvent(id, null, "RECEIVED", "Initial submission");

    return item;
  }

  async getById(id: string): Promise<FeedbackItem | null> {
    return feedbackItems.get(id) ?? null;
  }

  async update(input: {
    id: string;
    status?: FeedbackStatus;
    priority?: FeedbackPriority;
    assigneeId?: string;
    responseText?: string;
    resolutionNotes?: string;
    linkedFindingId?: string;
  }): Promise<FeedbackItem | null> {
    const existing = feedbackItems.get(input.id);
    if (!existing) return null;

    const now = new Date();
    const fromStatus = existing.status;
    const toStatus = input.status ?? existing.status;

    // Track timing
    let acknowledgedAt = existing.acknowledgedAt;
    let respondedAt = existing.respondedAt;
    let resolvedAt = existing.resolvedAt;
    let closedAt = existing.closedAt;
    let responseTimeDays = existing.responseTimeDays;

    if (toStatus === "ACKNOWLEDGED" && !acknowledgedAt) {
      acknowledgedAt = now;
    }
    if (toStatus === "IN_PROGRESS" && !respondedAt) {
      respondedAt = now;
      if (acknowledgedAt) {
        responseTimeDays = Math.round(
          (now.getTime() - acknowledgedAt.getTime()) / (1000 * 60 * 60 * 24),
        );
      }
    }
    if (toStatus === "RESOLVED" && !resolvedAt) {
      resolvedAt = now;
    }
    if (toStatus === "CLOSED" && !closedAt) {
      closedAt = now;
    }

    const updated: FeedbackItem = {
      ...existing,
      status: toStatus,
      priority: input.priority ?? existing.priority,
      assigneeId: input.assigneeId ?? existing.assigneeId,
      responseText: input.responseText ?? existing.responseText,
      resolutionNotes: input.resolutionNotes ?? existing.resolutionNotes,
      linkedFindingId: input.linkedFindingId ?? existing.linkedFindingId,
      acknowledgedAt,
      respondedAt,
      resolvedAt,
      closedAt,
      responseTimeDays,
      updatedAt: now,
    };

    feedbackItems.set(input.id, updated);

    if (fromStatus !== toStatus) {
      this.addLifecycleEvent(
        input.id,
        fromStatus,
        toStatus,
        input.resolutionNotes ?? input.responseText,
      );
    }

    return updated;
  }

  async delete(id: string): Promise<boolean> {
    lifecycleEvents.delete(id);
    return feedbackItems.delete(id);
  }

  // ── Lifecycle Management ─────────────────────────────────────────────

  private addLifecycleEvent(
    feedbackId: string,
    fromStatus: FeedbackStatus | null,
    toStatus: FeedbackStatus,
    note?: string,
  ): void {
    const events = lifecycleEvents.get(feedbackId) || [];
    events.push({
      id: generateId("event"),
      feedbackId,
      fromStatus,
      toStatus,
      note,
      createdAt: new Date(),
    });
    lifecycleEvents.set(feedbackId, events);
  }

  async getLifecycleEvents(
    feedbackId: string,
  ): Promise<FeedbackLifecycleEvent[]> {
    return lifecycleEvents.get(feedbackId) || [];
  }

  // ── Triage & Prioritization ──────────────────────────────────────────

  async triage(
    id: string,
    priority: FeedbackPriority,
    assigneeId: string,
  ): Promise<FeedbackItem | null> {
    return this.update({ id, status: "TRIAGED", priority, assigneeId });
  }

  async acknowledge(
    id: string,
    responseText: string,
  ): Promise<FeedbackItem | null> {
    return this.update({ id, status: "ACKNOWLEDGED", responseText });
  }

  async resolve(
    id: string,
    resolutionNotes: string,
  ): Promise<FeedbackItem | null> {
    return this.update({ id, status: "RESOLVED", resolutionNotes });
  }

  async close(id: string): Promise<FeedbackItem | null> {
    return this.update({ id, status: "CLOSED" });
  }

  async markDuplicate(
    id: string,
    duplicateOfId: string,
  ): Promise<FeedbackItem | null> {
    return this.update({
      id,
      status: "DUPLICATE",
      resolutionNotes: `Duplicate of ${duplicateOfId}`,
    });
  }

  async markOutOfScope(
    id: string,
    reason: string,
  ): Promise<FeedbackItem | null> {
    return this.update({ id, status: "OUT_OF_SCOPE", resolutionNotes: reason });
  }

  // ── Analytics ────────────────────────────────────────────────────────

  async getSummary(): Promise<FeedbackSummary> {
    const all = Array.from(feedbackItems.values());

    const byCategory = Object.fromEntries(
      FEEDBACK_CATEGORIES.map((c) => [c, 0]),
    ) as Record<FeedbackCategory, number>;

    const byStatus = Object.fromEntries(
      FEEDBACK_STATUSES.map((s) => [s, 0]),
    ) as Record<FeedbackStatus, number>;

    const byPriority = Object.fromEntries(
      FEEDBACK_PRIORITIES.map((p) => [p, 0]),
    ) as Record<FeedbackPriority, number>;

    let totalResponseTimeDays = 0;
    let responseTimeCount = 0;
    let totalResolutionTimeDays = 0;
    let resolutionTimeCount = 0;

    for (const item of all) {
      byCategory[item.category]++;
      byStatus[item.status]++;
      byPriority[item.priority]++;

      if (item.responseTimeDays !== null) {
        totalResponseTimeDays += item.responseTimeDays;
        responseTimeCount++;
      }

      if (item.resolvedAt && item.createdAt) {
        totalResolutionTimeDays += Math.round(
          (item.resolvedAt.getTime() - item.createdAt.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        resolutionTimeCount++;
      }
    }

    const resolvedClosed = all.filter(
      (i) => i.status === "RESOLVED" || i.status === "CLOSED",
    ).length;

    const withResponse = all.filter(
      (i) => i.responseText || i.status !== "RECEIVED",
    ).length;

    // Top categories
    const topCategories = FEEDBACK_CATEGORIES.map((category) => ({
      category,
      count: byCategory[category],
    }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      total: all.length,
      byCategory,
      byStatus,
      byPriority,
      averageResponseTimeDays:
        responseTimeCount > 0
          ? Math.round(totalResponseTimeDays / responseTimeCount)
          : null,
      averageResolutionTimeDays:
        resolutionTimeCount > 0
          ? Math.round(totalResolutionTimeDays / resolutionTimeCount)
          : null,
      closureRate:
        all.length > 0 ? Math.round((resolvedClosed / all.length) * 100) : 0,
      feedbackCloseRate:
        all.length > 0 ? Math.round((withResponse / all.length) * 100) : 0,
      topCategories,
      lastUpdated: new Date(),
    };
  }

  // ── Filtering ────────────────────────────────────────────────────────

  async listByStakeholder(stakeholderId: string): Promise<FeedbackItem[]> {
    return Array.from(feedbackItems.values()).filter(
      (f) => f.stakeholderId === stakeholderId,
    );
  }

  async listByStatus(status: FeedbackStatus): Promise<FeedbackItem[]> {
    return Array.from(feedbackItems.values()).filter(
      (f) => f.status === status,
    );
  }

  async listByCategory(category: FeedbackCategory): Promise<FeedbackItem[]> {
    return Array.from(feedbackItems.values()).filter(
      (f) => f.category === category,
    );
  }

  async listByPriority(priority: FeedbackPriority): Promise<FeedbackItem[]> {
    return Array.from(feedbackItems.values()).filter(
      (f) => f.priority === priority,
    );
  }

  async listOverdue(daysThreshold: number): Promise<FeedbackItem[]> {
    const threshold = Date.now() - daysThreshold * 24 * 60 * 60 * 1000;
    return Array.from(feedbackItems.values()).filter(
      (f) =>
        f.status !== "CLOSED" &&
        f.status !== "RESOLVED" &&
        f.createdAt.getTime() < threshold,
    );
  }

  // ── Export ────────────────────────────────────────────────────────────

  async exportAll(): Promise<FeedbackItem[]> {
    return Array.from(feedbackItems.values());
  }

  async clear(): Promise<void> {
    feedbackItems.clear();
    lifecycleEvents.clear();
    nextId = 1;
  }
}
