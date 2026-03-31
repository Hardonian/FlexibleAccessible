// ─── Stakeholder Registry Tests ────────────────────────────────────────
import { describe, expect, it, beforeEach } from "vitest";
import { StakeholderRegistry } from "../services/registry";

describe("StakeholderRegistry", () => {
  let registry: StakeholderRegistry;

  beforeEach(async () => {
    registry = new StakeholderRegistry();
    await registry.clear();
  });

  describe("CRUD operations", () => {
    it("creates a stakeholder with all required fields", async () => {
      const stakeholder = await registry.create({
        name: "Jane Doe",
        role: "Accessibility Lead",
        segment: "ACCESSIBILITY_ADVOCATE",
        power: "HIGH",
        interest: "HIGH",
      });

      expect(stakeholder.id).toBeDefined();
      expect(stakeholder.name).toBe("Jane Doe");
      expect(stakeholder.segment).toBe("ACCESSIBILITY_ADVOCATE");
      expect(stakeholder.power).toBe("HIGH");
      expect(stakeholder.interest).toBe("HIGH");
      expect(stakeholder.engagementStatus).toBe("NOT_CONTACTED");
      expect(stakeholder.createdAt).toBeInstanceOf(Date);
    });

    it("creates a stakeholder with optional fields", async () => {
      const stakeholder = await registry.create({
        name: "John Smith",
        email: "john@example.com",
        organization: "Acme Corp",
        role: "Product Manager",
        segment: "EXECUTIVE_SPONSOR",
        power: "HIGH",
        interest: "MEDIUM",
        accessibilityNeeds: ["SCREEN_READER", "CAPTIONING"],
        tags: ["internal", "budget-owner"],
        underrepresentedGroups: ["VISUAL_IMPAIRMENT"],
        region: "US-East",
        language: "en",
      });

      expect(stakeholder.email).toBe("john@example.com");
      expect(stakeholder.accessibilityNeeds).toEqual([
        "SCREEN_READER",
        "CAPTIONING",
      ]);
      expect(stakeholder.tags).toEqual(["internal", "budget-owner"]);
      expect(stakeholder.underrepresentedGroups).toEqual(["VISUAL_IMPAIRMENT"]);
    });

    it("retrieves a stakeholder by ID", async () => {
      const created = await registry.create({
        name: "Test User",
        role: "Tester",
        segment: "PROJECT_TEAM",
        power: "LOW",
        interest: "HIGH",
      });

      const retrieved = await registry.getById(created.id);
      expect(retrieved).toEqual(created);
    });

    it("returns null for non-existent ID", async () => {
      const result = await registry.getById("nonexistent");
      expect(result).toBeNull();
    });

    it("updates a stakeholder", async () => {
      const created = await registry.create({
        name: "Original Name",
        role: "Dev",
        segment: "PROJECT_TEAM",
        power: "LOW",
        interest: "LOW",
      });

      const updated = await registry.update({
        id: created.id,
        name: "Updated Name",
        power: "HIGH",
      });

      expect(updated?.name).toBe("Updated Name");
      expect(updated?.power).toBe("HIGH");
      expect(updated?.interest).toBe("LOW"); // unchanged
    });

    it("returns null when updating non-existent stakeholder", async () => {
      const result = await registry.update({ id: "nonexistent", name: "X" });
      expect(result).toBeNull();
    });

    it("deletes a stakeholder", async () => {
      const created = await registry.create({
        name: "Delete Me",
        role: "Test",
        segment: "COMMUNITY",
        power: "LOW",
        interest: "LOW",
      });

      const deleted = await registry.delete(created.id);
      expect(deleted).toBe(true);

      const retrieved = await registry.getById(created.id);
      expect(retrieved).toBeNull();
    });
  });

  describe("listing and filtering", () => {
    beforeEach(async () => {
      await registry.bulkCreate([
        {
          name: "Alice",
          role: "Sponsor",
          segment: "EXECUTIVE_SPONSOR",
          power: "HIGH",
          interest: "HIGH",
        },
        {
          name: "Bob",
          role: "Dev",
          segment: "PROJECT_TEAM",
          power: "MEDIUM",
          interest: "HIGH",
        },
        {
          name: "Carol",
          role: "User",
          segment: "END_USER",
          power: "LOW",
          interest: "HIGH",
          underrepresentedGroups: ["VISUAL_IMPAIRMENT"],
        },
        {
          name: "Dave",
          role: "Partner",
          segment: "EXTERNAL_PARTNER",
          power: "HIGH",
          interest: "LOW",
        },
        {
          name: "Eve",
          role: "Advocate",
          segment: "ACCESSIBILITY_ADVOCATE",
          power: "MEDIUM",
          interest: "HIGH",
          tags: ["a11y"],
        },
      ]);
    });

    it("lists all stakeholders", async () => {
      const result = await registry.list({ page: 1, pageSize: 10 });
      expect(result.data).toHaveLength(5);
      expect(result.total).toBe(5);
    });

    it("filters by segment", async () => {
      const result = await registry.list({
        segment: "EXECUTIVE_SPONSOR",
        page: 1,
        pageSize: 10,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Alice");
    });

    it("filters by power", async () => {
      const result = await registry.list({
        power: "HIGH",
        page: 1,
        pageSize: 10,
      });
      expect(result.data).toHaveLength(2);
    });

    it("filters by interest", async () => {
      const result = await registry.list({
        interest: "HIGH",
        page: 1,
        pageSize: 10,
      });
      expect(result.data).toHaveLength(3);
    });

    it("filters by underrepresented groups", async () => {
      const result = await registry.list({
        underrepresentedGroups: ["VISUAL_IMPAIRMENT"],
        page: 1,
        pageSize: 10,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Carol");
    });

    it("filters by tags", async () => {
      const result = await registry.list({
        tags: ["a11y"],
        page: 1,
        pageSize: 10,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Eve");
    });

    it("searches by name", async () => {
      const result = await registry.list({
        search: "ali",
        page: 1,
        pageSize: 10,
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Alice");
    });

    it("paginates results", async () => {
      const page1 = await registry.list({ page: 1, pageSize: 2 });
      const page2 = await registry.list({ page: 2, pageSize: 2 });
      expect(page1.data).toHaveLength(2);
      expect(page2.data).toHaveLength(2);
      expect(page1.totalPages).toBe(3);
    });

    it("sorts by name ascending by default", async () => {
      const result = await registry.list({ page: 1, pageSize: 10 });
      expect(result.data[0].name).toBe("Alice");
      expect(result.data[4].name).toBe("Eve");
    });

    it("sorts by name descending", async () => {
      const result = await registry.list({
        page: 1,
        pageSize: 10,
        sortOrder: "desc",
      });
      expect(result.data[0].name).toBe("Eve");
    });
  });

  describe("summary analytics", () => {
    it("returns empty summary when no stakeholders", async () => {
      const summary = await registry.getSummary();
      expect(summary.total).toBe(0);
      expect(summary.engagementRate).toBe(0);
    });

    it("counts by segment", async () => {
      await registry.bulkCreate([
        {
          name: "A",
          role: "R",
          segment: "EXECUTIVE_SPONSOR",
          power: "HIGH",
          interest: "HIGH",
        },
        {
          name: "B",
          role: "R",
          segment: "PROJECT_TEAM",
          power: "HIGH",
          interest: "HIGH",
        },
        {
          name: "C",
          role: "R",
          segment: "PROJECT_TEAM",
          power: "HIGH",
          interest: "HIGH",
        },
      ]);

      const summary = await registry.getSummary();
      expect(summary.total).toBe(3);
      expect(summary.bySegment.EXECUTIVE_SPONSOR).toBe(1);
      expect(summary.bySegment.PROJECT_TEAM).toBe(2);
    });

    it("calculates engagement rate", async () => {
      await registry.bulkCreate([
        {
          name: "A",
          role: "R",
          segment: "PROJECT_TEAM",
          power: "HIGH",
          interest: "HIGH",
          engagementStatus: "ACTIVE",
        },
        {
          name: "B",
          role: "R",
          segment: "PROJECT_TEAM",
          power: "HIGH",
          interest: "HIGH",
          engagementStatus: "CHAMPION",
        },
        {
          name: "C",
          role: "R",
          segment: "PROJECT_TEAM",
          power: "HIGH",
          interest: "HIGH",
          engagementStatus: "NOT_CONTACTED",
        },
        {
          name: "D",
          role: "R",
          segment: "PROJECT_TEAM",
          power: "HIGH",
          interest: "HIGH",
          engagementStatus: "NOT_CONTACTED",
        },
      ]);

      const summary = await registry.getSummary();
      // 2 out of 4 are ACTIVE or CHAMPION
      expect(summary.engagementRate).toBe(50);
    });

    it("counts underrepresented groups", async () => {
      await registry.bulkCreate([
        {
          name: "A",
          role: "R",
          segment: "END_USER",
          power: "LOW",
          interest: "HIGH",
          underrepresentedGroups: ["VISUAL_IMPAIRMENT"],
        },
        {
          name: "B",
          role: "R",
          segment: "END_USER",
          power: "LOW",
          interest: "HIGH",
          underrepresentedGroups: ["VISUAL_IMPAIRMENT", "COGNITIVE_LEARNING"],
        },
      ]);

      const summary = await registry.getSummary();
      expect(summary.byUnderrepresentedGroup.VISUAL_IMPAIRMENT).toBe(2);
      expect(summary.byUnderrepresentedGroup.COGNITIVE_LEARNING).toBe(1);
    });
  });

  describe("interdependency mapping", () => {
    it("maps connections by organization", async () => {
      await registry.bulkCreate([
        {
          name: "A",
          role: "R",
          segment: "PROJECT_TEAM",
          power: "HIGH",
          interest: "HIGH",
          organization: "Acme",
        },
        {
          name: "B",
          role: "R",
          segment: "PROJECT_TEAM",
          power: "HIGH",
          interest: "HIGH",
          organization: "Acme",
        },
      ]);

      const { connections, clusters } = await registry.getInterdependencies();
      expect(connections).toHaveLength(1);
      expect(connections[0].relationship).toContain("Acme");
      expect(clusters.length).toBeGreaterThan(0);
    });
  });

  describe("bulk operations", () => {
    it("bulk creates stakeholders", async () => {
      const results = await registry.bulkCreate([
        {
          name: "A",
          role: "R",
          segment: "PROJECT_TEAM",
          power: "HIGH",
          interest: "HIGH",
        },
        {
          name: "B",
          role: "R",
          segment: "PROJECT_TEAM",
          power: "HIGH",
          interest: "HIGH",
        },
      ]);

      expect(results).toHaveLength(2);
      const summary = await registry.getSummary();
      expect(summary.total).toBe(2);
    });

    it("updates engagement status", async () => {
      const created = await registry.create({
        name: "Test",
        role: "R",
        segment: "PROJECT_TEAM",
        power: "HIGH",
        interest: "HIGH",
      });

      const updated = await registry.updateEngagementStatus(
        created.id,
        "ACTIVE",
      );
      expect(updated?.engagementStatus).toBe("ACTIVE");
    });

    it("adds and removes tags", async () => {
      const created = await registry.create({
        name: "Test",
        role: "R",
        segment: "PROJECT_TEAM",
        power: "HIGH",
        interest: "HIGH",
        tags: ["initial"],
      });

      const withTag = await registry.addTag(created.id, "new-tag");
      expect(withTag?.tags).toContain("new-tag");
      expect(withTag?.tags).toContain("initial");

      const withoutTag = await registry.removeTag(created.id, "initial");
      expect(withoutTag?.tags).not.toContain("initial");
      expect(withoutTag?.tags).toContain("new-tag");
    });
  });
});
