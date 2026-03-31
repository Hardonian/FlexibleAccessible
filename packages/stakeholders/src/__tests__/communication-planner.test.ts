// ─── Communication Planner Tests ───────────────────────────────────────
import { describe, expect, it, beforeEach } from "vitest";
import { CommunicationPlanner } from "../services/communication-planner";

describe("CommunicationPlanner", () => {
  let planner: CommunicationPlanner;

  beforeEach(async () => {
    planner = new CommunicationPlanner();
    await planner.clear();
  });

  describe("entry management", () => {
    it("creates communication entry", async () => {
      const entry = await planner.createEntry({
        segment: "EXECUTIVE_SPONSOR",
        channel: "EMAIL",
        cadence: "WEEKLY",
        format: "EMAIL_SUMMARY",
        owner: "PM",
        accessibilityCompliant: true,
      });

      expect(entry.id).toBeDefined();
      expect(entry.channel).toBe("EMAIL");
      expect(entry.cadence).toBe("WEEKLY");
    });

    it("tracks last sent and computes next send", async () => {
      const entry = await planner.createEntry({
        segment: "PROJECT_TEAM",
        channel: "SLACK",
        cadence: "DAILY",
        format: "DASHBOARD",
        owner: "PM",
      });

      const updated = await planner.updateLastSent(entry.id);
      expect(updated?.lastSentAt).toBeInstanceOf(Date);
      expect(updated?.nextSendAt).toBeInstanceOf(Date);
    });
  });

  describe("plan generation", () => {
    it("generates plan from segment templates", async () => {
      const entries = await planner.generatePlanFromTemplates(
        ["EXECUTIVE_SPONSOR", "PROJECT_TEAM", "END_USER"],
        "PM",
      );

      expect(entries.length).toBeGreaterThan(0);
      expect(entries.some((e) => e.segment === "EXECUTIVE_SPONSOR")).toBe(true);
      expect(entries.some((e) => e.segment === "PROJECT_TEAM")).toBe(true);
      expect(entries.some((e) => e.segment === "END_USER")).toBe(true);
    });
  });

  describe("accessibility compliance", () => {
    it("checks compliance for entries", async () => {
      const entry = await planner.createEntry({
        segment: "END_USER",
        channel: "VIDEO_CALL",
        cadence: "MONTHLY",
        format: "WORKSHOP",
        owner: "PM",
        accessibilityCompliant: true,
      });

      const compliance = await planner.checkAccessibilityCompliance(entry.id);
      expect(compliance.compliant).toBe(true);
      expect(compliance.requirements).toContain("Live captions");
      expect(compliance.met.length).toBeGreaterThan(0);
      expect(compliance.unmet.length).toBe(0);
    });

    it("identifies non-compliance", async () => {
      const entry = await planner.createEntry({
        segment: "END_USER",
        channel: "EMAIL",
        cadence: "MONTHLY",
        format: "EMAIL_SUMMARY",
        owner: "PM",
        accessibilityCompliant: false,
      });

      const compliance = await planner.checkAccessibilityCompliance(entry.id);
      expect(compliance.compliant).toBe(false);
      expect(compliance.unmet.length).toBeGreaterThan(0);
    });
  });

  describe("phase messages", () => {
    it("returns messages for each phase", () => {
      const phases = [
        "INITIATION",
        "DEVELOPMENT",
        "LAUNCH",
        "MATURITY",
      ] as const;
      for (const phase of phases) {
        const messages = CommunicationPlanner.getPhaseMessages(phase);
        expect(messages).toBeDefined();
        expect(messages?.messages.length).toBeGreaterThan(0);
        expect(messages?.channels.length).toBeGreaterThan(0);
      }
    });
  });

  describe("scheduling", () => {
    it("identifies upcoming communications", async () => {
      await planner.createEntry({
        segment: "EXECUTIVE_SPONSOR",
        channel: "EMAIL",
        cadence: "WEEKLY",
        format: "EMAIL_SUMMARY",
        owner: "PM",
      });

      // Set last sent to 6 days ago (due tomorrow)
      const entries = await planner.exportAll();
      await planner.updateLastSent(entries[0].id);

      const upcoming = await planner.getUpcomingCommunications(30);
      expect(upcoming.length).toBeGreaterThan(0);
    });

    it("identifies overdue communications", async () => {
      await planner.createEntry({
        segment: "PROJECT_TEAM",
        channel: "SLACK",
        cadence: "DAILY",
        format: "DASHBOARD",
        owner: "PM",
      });

      // Manually set nextSendAt to past
      const entries = await planner.exportAll();
      const entry = entries[0];
      entry.nextSendAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

      const overdue = await planner.getOverdueCommunications();
      expect(overdue.length).toBeGreaterThan(0);
    });
  });

  describe("channel templates", () => {
    it("has templates for all major segments", () => {
      const segments = [
        "EXECUTIVE_SPONSOR",
        "PROJECT_TEAM",
        "END_USER",
        "ACCESSIBILITY_ADVOCATE",
        "IT_OPS",
        "EXTERNAL_PARTNER",
        "UNDERREPRESENTED_GROUP",
      ];
      for (const segment of segments) {
        const templates = CommunicationPlanner.SEGMENT_TEMPLATES[segment];
        expect(templates).toBeDefined();
        expect(templates.length).toBeGreaterThan(0);
      }
    });
  });

  describe("accessibility requirements", () => {
    it("has requirements for all channels", () => {
      const channels = [
        "EMAIL",
        "SLACK",
        "TEAMS",
        "PHONE",
        "VIDEO_CALL",
        "IN_PERSON",
        "FORUM",
        "NEWSLETTER",
        "DASHBOARD",
        "SURVEY",
      ] as const;
      for (const channel of channels) {
        const reqs = CommunicationPlanner.ACCESSIBILITY_REQUIREMENTS[channel];
        expect(reqs).toBeDefined();
        expect(reqs.length).toBeGreaterThan(0);
      }
    });
  });
});
