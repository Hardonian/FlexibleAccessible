// ─── Underrepresented Group Tracker ────────────────────────────────────
// Systematic tracking of underrepresented groups in stakeholder analysis
// Fills gap: No disability-specific mapping, no intersectional analysis,
//            no international/localization stakeholders, no aging population

import type {
  UnderrepresentedGroup,
  OutreachRecord,
  OutreachStatus,
  OutreachMethod,
  GroupEngagementStatus,
  UnderrepresentedGroupSummary,
} from "../types/underrepresented";
import {
  UNDERREPRESENTED_GROUPS,
  OUTREACH_METHODS,
  OUTREACH_STATUSES,
} from "../types/underrepresented";

const outreachRecords = new Map<string, OutreachRecord>();
let nextId = 1;

function generateId(): string {
  return `outreach-${String(nextId++).padStart(4, "0")}`;
}

export class UnderrepresentedGroupTracker {
  // ── Outreach Management ──────────────────────────────────────────────

  async createOutreach(entry: {
    stakeholderId: string;
    stakeholderName: string;
    group: UnderrepresentedGroup;
    status: OutreachStatus;
    method: OutreachMethod;
    owner: string;
    contactedAt?: Date;
    accessibilityNeedsMet?: boolean;
    barriersEncountered?: string[];
    followUpDate?: Date;
    responseNotes?: string;
  }): Promise<OutreachRecord> {
    const id = generateId();
    const now = new Date();

    const record: OutreachRecord = {
      id,
      stakeholderId: entry.stakeholderId,
      stakeholderName: entry.stakeholderName,
      group: entry.group,
      status: entry.status,
      method: entry.method,
      contactedAt: entry.contactedAt,
      accessibilityNeedsMet: entry.accessibilityNeedsMet ?? false,
      barriersEncountered: entry.barriersEncountered ?? [],
      followUpDate: entry.followUpDate,
      owner: entry.owner,
      responseNotes: entry.responseNotes,
      createdAt: now,
      updatedAt: now,
    };

    outreachRecords.set(id, record);
    return record;
  }

  async getOutreach(id: string): Promise<OutreachRecord | null> {
    return outreachRecords.get(id) ?? null;
  }

  async updateOutreachStatus(
    id: string,
    status: OutreachStatus,
    notes?: string,
  ): Promise<OutreachRecord | null> {
    const existing = outreachRecords.get(id);
    if (!existing) return null;

    const updated: OutreachRecord = {
      ...existing,
      status,
      responseNotes: notes ?? existing.responseNotes,
      responseAt: ["CONTACTED", "ENGAGED", "ACTIVE"].includes(status)
        ? new Date()
        : existing.responseAt,
      updatedAt: new Date(),
    };

    outreachRecords.set(id, updated);
    return updated;
  }

  async addBarrier(
    id: string,
    barrier: string,
  ): Promise<OutreachRecord | null> {
    const existing = outreachRecords.get(id);
    if (!existing) return null;

    const barriers = existing.barriersEncountered.includes(barrier)
      ? existing.barriersEncountered
      : [...existing.barriersEncountered, barrier];

    const updated: OutreachRecord = {
      ...existing,
      barriersEncountered: barriers,
      updatedAt: new Date(),
    };

    outreachRecords.set(id, updated);
    return updated;
  }

  async markAccessibilityNeedsMet(
    id: string,
    met: boolean,
  ): Promise<OutreachRecord | null> {
    const existing = outreachRecords.get(id);
    if (!existing) return null;

    const updated: OutreachRecord = {
      ...existing,
      accessibilityNeedsMet: met,
      updatedAt: new Date(),
    };

    outreachRecords.set(id, updated);
    return updated;
  }

  // ── Group-Level Analysis ─────────────────────────────────────────────

  async getGroupStatus(
    group: UnderrepresentedGroup,
  ): Promise<GroupEngagementStatus> {
    const records = Array.from(outreachRecords.values()).filter(
      (r) => r.group === group,
    );

    const outreachMethods = {} as Record<OutreachMethod, number>;
    OUTREACH_METHODS.forEach((m) => (outreachMethods[m] = 0));

    const statusBreakdown = {} as Record<OutreachStatus, number>;
    OUTREACH_STATUSES.forEach((s) => (statusBreakdown[s] = 0));

    const barriersReported: string[] = [];
    let accessibilityNeedsMet = 0;
    let totalResponseTimeMs = 0;
    let responseCount = 0;

    for (const record of records) {
      outreachMethods[record.method]++;
      statusBreakdown[record.status]++;

      if (record.accessibilityNeedsMet) accessibilityNeedsMet++;

      barriersReported.push(...record.barriersEncountered);

      if (record.contactedAt && record.responseAt) {
        totalResponseTimeMs +=
          record.responseAt.getTime() - record.contactedAt.getTime();
        responseCount++;
      }
    }

    const activeCount = records.filter(
      (r) => r.status === "ACTIVE" || r.status === "ENGAGED",
    ).length;

    const lastOutreach =
      records.length > 0
        ? new Date(Math.max(...records.map((r) => r.createdAt.getTime())))
        : null;

    return {
      group,
      totalIdentified: records.length,
      totalRegistered: records.filter((r) => r.status !== "PLANNED").length,
      totalActive: activeCount,
      outreachMethods,
      statusBreakdown,
      accessibilityNeedsMet,
      barriersReported: [...new Set(barriersReported)],
      averageResponseTimeDays:
        responseCount > 0
          ? Math.round(
              totalResponseTimeMs / responseCount / (1000 * 60 * 60 * 24),
            )
          : null,
      engagementRate:
        records.length > 0
          ? Math.round((activeCount / records.length) * 100)
          : 0,
      lastOutreach,
    };
  }

  async getSummary(): Promise<UnderrepresentedGroupSummary> {
    const groups: GroupEngagementStatus[] = [];
    let totalUnderrepresented = 0;
    let totalRegistered = 0;
    let totalActive = 0;
    let totalAccessibilityMet = 0;
    const allBarriers: string[] = [];

    const methodEffectiveness = {} as Record<
      OutreachMethod,
      { attempted: number; engaged: number; rate: number }
    >;
    OUTREACH_METHODS.forEach((m) => {
      methodEffectiveness[m] = { attempted: 0, engaged: 0, rate: 0 };
    });

    for (const group of UNDERREPRESENTED_GROUPS) {
      const status = await this.getGroupStatus(group);
      groups.push(status);
      totalUnderrepresented += status.totalIdentified;
      totalRegistered += status.totalRegistered;
      totalActive += status.totalActive;
      totalAccessibilityMet += status.accessibilityNeedsMet;
      allBarriers.push(...status.barriersReported);

      for (const method of OUTREACH_METHODS) {
        const count = status.outreachMethods[method];
        methodEffectiveness[method].attempted += count;
        // Approximate engaged for this method
        methodEffectiveness[method].engaged += Math.round(
          count * (status.engagementRate / 100),
        );
      }
    }

    // Calculate rates
    for (const method of OUTREACH_METHODS) {
      const { attempted, engaged } = methodEffectiveness[method];
      methodEffectiveness[method].rate =
        attempted > 0 ? Math.round((engaged / attempted) * 100) : 0;
    }

    // Find common barriers
    const barrierCounts = new Map<string, number>();
    for (const barrier of allBarriers) {
      barrierCounts.set(barrier, (barrierCounts.get(barrier) || 0) + 1);
    }
    const commonBarriers = Array.from(barrierCounts.entries())
      .map(([barrier, count]) => ({ barrier, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      groups,
      methodEffectiveness,
      commonBarriers,
    );

    return {
      groups,
      totalUnderrepresented,
      totalRegistered,
      totalActive,
      overallEngagementRate:
        totalUnderrepresented > 0
          ? Math.round((totalActive / totalUnderrepresented) * 100)
          : 0,
      accessibilityNeedsMetRate:
        totalUnderrepresented > 0
          ? Math.round((totalAccessibilityMet / totalUnderrepresented) * 100)
          : 0,
      commonBarriers,
      outreachEffectiveness: methodEffectiveness,
      recommendations,
    };
  }

  private generateRecommendations(
    groups: GroupEngagementStatus[],
    methodEffectiveness: Record<
      OutreachMethod,
      { attempted: number; engaged: number; rate: number }
    >,
    commonBarriers: { barrier: string; count: number }[],
  ): string[] {
    const recommendations: string[] = [];

    // Check engagement rates
    const lowEngagement = groups.filter(
      (g) => g.engagementRate < 50 && g.totalIdentified > 0,
    );
    for (const group of lowEngagement) {
      recommendations.push(
        `${group.group}: Engagement rate (${group.engagementRate}%) is below 50%. Consider alternative outreach methods.`,
      );
    }

    // Check effective methods
    const bestMethod = Object.entries(methodEffectiveness)
      .filter(([_, v]) => v.attempted > 0)
      .sort(([_, a], [__, b]) => b.rate - a.rate)[0];

    if (bestMethod) {
      recommendations.push(
        `Most effective outreach method: ${bestMethod[0]} (${bestMethod[1].rate}% engagement rate). Consider scaling this approach.`,
      );
    }

    // Address common barriers
    for (const barrier of commonBarriers.slice(0, 3)) {
      recommendations.push(
        `Address recurring barrier: "${barrier.barrier}" (${barrier.count} reports). Develop mitigation plan.`,
      );
    }

    // Accessibility needs
    const groupsWithLowA11y = groups.filter(
      (g) =>
        g.totalIdentified > 0 &&
        g.accessibilityNeedsMet < g.totalIdentified * 0.8,
    );
    for (const group of groupsWithLowA11y) {
      recommendations.push(
        `${group.group}: Accessibility needs not fully met (${group.accessibilityNeedsMet}/${group.totalIdentified}). Review engagement materials.`,
      );
    }

    return recommendations;
  }

  // ── Export ────────────────────────────────────────────────────────────

  async exportAll(): Promise<OutreachRecord[]> {
    return Array.from(outreachRecords.values());
  }

  async clear(): Promise<void> {
    outreachRecords.clear();
    nextId = 1;
  }
}
