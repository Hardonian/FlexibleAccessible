// ─── Governance Types ──────────────────────────────────────────────────
// Stakeholder council, escalation framework, and ethical governance

import { z } from "zod";

export const GOVERNANCE_ROLES = [
  "EXECUTIVE_SPONSOR",
  "COUNCIL_CHAIR",
  "INTERNAL_REPRESENTATIVE",
  "EXTERNAL_REPRESENTATIVE",
  "USER_ADVOCATE",
  "ACCESSIBILITY_LEAD",
  "LEGAL_ADVISOR",
] as const;

export type GovernanceRole = (typeof GOVERNANCE_ROLES)[number];

export const ESCALATION_LEVELS = [
  "LEVEL_1_PM", // Working group → PM
  "LEVEL_2_SPONSOR", // PM → Executive Sponsor
  "LEVEL_3_COUNCIL", // Sponsor → Stakeholder Council
  "LEVEL_4_BOARD", // Council → External Advisory Board
] as const;

export type EscalationLevel = (typeof ESCALATION_LEVELS)[number];

export const ESCALATION_STATUSES = [
  "OPEN",
  "IN_REVIEW",
  "RESOLVED",
  "ESCALATED",
  "CLOSED",
] as const;

export type EscalationStatus = (typeof ESCALATION_STATUSES)[number];

// Zod schemas
export const councilMemberSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(GOVERNANCE_ROLES),
  organization: z.string().optional(),
  isExternal: z.boolean().default(false),
  termStart: z.date(),
  termEnd: z.date().optional(),
  attendanceCount: z.number().int().default(0),
  totalMeetings: z.number().int().default(0),
});

export type CouncilMemberInput = z.infer<typeof councilMemberSchema>;

export interface CouncilMember {
  id: string;
  name: string;
  email: string;
  role: GovernanceRole;
  organization?: string;
  isExternal: boolean;
  termStart: Date;
  termEnd?: Date;
  attendanceCount: number;
  totalMeetings: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GovernanceCouncil {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  members: CouncilMember[];
  meetingCadence: "MONTHLY" | "QUARTERLY";
  nextMeeting: Date | null;
  lastMeeting: Date | null;
  charter: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EscalationRecord {
  id: string;
  title: string;
  description: string;
  level: EscalationLevel;
  status: EscalationStatus;
  stakeholderIds: string[];
  reportedBy: string;
  assignedTo: string;
  escalatedFrom?: EscalationLevel;
  escalatedTo?: EscalationLevel;
  resolution?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Ethical principles
export const ETHICAL_PRINCIPLES = [
  "INCLUSIVITY",
  "TRANSPARENCY",
  "PRIVACY",
  "ACCESSIBILITY",
  "REPRESENTATION",
  "RECIPROCITY",
] as const;

export type EthicalPrinciple = (typeof ETHICAL_PRINCIPLES)[number];

export const ETHICAL_COMMITMENTS: Record<
  EthicalPrinciple,
  {
    commitment: string;
    implementation: string;
  }
> = {
  INCLUSIVITY: {
    commitment: "All voices heard, especially marginalized",
    implementation: "Quota systems for underrepresented groups in research",
  },
  TRANSPARENCY: {
    commitment: "Open about limitations and trade-offs",
    implementation: "Public roadmap, transparent decision rationale",
  },
  PRIVACY: {
    commitment: "Stakeholder data protected",
    implementation: "GDPR compliance, minimal data collection",
  },
  ACCESSIBILITY: {
    commitment: "Our engagement is accessible",
    implementation: "WCAG AA minimum, AT testing for all communications",
  },
  REPRESENTATION: {
    commitment: "Decisions reflect stakeholder makeup",
    implementation: "Regular representation audits",
  },
  RECIPROCITY: {
    commitment: "Stakeholder time is valued",
    implementation: "Compensation for expert input, quick turnarounds",
  },
};
