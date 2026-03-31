// ─── Underrepresented Group Types ──────────────────────────────────────
// Tracking and outreach for underrepresented stakeholder groups

import { z } from "zod";

// Standard underrepresented groups relevant to accessibility
export const UNDERREPRESENTED_GROUPS = [
  "VISUAL_IMPAIRMENT",
  "MOTOR_IMPAIRMENT",
  "COGNITIVE_LEARNING",
  "HEARING_IMPAIRMENT",
  "CHRONIC_PAIN_FATIGUE",
  "MENTAL_HEALTH",
  "INTERNATIONAL_LOCAL",
  "LOW_INCOME_TECH_LIMITED",
  "AGING_POPULATION",
  "INTERSECTIONAL",
] as const;

export type UnderrepresentedGroup = (typeof UNDERREPRESENTED_GROUPS)[number];

// Outreach lifecycle status
export const OUTREACH_STATUSES = [
  "PLANNED",
  "IN_PROGRESS",
  "CONTACTED",
  "ENGAGED",
  "ACTIVE",
  "DECLINED",
  "LOST",
] as const;

export type OutreachStatus = (typeof OUTREACH_STATUSES)[number];

// Outreach methods (accessible by design)
export const OUTREACH_METHODS = [
  "EMAIL",
  "PHONE",
  "VIDEO_CALL",
  "IN_PERSON",
  "COMMUNITY_EVENT",
  "ADVOCACY_ORG",
  "SOCIAL_MEDIA",
  "ASSISTIVE_TECH_FORUM",
  "DISABILITY_NETWORK",
  "LOCAL_ORG",
] as const;

export type OutreachMethod = (typeof OUTREACH_METHODS)[number];

// Zod schemas
export const outreachRecordSchema = z.object({
  stakeholderId: z.string().min(1),
  group: z.enum(UNDERREPRESENTED_GROUPS),
  status: z.enum(OUTREACH_STATUSES),
  method: z.enum(OUTREACH_METHODS),
  contactedAt: z.date().optional(),
  responseAt: z.date().optional(),
  responseNotes: z.string().optional(),
  accessibilityNeedsMet: z.boolean().optional(),
  barriersEncountered: z.array(z.string()).optional(),
  followUpDate: z.date().optional(),
  owner: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

export type OutreachRecordInput = z.infer<typeof outreachRecordSchema>;

export interface OutreachRecord {
  id: string;
  stakeholderId: string;
  stakeholderName: string;
  group: UnderrepresentedGroup;
  status: OutreachStatus;
  method: OutreachMethod;
  contactedAt?: Date;
  responseAt?: Date;
  responseNotes?: string;
  accessibilityNeedsMet: boolean;
  barriersEncountered: string[];
  followUpDate?: Date;
  owner: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Group engagement status
export interface GroupEngagementStatus {
  group: UnderrepresentedGroup;
  totalIdentified: number;
  totalRegistered: number;
  totalActive: number;
  outreachMethods: Partial<Record<OutreachMethod, number>>;
  statusBreakdown: Partial<Record<OutreachStatus, number>>;
  accessibilityNeedsMet: number;
  barriersReported: string[];
  averageResponseTimeDays: number | null;
  engagementRate: number;
  lastOutreach: Date | null;
}

// Summary across all groups
export interface UnderrepresentedGroupSummary {
  groups: GroupEngagementStatus[];
  totalUnderrepresented: number;
  totalRegistered: number;
  totalActive: number;
  overallEngagementRate: number;
  accessibilityNeedsMetRate: number;
  commonBarriers: { barrier: string; count: number }[];
  outreachEffectiveness: Partial<
    Record<
      OutreachMethod,
      { attempted: number; engaged: number; rate: number }
    >
  >;
  recommendations: string[];
}
