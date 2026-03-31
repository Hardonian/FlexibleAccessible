// ─── Stakeholder Registry Service ──────────────────────────────────────
// Complete stakeholder identification and lifecycle management

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

const stakeholders = new Map<string, Stakeholder>();
let nextId = 1;

function generateId(): string {
  return `stakeholder-${String(nextId++).padStart(4, "0")}`;
}

export class StakeholderRegistry {
  async create(input: StakeholderCreateInput): Promise<Stakeholder> {
    const id = generateId();
    const now = new Date();
    const stakeholder: Stakeholder = {
      id,
      name: input.name,
      role: input.role,
      segment: input.segment,
      power: input.power,
      interest: input.interest,
      email: input.email,
      organization: input.organization,
      engagementStatus: input.engagementStatus ?? "NOT_CONTACTED",
      phone: input.phone,
      preferredChannel: input.preferredChannel,
      accessibilityNeeds: input.accessibilityNeeds ?? [],
      notes: input.notes,
      tags: input.tags ?? [],
      underrepresentedGroups: input.underrepresentedGroups ?? [],
      region: input.region,
      language: input.language ?? "en",
      metadata: input.metadata,
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

  async list(filter: Partial<StakeholderFilter>): Promise<{
    data: Stakeholder[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const sortBy = filter.sortBy ?? "name";
    const sortOrder = filter.sortOrder ?? "asc";
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;

    let data = Array.from(stakeholders.values());

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

    data.sort((a, b) => {
      const aVal = (a as unknown as Record<string, unknown>)[sortBy];
      const bVal = (b as unknown as Record<string, unknown>)[sortBy];

      if (sortBy === "createdAt" || sortBy === "updatedAt") {
        return ((aVal as Date).getTime() || 0) - ((bVal as Date).getTime() || 0) * (sortOrder === "asc" ? 1 : -1);
      }

      const sA = String(aVal || "");
      const sB = String(bVal || "");
      const cmp = sA.localeCompare(sB);
      return sortOrder === "asc" ? cmp : -cmp;
    });

    const total = data.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const paged = data.slice(start, start + pageSize);

    return {
      data: paged,
      total,
      page,
      pageSize,
      totalPages,
    };
  }

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

  async getSummary(): Promise<StakeholderSummary> {
    const all = Array.from(stakeholders.values());

    const bySegment = {} as Record<StakeholderSegment, number>;
    STAKEHOLDER_SEGMENTS.forEach((s) => (bySegment[s] = 0));

    const byPower = {} as Record<PowerLevel, number>;
    POWER_LEVELS_SCHEMA.forEach((p) => (byPower[p] = 0));

    const byInterest = {} as Record<InterestLevel, number>;
    INTEREST_LEVELS_SCHEMA.forEach((i) => (byInterest[i] = 0));

    const byEngagementStatus = {} as Record<EngagementStatus, number>;
    ENGAGEMENT_STATUSES.forEach((e) => (byEngagementStatus[e] = 0));

    const byUnderrepresentedGroup: Record<string, number> = {};
    const byRegion: Record<string, number> = {};

    const byAccessibilityNeed = {} as Record<AccessibilityNeed, number>;
    ACCESSIBILITY_NEEDS.forEach((n) => (byAccessibilityNeed[n] = 0));

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

  async getInterdependencies(): Promise<{
    connections: { from: string; to: string; relationship: string }[];
    clusters: { name: string; members: string[] }[];
  }> {
    const all = Array.from(stakeholders.values());
    const connections: { from: string; to: string; relationship: string }[] =
      [];
    const clusterMap = new Map<string, string[]>();

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
