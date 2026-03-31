// ─── Communication Plan Types ──────────────────────────────────────────
// Multi-channel, accessible communication planning

import { z } from "zod";

export const CHANNELS = [
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

export type Channel = (typeof CHANNELS)[number];

export const COMMUNICATION_CADENCES = [
  "DAILY",
  "WEEKLY",
  "BI_WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "ANNUAL",
  "AD_HOC",
] as const;

export type CommunicationCadence = (typeof COMMUNICATION_CADENCES)[number];

export const COMMUNICATION_FORMATS = [
  "DOCUMENT",
  "PRESENTATION",
  "EMAIL_SUMMARY",
  "DASHBOARD",
  "SURVEY",
  "WORKSHOP",
  "FORUM_POST",
  "VIDEO_RECORDING",
] as const;

export type CommunicationFormat = (typeof COMMUNICATION_FORMATS)[number];

// Zod schemas
export const communicationEntrySchema = z.object({
  stakeholderId: z.string().optional(), // null for segment-level plans
  segment: z.string().optional(),
  channel: z.enum(CHANNELS),
  cadence: z.enum(COMMUNICATION_CADENCES),
  format: z.enum(COMMUNICATION_FORMATS),
  owner: z.string(),
  accessibilityCompliant: z.boolean().default(false),
  notes: z.string().optional(),
  lastSentAt: z.date().optional(),
  nextSendAt: z.date().optional(),
});

export type CommunicationEntryInput = z.infer<typeof communicationEntrySchema>;

export interface CommunicationEntry {
  id: string;
  stakeholderId?: string;
  segment?: string;
  channel: Channel;
  cadence: CommunicationCadence;
  format: CommunicationFormat;
  owner: string;
  accessibilityCompliant: boolean;
  notes?: string;
  lastSentAt?: Date;
  nextSendAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommunicationPlan {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  entries: CommunicationEntry[];
  createdAt: Date;
  updatedAt: Date;
}

// Key messages by project phase
export interface PhaseMessages {
  phase: "INITIATION" | "DEVELOPMENT" | "LAUNCH" | "MATURITY";
  messages: string[];
  channels: Channel[];
  owner: string;
}
