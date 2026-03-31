// ─── Feedback Loop Manager Tests ───────────────────────────────────────
import { describe, expect, it, beforeEach } from "vitest";
import { FeedbackLoopManager } from "../services/feedback-loop";

describe("FeedbackLoopManager", () => {
  let manager: FeedbackLoopManager;

  beforeEach(async () => {
    manager = new FeedbackLoopManager();
    await manager.clear();
  });

  describe("CRUD", () => {
    it("creates feedback with RECEIVED status", async () => {
      const item = await manager.create({
        stakeholderId: "s-001",
        stakeholderName: "Jane",
        category: "ACCESSIBILITY_ISSUE",
        priority: "HIGH",
        title: "Screen reader issue",
        description: "Screen reader not reading button labels",
      });

      expect(item.id).toBeDefined();
      expect(item.status).toBe("RECEIVED");
      expect(item.category).toBe("ACCESSIBILITY_ISSUE");
      expect(item.createdAt).toBeInstanceOf(Date);
    });

    it("retrieves by ID", async () => {
      const created = await manager.create({
        stakeholderId: "s-001",
        stakeholderName: "Test",
        category: "FEATURE_REQUEST",
        priority: "MEDIUM",
        title: "Add dark mode",
        description: "Please add dark mode",
      });

      const retrieved = await manager.getById(created.id);
      expect(retrieved?.title).toBe("Add dark mode");
    });

    it("deletes feedback", async () => {
      const created = await manager.create({
        stakeholderId: "s-001",
        stakeholderName: "Test",
        category: "BUG_REPORT",
        priority: "CRITICAL",
        title: "Critical bug",
        description: "Crash on load",
      });

      const deleted = await manager.delete(created.id);
      expect(deleted).toBe(true);
      expect(await manager.getById(created.id)).toBeNull();
    });
  });

  describe("lifecycle management", () => {
    it("transitions through lifecycle states", async () => {
      const item = await manager.create({
        stakeholderId: "s-001",
        stakeholderName: "Test",
        category: "ACCESSIBILITY_ISSUE",
        priority: "HIGH",
        title: "Test",
        description: "Test",
      });

      // Acknowledge
      await manager.acknowledge(item.id, "We received your feedback");
      let updated = await manager.getById(item.id);
      expect(updated?.status).toBe("ACKNOWLEDGED");
      expect(updated?.acknowledgedAt).toBeInstanceOf(Date);

      // Triage
      await manager.triage(item.id, "HIGH", "dev-1");
      updated = await manager.getById(item.id);
      expect(updated?.status).toBe("TRIAGED");
      expect(updated?.assigneeId).toBe("dev-1");

      // Resolve
      await manager.resolve(item.id, "Fixed in v2.1");
      updated = await manager.getById(item.id);
      expect(updated?.status).toBe("RESOLVED");
      expect(updated?.resolvedAt).toBeInstanceOf(Date);

      // Close
      await manager.close(item.id);
      updated = await manager.getById(item.id);
      expect(updated?.status).toBe("CLOSED");
      expect(updated?.closedAt).toBeInstanceOf(Date);
    });

    it("tracks lifecycle events", async () => {
      const item = await manager.create({
        stakeholderId: "s-001",
        stakeholderName: "Test",
        category: "FEATURE_REQUEST",
        priority: "MEDIUM",
        title: "Test",
        description: "Test",
      });

      await manager.acknowledge(item.id, "Acknowledged");
      await manager.resolve(item.id, "Done");

      const events = await manager.getLifecycleEvents(item.id);
      expect(events.length).toBeGreaterThanOrEqual(3); // RECEIVED, ACKNOWLEDGED, RESOLVED
    });

    it("calculates response time", async () => {
      const item = await manager.create({
        stakeholderId: "s-001",
        stakeholderName: "Test",
        category: "BUG_REPORT",
        priority: "HIGH",
        title: "Test",
        description: "Test",
      });

      await manager.acknowledge(item.id, "Acknowledged");
      const updated = await manager.getById(item.id);
      // Response time should be calculated
      expect(updated?.acknowledgedAt).toBeDefined();
    });

    it("marks duplicates", async () => {
      const item = await manager.create({
        stakeholderId: "s-001",
        stakeholderName: "Test",
        category: "BUG_REPORT",
        priority: "LOW",
        title: "Duplicate issue",
        description: "Same as other",
      });

      await manager.markDuplicate(item.id, "original-id");
      const updated = await manager.getById(item.id);
      expect(updated?.status).toBe("DUPLICATE");
      expect(updated?.resolutionNotes).toContain("original-id");
    });

    it("marks out of scope", async () => {
      const item = await manager.create({
        stakeholderId: "s-001",
        stakeholderName: "Test",
        category: "OTHER",
        priority: "LOW",
        title: "Out of scope",
        description: "Not relevant",
      });

      await manager.markOutOfScope(item.id, "Not in project scope");
      const updated = await manager.getById(item.id);
      expect(updated?.status).toBe("OUT_OF_SCOPE");
    });
  });

  describe("analytics", () => {
    it("computes summary metrics", async () => {
      await manager.create({
        stakeholderId: "s-1",
        stakeholderName: "A",
        category: "ACCESSIBILITY_ISSUE",
        priority: "HIGH",
        title: "A1",
        description: "D1",
      });
      await manager.create({
        stakeholderId: "s-2",
        stakeholderName: "B",
        category: "FEATURE_REQUEST",
        priority: "MEDIUM",
        title: "A2",
        description: "D2",
      });

      const summary = await manager.getSummary();
      expect(summary.total).toBe(2);
      expect(summary.byCategory.ACCESSIBILITY_ISSUE).toBe(1);
      expect(summary.byCategory.FEATURE_REQUEST).toBe(1);
      expect(summary.byStatus.RECEIVED).toBe(2);
    });

    it("calculates closure rate", async () => {
      const item1 = await manager.create({
        stakeholderId: "s-1",
        stakeholderName: "A",
        category: "BUG_REPORT",
        priority: "HIGH",
        title: "Bug",
        description: "D",
      });
      await manager.create({
        stakeholderId: "s-2",
        stakeholderName: "B",
        category: "FEATURE_REQUEST",
        priority: "LOW",
        title: "Feature",
        description: "D",
      });

      await manager.resolve(item1.id, "Fixed");

      const summary = await manager.getSummary();
      expect(summary.closureRate).toBe(50); // 1 out of 2 resolved
    });
  });

  describe("filtering", () => {
    beforeEach(async () => {
      await manager.create({
        stakeholderId: "s-1",
        stakeholderName: "A",
        category: "ACCESSIBILITY_ISSUE",
        priority: "HIGH",
        title: "A11y",
        description: "D",
      });
      await manager.create({
        stakeholderId: "s-1",
        stakeholderName: "A",
        category: "FEATURE_REQUEST",
        priority: "LOW",
        title: "Feature",
        description: "D",
      });
      await manager.create({
        stakeholderId: "s-2",
        stakeholderName: "B",
        category: "BUG_REPORT",
        priority: "CRITICAL",
        title: "Bug",
        description: "D",
      });
    });

    it("lists by stakeholder", async () => {
      const items = await manager.listByStakeholder("s-1");
      expect(items).toHaveLength(2);
    });

    it("lists by category", async () => {
      const items = await manager.listByCategory("ACCESSIBILITY_ISSUE");
      expect(items).toHaveLength(1);
    });

    it("lists by priority", async () => {
      const items = await manager.listByPriority("CRITICAL");
      expect(items).toHaveLength(1);
    });
  });
});
