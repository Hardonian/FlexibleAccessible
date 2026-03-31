// ─── Stakeholder Types ─────────────────────────────────────────────────
// Core stakeholder entity and supporting types

import { z } from "zod";

// Stakeholder segments map to organizational roles
export const STAKEHOLDER_SEGMENTS = [
  "EXECUTIVE_SPONSOR",
  "PROJECT_TEAM",
  "END_USER",
  "ACCESSIBILITY_ADVOCATE",
  "IT_OPS",
  "EXTERNAL_PARTNER",
  "REGULATOR",
  "UNDERREPRESENTED_GROUP",
  "COMMUNITY",
] as const;

export type StakeholderSegment = (typeof STAKEHOLDER_SEGMENTS)[number];

// Power levels for influence mapping
export const POWER_LEVELS_SCHEMA = ["HIGH", "MEDIUM", "LOW"] as const;
export type PowerLevel = (typeof POWER_LEVELS_SCHEMA)[number];

// Interest levels for engagement prioritization
export const INTEREST_LEVELS_SCHEMA = ["HIGH", "MEDIUM", "LOW"] as const;
export type InterestLevel = (typeof INTEREST_LEVELS_SCHEMA)[number];

// Engagement status lifecycle
export const ENGAGEMENT_STATUSES = [
  "NOT_CONTACTED",
  "INITIAL_CONTACT",
  "ACTIVE",
  "CHAMPION",
  "RESISTANT",
  "DISINTERESTED",
  "LOST",
] as const;

export type EngagementStatus = (typeof ENGAGEMENT_STATUSES)[number];

// Accessibility needs for inclusive engagement
export const ACCESSIBILITY_NEEDS = [
  "SCREEN_READER",
  "CAPTIONING",
  "SIGN_LANGUAGE",
  "PLAIN_LANGUAGE",
  "LARGE_TEXT",
  "HIGH_CONTRAST",
  "REDUCED_MOTION",
  "MULTIPLE_FORMATS",
] as const;

export type AccessibilityNeed = (typeof ACCESSIBILITY_NEEDS)[number];

// Zod schemas for validation
export const stakeholderCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email().optional(),
  organization: z.string().optional(),
  role: z.string().min(1, "Role is required"),
  segment: z.enum(STAKEHOLDER_SEGMENTS),
  power: z.enum(POWER_LEVELS_SCHEMA),
  interest: z.enum(INTEREST_LEVELS_SCHEMA),
  engagementStatus: z.enum(ENGAGEMENT_STATUSES).default("NOT_CONTACTED"),
  phone: z.string().optional(),
  preferredChannel: z.string().optional(),
  accessibilityNeeds: z.array(z.enum(ACCESSIBILITY_NEEDS)).optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  underrepresentedGroups: z.array(z.string()).optional(),
  region: z.string().optional(),
  language: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const stakeholderUpdateSchema = stakeholderCreateSchema
  .partial()
  .extend({
    id: z.string().min(1),
  });

export const stakeholderFilterSchema = z.object({
  segment: z.enum(STAKEHOLDER_SEGMENTS).optional(),
  power: z.enum(POWER_LEVELS_SCHEMA).optional(),
  interest: z.enum(INTEREST_LEVELS_SCHEMA).optional(),
  engagementStatus: z.enum(ENGAGEMENT_STATUSES).optional(),
  underrepresentedGroups: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(10),
  sortBy: z
    .enum([
      "name",
      "segment",
      "power",
      "interest",
      "engagementStatus",
      "createdAt",
    ] as const)
    .default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

// Inferred types from schemas
export type StakeholderCreateInput = z.infer<typeof stakeholderCreateSchema>;
export type StakeholderUpdateInput = z.infer<typeof stakeholderUpdateSchema>;
export type StakeholderFilter = z.infer<typeof stakeholderFilterSchema>;

// Full stakeholder entity
export interface Stakeholder {
  id: string;
  name: string;
  email?: string;
  organization?: string;
  role: string;
  segment: StakeholderSegment;
  power: PowerLevel;
  interest: InterestLevel;
  engagementStatus: EngagementStatus;
  phone?: string;
  preferredChannel?: string;
  accessibilityNeeds: AccessibilityNeed[];
  notes?: string;
  tags: string[];
  underrepresentedGroups: string[];
  region?: string;
  language: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Summary for dashboard views
export interface StakeholderSummary {
  total: number;
  bySegment: Record<StakeholderSegment, number>;
  byPower: Record<PowerLevel, number>;
  byInterest: Record<InterestLevel, number>;
  byEngagementStatus: Record<EngagementStatus, number>;
  byUnderrepresentedGroup: Record<string, number>;
  byRegion: Record<string, number>;
  byAccessibilityNeed: Record<AccessibilityNeed, number>;
  coverageRate: number;
  engagementRate: number;
  lastUpdated: Date;
}
