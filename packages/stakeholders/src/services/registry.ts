// ─── Stakeholder Registry Service ──────────────────────────────────────
// Complete stakeholder identification and lifecycle management
// Fills gap: No formal stakeholder registry, no categorization, no lifecycle tracking

import type {
  Stakeholder,
  StakeholderCreateInput,
  StakeholderUpdateInput,
  StakeholderFilter,
  StakeholderSummary,
  StakeholderSegment,
  PowerLevel,
  InterestLevel,
  EngagementStatus,
  AccessibilityNeed,
} from "../types/stakeholder";
import {
  STAKEHOLDER_SEGMENTS,
  POWER_LEVELS_SCHEMA,
  INTEREST_LEVELS_SCHEMA,
  ENGAGEMENT_STATUSES,
  ACCESSIBILITY_NEEDS,
} from "../types/stakeholder";

// In-memory store (replace with Prisma in production)
const stakeholders = new Map<string, Stakeholder>();
let nextId = 1;

function generateId(): string {
  return `stakeholder-${String(nextId++).padStart(4, "0")}`;
}

export class StakeholderRegistry {
  // ── CRUD Operations ─────────────────────────────────────────────────

  async create(input: StakeholderCreateInput): Promise<Stakeholder> {
    const id = generateId();
    const now = new Date();
    const stakeholder: Stakeholder = {
      id,
      ...input,
      accessibilityNeeds: input.accessibilityNeeds || [],
      tags: input.tags || [],
      underrepresentedGroups: input.underrepresentedGroups || [],
      language: input.language || "en",
      createdAt: now,
      updatedAt: now,
    };
    stakeholders.set(id, stakeholder);
    return stakeholder;
  }

  async getById(id: string): Promise<Stakeholder | null> {
    return stakeholders.get(id) ?? null;
  }

  async update(input: StakeholderUpdateInput): Promise<Stakeholder | null> {
    const existing = stakeholders.get(input.id);
    if (!existing) return null;
    const updated: Stakeholder = {
      ...existing,
      ...input,
      updatedAt: new Date(),
    };
    stakeholders.set(input.id, updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    return stakeholders.delete(id);
  }

  async list(filter: StakeholderFilter): Promise<{
    data: Stakeholder[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    let data = Array.from(stakeholders.values());

    // Apply filters
    if (filter.segment) {
      data = data.filter((s) => s.segment === filter.segment);
    }
    if (filter.power) {
      data = data.filter((s) => s.power === filter.power);
    }
    if (filter.interest) {
      data = data.filter((s) => s.interest === filter.interest);
    }
    if (filter.engagementStatus) {
      data = data.filter((s) => s.engagementStatus === filter.engagementStatus);
    }
    if (filter.underrepresentedGroups?.length) {
      data = data.filter((s) =>
        filter.underrepresentedGroups!.some((g) =>
          s.underrepresentedGroups.includes(g),
        ),
      );
    }
    if (filter.tags?.length) {
      data = data.filter((s) => filter.tags!.some((t) => s.tags.includes(t)));
    }
    if (filter.search) {
      const search = filter.search.toLowerCase();
      data = data.filter(
        (s) =>
          s.name.toLowerCase().includes(search) ||
          s.role.toLowerCase().includes(search) ||
          s.organization?.toLowerCase().includes(search) ||
          s.email?.toLowerCase().includes(search),
      );
    }

    // Sort
    data.sort((a, b) => {
      const aVal = a[filter.sortBy] as string;
      const bVal = b[filter.sortBy] as string;
      const cmp = aVal.localeCompare(bVal);
      return filter.sortOrder === "asc" ? cmp : -cmp;
    });

    const total = data.length;
    const totalPages = Math.ceil(total / filter.pageSize);
    const start = (filter.page - 1) * filter.pageSize;
    const paged = data.slice(start, start + filter.pageSize);

    return {
      data: paged,
      total,
      page: filter.page,
      pageSize: filter.pageSize,
      totalPages,
    };
  }

  // ── Bulk Operations ─────────────────────────────────────────────────

  async bulkCreate(inputs: StakeholderCreateInput[]): Promise<Stakeholder[]> {
    const results: Stakeholder[] = [];
    for (const input of inputs) {
      results.push(await this.create(input));
    }
    return results;
  }

  async updateEngagementStatus(
    id: string,
    status: EngagementStatus,
  ): Promise<Stakeholder | null> {
    return this.update({ id, engagementStatus: status });
  }

  async addTag(id: string, tag: string): Promise<Stakeholder | null> {
    const existing = stakeholders.get(id);
    if (!existing) return null;
    const tags = existing.tags.includes(tag)
      ? existing.tags
      : [...existing.tags, tag];
    return this.update({ id, tags });
  }

  async removeTag(id: string, tag: string): Promise<Stakeholder | null> {
    const existing = stakeholders.get(id);
    if (!existing) return null;
    const tags = existing.tags.filter((t) => t !== tag);
    return this.update({ id, tags });
  }

  // ── Analysis & Summary ──────────────────────────────────────────────

  async getSummary(): Promise<StakeholderSummary> {
    const all = Array.from(stakeholders.values());

    const bySegment = Object.fromEntries(
      STAKEHOLDER_SEGMENTS.map((s) => [s, 0]),
    ) as Record<StakeholderSegment, number>;

    const byPower = Object.fromEntries(
      POWER_LEVELS_SCHEMA.map((p) => [p, 0]),
    ) as Record<PowerLevel, number>;

    const byInterest = Object.fromEntries(
      INTEREST_LEVELS_SCHEMA.map((i) => [i, 0]),
    ) as Record<InterestLevel, number>;

    const byEngagementStatus = Object.fromEntries(
      ENGAGEMENT_STATUSES.map((e) => [e, 0]),
    ) as Record<EngagementStatus, number>;

    const byUnderrepresentedGroup: Record<string, number> = {};
    const byRegion: Record<string, number> = {};
    const byAccessibilityNeed = Object.fromEntries(
      ACCESSIBILITY_NEEDS.map((n) => [n, 0]),
    ) as Record<AccessibilityNeed, number>;

    for (const s of all) {
      bySegment[s.segment]++;
      byPower[s.power]++;
      byInterest[s.interest]++;
      byEngagementStatus[s.engagementStatus]++;

      for (const group of s.underrepresentedGroups) {
        byUnderrepresentedGroup[group] =
          (byUnderrepresentedGroup[group] || 0) + 1;
      }

      if (s.region) {
        byRegion[s.region] = (byRegion[s.region] || 0) + 1;
      }

      for (const need of s.accessibilityNeeds) {
        byAccessibilityNeed[need]++;
      }
    }

    const activeCount = all.filter(
      (s) =>
        s.engagementStatus === "ACTIVE" || s.engagementStatus === "CHAMPION",
    ).length;

    return {
      total: all.length,
      bySegment,
      byPower,
      byInterest,
      byEngagementStatus,
      byUnderrepresentedGroup,
      byRegion,
      byAccessibilityNeed,
      coverageRate: all.length > 0 ? 100 : 0,
      engagementRate:
        all.length > 0 ? Math.round((activeCount / all.length) * 100) : 0,
      lastUpdated: new Date(),
    };
  }

  // ── Interdependency Mapping ─────────────────────────────────────────

  async getInterdependencies(): Promise<{
    connections: { from: string; to: string; relationship: string }[];
    clusters: { name: string; members: string[] }[];
  }> {
    const all = Array.from(stakeholders.values());
    const connections: { from: string; to: string; relationship: string }[] =
      [];
    const clusterMap = new Map<string, string[]>();

    // Build connections based on organization
    const byOrg = new Map<string, Stakeholder[]>();
    for (const s of all) {
      if (s.organization) {
        const orgList = byOrg.get(s.organization) || [];
        orgList.push(s);
        byOrg.set(s.organization, orgList);
      }
    }

    for (const [org, members] of byOrg) {
      clusterMap.set(
        org,
        members.map((m) => m.id),
      );
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          connections.push({
            from: members[i].id,
            to: members[j].id,
            relationship: `same_organization:${org}`,
          });
        }
      }
    }

    // Build connections based on shared tags
    const byTag = new Map<string, Stakeholder[]>();
    for (const s of all) {
      for (const tag of s.tags) {
        const tagList = byTag.get(tag) || [];
        tagList.push(s);
        byTag.set(tag, tagList);
      }
    }

    for (const [tag, members] of byTag) {
      if (members.length > 1) {
        clusterMap.set(
          `tag:${tag}`,
          members.map((m) => m.id),
        );
      }
    }

    const clusters = Array.from(clusterMap.entries()).map(
      ([name, members]) => ({
        name,
        members,
      }),
    );

    return { connections, clusters };
  }

  // ── Export / Import ──────────────────────────────────────────────────

  async exportAll(): Promise<Stakeholder[]> {
    return Array.from(stakeholders.values());
  }

  async importAll(data: Stakeholder[]): Promise<number> {
    let imported = 0;
    for (const s of data) {
      stakeholders.set(s.id, s);
      imported++;
    }
    return imported;
  }

  async clear(): Promise<void> {
    stakeholders.clear();
    nextId = 1;
  }
}
