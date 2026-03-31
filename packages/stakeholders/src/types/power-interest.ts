// ─── Power/Interest Matrix Types ───────────────────────────────────────
// Formal power/interest analysis with engagement strategy mapping

import { z } from "zod";

// Power levels
export const POWER_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
export type PowerLevel = (typeof POWER_LEVELS)[number];

// Interest levels
export const INTEREST_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
export type InterestLevel = (typeof INTEREST_LEVELS)[number];

// Engagement strategies based on matrix position
export const ENGAGEMENT_STRATEGIES = [
  "KEEP_SATISFIED", // High power, low interest — Monitor regularly
  "MANAGE_CLOSELY", // High power, high interest — Key players, engage closely
  "KEEP_INFORMED", // Low power, low interest — Inform periodically
  "KEEP_ENGAGED", // Low power, high interest — Involve actively
] as const;

export type EngagementStrategy = (typeof ENGAGEMENT_STRATEGIES)[number];

// Matrix position mapping
export const MATRIX_POSITION: Record<
  `${PowerLevel}-${InterestLevel}`,
  EngagementStrategy
> = {
  "HIGH-HIGH": "MANAGE_CLOSELY",
  "HIGH-MEDIUM": "KEEP_SATISFIED",
  "HIGH-LOW": "KEEP_SATISFIED",
  "MEDIUM-HIGH": "KEEP_ENGAGED",
  "MEDIUM-MEDIUM": "KEEP_ENGAGED",
  "MEDIUM-LOW": "KEEP_INFORMED",
  "LOW-HIGH": "KEEP_ENGAGED",
  "LOW-MEDIUM": "KEEP_INFORMED",
  "LOW-LOW": "KEEP_INFORMED",
};

// Strategy details
export const STRATEGY_DETAILS: Record<
  EngagementStrategy,
  {
    description: string;
    actionFrequency: string;
    communicationStyle: string;
    escalationPath: string;
    successMetrics: string[];
  }
> = {
  MANAGE_CLOSELY: {
    description:
      "Key players who must be deeply engaged. Regular 1:1 meetings, co-design sessions, strategic input.",
    actionFrequency: "Weekly touchpoints, monthly deep-dive",
    communicationStyle: "Personal, strategic, collaborative",
    escalationPath: "Direct executive sponsor involvement",
    successMetrics: [
      "Stakeholder satisfaction ≥ 4.5/5",
      "Participation in all strategic reviews",
      "No unresolved escalations",
    ],
  },
  KEEP_SATISFIED: {
    description:
      "High power, lower interest. Keep satisfied with progress updates, avoid surprises, engage strategically.",
    actionFrequency: "Monthly summaries, quarterly reviews",
    communicationStyle: "Executive-focused, results-oriented",
    escalationPath: "PM to sponsor, pre-briefed",
    successMetrics: [
      "Stakeholder satisfaction ≥ 4.0/5",
      "No escalation-triggered interventions",
      "Budget/resource requests approved",
    ],
  },
  KEEP_ENGAGED: {
    description:
      "Active participants with valuable input. Involve in working groups, testing, feedback loops.",
    actionFrequency: "Bi-weekly involvement, continuous feedback",
    communicationStyle: "Inclusive, detailed, action-oriented",
    escalationPath: "Working group to PM",
    successMetrics: [
      "Working group attendance ≥ 60%",
      "Feedback close rate ≥ 80%",
      "Implementation of key suggestions",
    ],
  },
  KEEP_INFORMED: {
    description:
      "Lower power, general interest. Keep informed through newsletters, updates, open forums.",
    actionFrequency: "Monthly newsletter, quarterly open forum",
    communicationStyle: "Broadcast, transparent, accessible",
    escalationPath: "Community forum → PM",
    successMetrics: [
      "Information satisfaction ≥ 3.5/5",
      "Newsletter open rate ≥ 60%",
      "Zero undetected issues",
    ],
  },
};

// Zod schemas
export const powerInterestEntrySchema = z.object({
  stakeholderId: z.string().min(1),
  power: z.enum(POWER_LEVELS),
  interest: z.enum(INTEREST_LEVELS),
  strategy: z.enum(ENGAGEMENT_STRATEGIES),
  notes: z.string().optional(),
  assessedAt: z.date(),
  assessedBy: z.string(),
});

// Inferred types
export type PowerInterestEntryInput = z.infer<typeof powerInterestEntrySchema>;

export interface PowerInterestEntry {
  id: string;
  stakeholderId: string;
  stakeholderName: string;
  segment: string;
  power: PowerLevel;
  interest: InterestLevel;
  strategy: EngagementStrategy;
  notes?: string;
  assessedAt: Date;
  assessedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MatrixSummary {
  keyPlayers: PowerInterestEntry[];
  keepSatisfied: PowerInterestEntry[];
  keepEngaged: PowerInterestEntry[];
  keepInformed: PowerInterestEntry[];
  totalAssessed: number;
  coverageRate: number; // % of stakeholders with assessments
  lastAssessedAt: Date | null;
}
