// ─── Feedback Loop Types ───────────────────────────────────────────────
// Closed-loop feedback tracking and management

import { z } from "zod";

export const FEEDBACK_STATUSES = [
  "RECEIVED",
  "ACKNOWLEDGED",
  "TRIAGED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
  "DUPLICATE",
  "OUT_OF_SCOPE",
] as const;

export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_CATEGORIES = [
  "ACCESSIBILITY_ISSUE",
  "FEATURE_REQUEST",
  "BUG_REPORT",
  "UX_FEEDBACK",
  "PERFORMANCE",
  "DOCUMENTATION",
  "COMMUNICATION",
  "ENGAGEMENT_PROCESS",
  "STRATEGIC_DIRECTION",
  "OTHER",
] as const;

export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export const FEEDBACK_PRIORITIES = [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
] as const;
export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number];

// Zod schemas
export const feedbackCreateSchema = z.object({
  stakeholderId: z.string().min(1),
  category: z.enum(FEEDBACK_CATEGORIES),
  priority: z.enum(FEEDBACK_PRIORITIES).default("MEDIUM"),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  source: z.string().optional(), // e.g., 'survey', 'interview', 'forum'
  tags: z.array(z.string()).default([]),
  attachments: z.array(z.string()).default([]),
  metadata: z.record(z.unknown()).optional(),
});

export const feedbackUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.enum(FEEDBACK_STATUSES).optional(),
  priority: z.enum(FEEDBACK_PRIORITIES).optional(),
  assigneeId: z.string().optional(),
  responseText: z.string().optional(),
  resolutionNotes: z.string().optional(),
  linkedFindingId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type FeedbackCreateInput = z.infer<typeof feedbackCreateSchema>;
export type FeedbackUpdateInput = z.infer<typeof feedbackUpdateSchema>;

export interface FeedbackItem {
  id: string;
  stakeholderId: string;
  stakeholderName: string;
  category: FeedbackCategory;
  priority: FeedbackPriority;
  status: FeedbackStatus;
  title: string;
  description: string;
  source?: string;
  tags: string[];
  attachments: string[];
  assigneeId?: string;
  responseText?: string;
  resolutionNotes?: string;
  linkedFindingId?: string;
  acknowledgedAt?: Date;
  respondedAt?: Date;
  resolvedAt?: Date;
  closedAt?: Date;
  responseTimeDays: number | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Lifecycle tracking for feedback
export interface FeedbackLifecycleEvent {
  id: string;
  feedbackId: string;
  fromStatus: FeedbackStatus | null;
  toStatus: FeedbackStatus;
  note?: string;
  userId?: string;
  createdAt: Date;
}

// Summary metrics
export interface FeedbackSummary {
  total: number;
  byCategory: Record<FeedbackCategory, number>;
  byStatus: Record<FeedbackStatus, number>;
  byPriority: Record<FeedbackPriority, number>;
  averageResponseTimeDays: number | null;
  averageResolutionTimeDays: number | null;
  closureRate: number; // % resolved/closed of total
  feedbackCloseRate: number; // % with response
  topCategories: { category: FeedbackCategory; count: number }[];
  lastUpdated: Date;
}
