// ─── Governance Manager ────────────────────────────────────────────────
// Council charter, escalation framework, and ethical governance
// Fills gap: No governance structure, no escalation paths, no ethical framework

import type {
  GovernanceCouncil,
  CouncilMember,
  EscalationRecord,
  EscalationLevel,
  EscalationStatus,
  GovernanceRole,
  EthicalPrinciple,
} from "../types/governance";
import {
  GOVERNANCE_ROLES,
  ESCALATION_LEVELS,
  ESCALATION_STATUSES,
  ETHICAL_PRINCIPLES,
  ETHICAL_COMMITMENTS,
} from "../types/governance";

const councils = new Map<string, GovernanceCouncil>();
const members = new Map<string, CouncilMember>();
const escalations = new Map<string, EscalationRecord>();
let nextId = 1;

function generateId(prefix: string): string {
  return `${prefix}-${String(nextId++).padStart(4, "0")}`;
}

export class GovernanceManager {
  // ── Council Management ───────────────────────────────────────────────

  async createCouncil(input: {
    organizationId: string;
    name: string;
    description?: string;
    meetingCadence: "MONTHLY" | "QUARTERLY";
    charter?: string;
  }): Promise<GovernanceCouncil> {
    const id = generateId("council");
    const now = new Date();

    const council: GovernanceCouncil = {
      id,
      organizationId: input.organizationId,
      name: input.name,
      description: input.description,
      members: [],
      meetingCadence: input.meetingCadence,
      nextMeeting: null,
      lastMeeting: null,
      charter: input.charter ?? null,
      createdAt: now,
      updatedAt: now,
    };

    councils.set(id, council);
    return council;
  }

  async getCouncil(id: string): Promise<GovernanceCouncil | null> {
    return councils.get(id) ?? null;
  }

  // ── Member Management ────────────────────────────────────────────────

  async addCouncilMember(
    councilId: string,
    input: {
      name: string;
      email: string;
      role: GovernanceRole;
      organization?: string;
      isExternal?: boolean;
      termStart: Date;
      termEnd?: Date;
    },
  ): Promise<CouncilMember | null> {
    const council = councils.get(councilId);
    if (!council) return null;

    const id = generateId("member");
    const now = new Date();

    const member: CouncilMember = {
      id,
      name: input.name,
      email: input.email,
      role: input.role,
      organization: input.organization,
      isExternal: input.isExternal ?? false,
      termStart: input.termStart,
      termEnd: input.termEnd,
      attendanceCount: 0,
      totalMeetings: 0,
      createdAt: now,
      updatedAt: now,
    };

    members.set(id, member);
    council.members.push(member);
    council.updatedAt = now;
    councils.set(councilId, council);

    return member;
  }

  async removeCouncilMember(
    councilId: string,
    memberId: string,
  ): Promise<boolean> {
    const council = councils.get(councilId);
    if (!council) return false;

    council.members = council.members.filter((m) => m.id !== memberId);
    council.updatedAt = new Date();
    councils.set(councilId, council);
    members.delete(memberId);

    return true;
  }

  async recordAttendance(
    memberId: string,
    attended: boolean,
  ): Promise<CouncilMember | null> {
    const member = members.get(memberId);
    if (!member) return null;

    const updated: CouncilMember = {
      ...member,
      attendanceCount: attended
        ? member.attendanceCount + 1
        : member.attendanceCount,
      totalMeetings: member.totalMeetings + 1,
      updatedAt: new Date(),
    };

    members.set(memberId, updated);
    return updated;
  }

  // ── Meeting Scheduling ───────────────────────────────────────────────

  async scheduleNextMeeting(
    councilId: string,
    meetingDate: Date,
  ): Promise<GovernanceCouncil | null> {
    const council = councils.get(councilId);
    if (!council) return null;

    council.nextMeeting = meetingDate;
    council.updatedAt = new Date();
    councils.set(councilId, council);
    return council;
  }

  async completeMeeting(councilId: string): Promise<GovernanceCouncil | null> {
    const council = councils.get(councilId);
    if (!council) return null;

    council.lastMeeting = new Date();
    // Auto-schedule next based on cadence
    const next = new Date();
    if (council.meetingCadence === "MONTHLY") {
      next.setMonth(next.getMonth() + 1);
    } else {
      next.setMonth(next.getMonth() + 3);
    }
    council.nextMeeting = next;
    council.updatedAt = new Date();
    councils.set(councilId, council);
    return council;
  }

  // ── Escalation Management ────────────────────────────────────────────

  async createEscalation(input: {
    title: string;
    description: string;
    level: EscalationLevel;
    stakeholderIds: string[];
    reportedBy: string;
    assignedTo: string;
  }): Promise<EscalationRecord> {
    const id = generateId("esc");
    const now = new Date();

    const record: EscalationRecord = {
      id,
      title: input.title,
      description: input.description,
      level: input.level,
      status: "OPEN",
      stakeholderIds: input.stakeholderIds,
      reportedBy: input.reportedBy,
      assignedTo: input.assignedTo,
      createdAt: now,
      updatedAt: now,
    };

    escalations.set(id, record);
    return record;
  }

  async getEscalation(id: string): Promise<EscalationRecord | null> {
    return escalations.get(id) ?? null;
  }

  async updateEscalationStatus(
    id: string,
    status: EscalationStatus,
    notes?: string,
  ): Promise<EscalationRecord | null> {
    const existing = escalations.get(id);
    if (!existing) return null;

    const updated: EscalationRecord = {
      ...existing,
      status,
      resolution: notes ?? existing.resolution,
      resolvedAt:
        status === "RESOLVED" || status === "CLOSED"
          ? new Date()
          : existing.resolvedAt,
      updatedAt: new Date(),
    };

    escalations.set(id, updated);
    return updated;
  }

  async escalateToNextLevel(
    id: string,
    targetLevel: EscalationLevel,
  ): Promise<EscalationRecord | null> {
    const existing = escalations.get(id);
    if (!existing) return null;

    const currentLevel = existing.level;

    const updated: EscalationRecord = {
      ...existing,
      level: targetLevel,
      escalatedFrom: currentLevel,
      escalatedTo: targetLevel,
      status: "ESCALATED",
      updatedAt: new Date(),
    };

    escalations.set(id, updated);
    return updated;
  }

  async resolveEscalation(
    id: string,
    resolution: string,
  ): Promise<EscalationRecord | null> {
    const existing = escalations.get(id);
    if (!existing) return null;

    const updated: EscalationRecord = {
      ...existing,
      status: "RESOLVED",
      resolution,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    };

    escalations.set(id, updated);
    return updated;
  }

  // ── Escalation Matrix ───────────────────────────────────────────────

  static readonly ESCALATION_MATRIX: Record<
    EscalationLevel,
    {
      description: string;
      trigger: string;
      owner: string;
      slaDays: number;
      nextLevel: EscalationLevel | null;
    }
  > = {
    LEVEL_1_PM: {
      description: "Working group to PM — operational issues",
      trigger: "Stakeholder dissatisfaction, missed deadlines, minor conflicts",
      owner: "Project Manager",
      slaDays: 5,
      nextLevel: "LEVEL_2_SPONSOR",
    },
    LEVEL_2_SPONSOR: {
      description: "PM to Executive Sponsor — strategic issues",
      trigger:
        "Budget/resource constraints, strategic direction conflict, key stakeholder threat",
      owner: "Executive Sponsor",
      slaDays: 3,
      nextLevel: "LEVEL_3_COUNCIL",
    },
    LEVEL_3_COUNCIL: {
      description: "Sponsor to Stakeholder Council — governance issues",
      trigger:
        "Ethical concerns, major representation gaps, systemic bias findings",
      owner: "Council Chair",
      slaDays: 7,
      nextLevel: "LEVEL_4_BOARD",
    },
    LEVEL_4_BOARD: {
      description: "Council to External Advisory Board — critical issues",
      trigger:
        "External regulatory concerns, public relations risk, major accessibility failures",
      owner: "Board Chair",
      slaDays: 14,
      nextLevel: null,
    },
  };

  static getEscalationPath(
    level: EscalationLevel,
  ): (typeof GovernanceManager.ESCALATION_MATRIX)[EscalationLevel] {
    return GovernanceManager.ESCALATION_MATRIX[level];
  }

  // ── Ethical Governance ───────────────────────────────────────────────

  static getEthicalCommitments(): Record<
    EthicalPrinciple,
    { commitment: string; implementation: string }
  > {
    return ETHICAL_COMMITMENTS;
  }

  static generateEthicalChecklist(): {
    principle: EthicalPrinciple;
    commitment: string;
    checks: string[];
  }[] {
    return ETHICAL_PRINCIPLES.map((principle) => {
      const commitment = ETHICAL_COMMITMENTS[principle];
      return {
        principle,
        commitment: commitment.commitment,
        checks: [
          `${principle}: ${commitment.implementation}`,
          `Verify: ${commitment.commitment.toLowerCase()} is being upheld`,
          `Document: Evidence of ${principle.toLowerCase()} compliance`,
        ],
      };
    });
  }

  // ── Charter Template ─────────────────────────────────────────────────

  static generateCharterTemplate(councilName: string): string {
    return `
# ${councilName} — Governance Charter

## Purpose
The ${councilName} exists to ensure stakeholder engagement is inclusive, accessible, and aligned with project goals. It provides oversight, resolves conflicts, and upholds ethical principles.

## Scope
- Review stakeholder engagement strategy quarterly
- Resolve escalated stakeholder conflicts
- Ensure underrepresented voices are heard
- Audit bias and accessibility compliance
- Validate engagement metrics and outcomes

## Membership
| Role | Responsibility | Term |
|------|---------------|------|
| Council Chair | Facilitates meetings, sets agenda | 12 months |
| Internal Representatives | Provide project context | Ongoing |
| External Representatives | External stakeholder perspective | 12 months |
| User Advocates | Represent end user needs | 12 months |
| Accessibility Lead | Ensure accessibility standards | Ongoing |
| Legal Advisor | GDPR, regulatory compliance | As needed |

## Meeting Cadence
- Quarterly (or as needed for escalated issues)
- Agenda distributed 7 days in advance
- Minutes published within 3 business days

## Decision Authority
- Approve/reject stakeholder engagement strategies
- Recommend budget allocation for engagement
- Escalate to executive sponsor when needed
- Review and approve ethical compliance reports

## Conflict Resolution
1. Council reviews the issue
2. All affected stakeholders are heard
3. Options are presented with trade-off analysis
4. Decision made by majority (Chair breaks ties)
5. Decision documented and communicated

## Ethical Principles
${ETHICAL_PRINCIPLES.map((p) => `- **${p}**: ${ETHICAL_COMMITMENTS[p].commitment}`).join("\n")}

## Success Metrics
- Stakeholder satisfaction ≥ 4.0/5
- Underrepresented group engagement ≥ 50%
- Escalation resolution within SLA
- Zero unresolved ethical concerns
`.trim();
  }

  // ── Export ────────────────────────────────────────────────────────────

  async exportAllEscalations(): Promise<EscalationRecord[]> {
    return Array.from(escalations.values());
  }

  async exportAllCouncils(): Promise<GovernanceCouncil[]> {
    return Array.from(councils.values());
  }

  async clear(): Promise<void> {
    councils.clear();
    members.clear();
    escalations.clear();
    nextId = 1;
  }
}
