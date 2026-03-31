// ─── Underrepresented Group Tracker Tests ──────────────────────────────
import { describe, expect, it, beforeEach } from "vitest";
import { UnderrepresentedGroupTracker } from "../services/underrepresented-tracker";

describe("UnderrepresentedGroupTracker", () => {
  let tracker: UnderrepresentedGroupTracker;

  beforeEach(async () => {
    tracker = new UnderrepresentedGroupTracker();
    await tracker.clear();
  });

  describe("outreach management", () => {
    it("creates outreach record", async () => {
      const record = await tracker.createOutreach({
        stakeholderId: "s-001",
        stakeholderName: "Jane Doe",
        group: "VISUAL_IMPAIRMENT",
        status: "PLANNED",
        method: "EMAIL",
        owner: "community-mgr",
      });

      expect(record.id).toBeDefined();
      expect(record.group).toBe("VISUAL_IMPAIRMENT");
      expect(record.status).toBe("PLANNED");
    });

    it("updates outreach status", async () => {
      const record = await tracker.createOutreach({
        stakeholderId: "s-001",
        stakeholderName: "Test",
        group: "COGNITIVE_LEARNING",
        status: "PLANNED",
        method: "PHONE",
        owner: "cm-1",
      });

      const updated = await tracker.updateOutreachStatus(
        record.id,
        "CONTACTED",
      );
      expect(updated?.status).toBe("CONTACTED");
      expect(updated?.responseAt).toBeInstanceOf(Date);
    });

    it("records barriers", async () => {
      const record = await tracker.createOutreach({
        stakeholderId: "s-001",
        stakeholderName: "Test",
        group: "LOW_INCOME_TECH_LIMITED",
        status: "IN_PROGRESS",
        method: "COMMUNITY_EVENT",
        owner: "cm-1",
      });

      await tracker.addBarrier(record.id, "No internet access");
      await tracker.addBarrier(record.id, "Language barrier");

      const retrieved = await tracker.getOutreach(record.id);
      expect(retrieved?.barriersEncountered).toContain("No internet access");
      expect(retrieved?.barriersEncountered).toContain("Language barrier");
    });

    it("marks accessibility needs met", async () => {
      const record = await tracker.createOutreach({
        stakeholderId: "s-001",
        stakeholderName: "Test",
        group: "HEARING_IMPAIRMENT",
        status: "ENGAGED",
        method: "VIDEO_CALL",
        owner: "cm-1",
      });

      await tracker.markAccessibilityNeedsMet(record.id, true);
      const retrieved = await tracker.getOutreach(record.id);
      expect(retrieved?.accessibilityNeedsMet).toBe(true);
    });
  });

  describe("group analysis", () => {
    it("computes group engagement status", async () => {
      await tracker.createOutreach({
        stakeholderId: "s-1",
        stakeholderName: "A",
        group: "VISUAL_IMPAIRMENT",
        status: "ACTIVE",
        method: "EMAIL",
        owner: "cm-1",
      });
      await tracker.createOutreach({
        stakeholderId: "s-2",
        stakeholderName: "B",
        group: "VISUAL_IMPAIRMENT",
        status: "CONTACTED",
        method: "PHONE",
        owner: "cm-1",
      });
      await tracker.createOutreach({
        stakeholderId: "s-3",
        stakeholderName: "C",
        group: "VISUAL_IMPAIRMENT",
        status: "PLANNED",
        method: "COMMUNITY_EVENT",
        owner: "cm-1",
      });

      const status = await tracker.getGroupStatus("VISUAL_IMPAIRMENT");
      expect(status.totalIdentified).toBe(3);
      expect(status.totalActive).toBe(1);
      expect(status.engagementRate).toBe(33);
    });
  });

  describe("summary", () => {
    it("generates comprehensive summary", async () => {
      await tracker.createOutreach({
        stakeholderId: "s-1",
        stakeholderName: "A",
        group: "VISUAL_IMPAIRMENT",
        status: "ACTIVE",
        method: "EMAIL",
        owner: "cm-1",
        accessibilityNeedsMet: true,
      });
      await tracker.createOutreach({
        stakeholderId: "s-2",
        stakeholderName: "B",
        group: "COGNITIVE_LEARNING",
        status: "PLANNED",
        method: "PHONE",
        owner: "cm-1",
        barriersEncountered: ["Language barrier"],
      });

      const summary = await tracker.getSummary();
      expect(summary.totalUnderrepresented).toBe(2);
      expect(summary.totalActive).toBe(1);
      expect(summary.commonBarriers.length).toBeGreaterThan(0);
      expect(summary.recommendations.length).toBeGreaterThan(0);
    });

    it("tracks outreach method effectiveness", async () => {
      await tracker.createOutreach({
        stakeholderId: "s-1",
        stakeholderName: "A",
        group: "AGING_POPULATION",
        status: "ACTIVE",
        method: "PHONE",
        owner: "cm-1",
      });
      await tracker.createOutreach({
        stakeholderId: "s-2",
        stakeholderName: "B",
        group: "AGING_POPULATION",
        status: "ENGAGED",
        method: "PHONE",
        owner: "cm-1",
      });
      await tracker.createOutreach({
        stakeholderId: "s-3",
        stakeholderName: "C",
        group: "AGING_POPULATION",
        status: "LOST",
        method: "EMAIL",
        owner: "cm-1",
      });

      const summary = await tracker.getSummary();
      expect(summary.outreachEffectiveness.PHONE.attempted).toBe(2);
      expect(summary.outreachEffectiveness.EMAIL.attempted).toBe(1);
    });
  });
});
