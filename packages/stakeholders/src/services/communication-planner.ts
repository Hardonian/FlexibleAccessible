// ─── Communication Planner ─────────────────────────────────────────────
// Multi-channel, accessible communication planning and tracking
// Fills gap: No communication channel strategy, engagement not differentiated

import type {
  CommunicationEntry,
  CommunicationPlan,
  Channel,
  CommunicationCadence,
  CommunicationFormat,
  PhaseMessages,
} from "../types/communication";
import {
  CHANNELS,
  COMMUNICATION_CADENCES,
  COMMUNICATION_FORMATS,
} from "../types/communication";

const entries = new Map<string, CommunicationEntry>();
let nextId = 1;

function generateId(): string {
  return `comm-${String(nextId++).padStart(4, "0")}`;
}

export class CommunicationPlanner {
  // ── Default Communication Templates by Segment ───────────────────────

  static readonly SEGMENT_TEMPLATES: Record<
    string,
    Partial<CommunicationEntry>[]
  > = {
    EXECUTIVE_SPONSOR: [
      {
        channel: "EMAIL",
        cadence: "WEEKLY",
        format: "EMAIL_SUMMARY",
        accessibilityCompliant: true,
        notes: "Executive summary: key metrics, risks, decisions needed",
      },
      {
        channel: "VIDEO_CALL",
        cadence: "MONTHLY",
        format: "PRESENTATION",
        accessibilityCompliant: true,
        notes: "Monthly deep-dive: strategic review, roadmap updates",
      },
    ],
    PROJECT_TEAM: [
      {
        channel: "SLACK",
        cadence: "DAILY",
        format: "DASHBOARD",
        accessibilityCompliant: true,
        notes: "Daily standup updates via Slack",
      },
      {
        channel: "VIDEO_CALL",
        cadence: "BI_WEEKLY",
        format: "PRESENTATION",
        accessibilityCompliant: true,
        notes: "Sprint review and planning",
      },
    ],
    END_USER: [
      {
        channel: "SURVEY",
        cadence: "MONTHLY",
        format: "SURVEY",
        accessibilityCompliant: true,
        notes: "Accessible survey for user feedback",
      },
      {
        channel: "FORUM",
        cadence: "AD_HOC",
        format: "FORUM_POST",
        accessibilityCompliant: true,
        notes: "Community forum for ongoing dialogue",
      },
    ],
    ACCESSIBILITY_ADVOCATE: [
      {
        channel: "SLACK",
        cadence: "WEEKLY",
        format: "DASHBOARD",
        accessibilityCompliant: true,
        notes: "Dedicated advocacy Slack channel",
      },
      {
        channel: "VIDEO_CALL",
        cadence: "MONTHLY",
        format: "WORKSHOP",
        accessibilityCompliant: true,
        notes: "Co-design workshop sessions",
      },
    ],
    IT_OPS: [
      {
        channel: "TEAMS",
        cadence: "BI_WEEKLY",
        format: "DOCUMENT",
        accessibilityCompliant: true,
        notes: "Technical documentation and architecture reviews",
      },
    ],
    EXTERNAL_PARTNER: [
      {
        channel: "EMAIL",
        cadence: "MONTHLY",
        format: "EMAIL_SUMMARY",
        accessibilityCompliant: true,
        notes: "Status updates and compliance reports",
      },
      {
        channel: "VIDEO_CALL",
        cadence: "QUARTERLY",
        format: "PRESENTATION",
        accessibilityCompliant: true,
        notes: "Quarterly business review",
      },
    ],
    UNDERREPRESENTED_GROUP: [
      {
        channel: "PHONE",
        cadence: "BI_WEEKLY",
        format: "DOCUMENT",
        accessibilityCompliant: true,
        notes: "Phone or accessible channels; multiple format options",
      },
      {
        channel: "IN_PERSON",
        cadence: "MONTHLY",
        format: "WORKSHOP",
        accessibilityCompliant: true,
        notes: "In-person or hybrid community meetings",
      },
    ],
  };

  // ── Entry Management ─────────────────────────────────────────────────

  async createEntry(input: {
    stakeholderId?: string;
    segment?: string;
    channel: Channel;
    cadence: CommunicationCadence;
    format: CommunicationFormat;
    owner: string;
    accessibilityCompliant?: boolean;
    notes?: string;
  }): Promise<CommunicationEntry> {
    const id = generateId();
    const now = new Date();

    const entry: CommunicationEntry = {
      id,
      stakeholderId: input.stakeholderId,
      segment: input.segment,
      channel: input.channel,
      cadence: input.cadence,
      format: input.format,
      owner: input.owner,
      accessibilityCompliant: input.accessibilityCompliant ?? false,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    entries.set(id, entry);
    return entry;
  }

  async getEntry(id: string): Promise<CommunicationEntry | null> {
    return entries.get(id) ?? null;
  }

  async deleteEntry(id: string): Promise<boolean> {
    return entries.delete(id);
  }

  async updateLastSent(id: string): Promise<CommunicationEntry | null> {
    const existing = entries.get(id);
    if (!existing) return null;

    const now = new Date();
    const nextSendAt = this.computeNextSend(now, existing.cadence);

    const updated: CommunicationEntry = {
      ...existing,
      lastSentAt: now,
      nextSendAt,
      updatedAt: now,
    };

    entries.set(id, updated);
    return updated;
  }

  // ── Plan Generation ──────────────────────────────────────────────────

  async generatePlanFromTemplates(
    segments: string[],
    owner: string,
  ): Promise<CommunicationEntry[]> {
    const created: CommunicationEntry[] = [];

    for (const segment of segments) {
      const templates = CommunicationPlanner.SEGMENT_TEMPLATES[segment] || [];
      for (const template of templates) {
        const entry = await this.createEntry({
          segment,
          channel: template.channel || "EMAIL",
          cadence: template.cadence || "MONTHLY",
          format: template.format || "EMAIL_SUMMARY",
          owner,
          accessibilityCompliant: template.accessibilityCompliant,
          notes: template.notes,
        });
        created.push(entry);
      }
    }

    return created;
  }

  // ── Accessibility Compliance Check ───────────────────────────────────

  static readonly ACCESSIBILITY_REQUIREMENTS: Record<Channel, string[]> = {
    EMAIL: [
      "Screen reader compatible",
      "Plain language",
      "Alt text for images",
      "Color contrast ratio ≥ 4.5:1",
    ],
    SLACK: [
      "Threaded conversations",
      "Alt text for uploads",
      "Use structured formatting",
    ],
    TEAMS: [
      "Live captions enabled",
      "Recording with transcription",
      "Accessible file sharing",
    ],
    PHONE: [
      "Clear speech",
      "Repeat/clarify on request",
      "Written follow-up summary",
    ],
    VIDEO_CALL: [
      "Live captions",
      "Sign language interpretation",
      "Recording with transcript",
      "Screen reader compatible sharing",
    ],
    IN_PERSON: [
      "Wheelchair accessible venue",
      "Sign language interpreter",
      "Assistive listening devices",
      "Large print materials",
    ],
    FORUM: ["WCAG AA compliance", "Screen reader tested", "Keyboard navigable"],
    NEWSLETTER: [
      "Plain text option",
      "Screen reader compatible",
      "Alt text",
      "Color contrast compliance",
    ],
    DASHBOARD: [
      "WCAG AA compliance",
      "Keyboard navigable",
      "Screen reader compatible",
      "High contrast mode",
    ],
    SURVEY: [
      "Screen reader compatible",
      "Keyboard navigable",
      "Clear labeling",
      "Error prevention",
    ],
  };

  async checkAccessibilityCompliance(entryId: string): Promise<{
    compliant: boolean;
    requirements: string[];
    met: string[];
    unmet: string[];
  }> {
    const entry = entries.get(entryId);
    if (!entry) {
      return {
        compliant: false,
        requirements: [],
        met: [],
        unmet: ["Entry not found"],
      };
    }

    const requirements =
      CommunicationPlanner.ACCESSIBILITY_REQUIREMENTS[entry.channel] || [];
    const met = entry.accessibilityCompliant ? requirements : [];
    const unmet = entry.accessibilityCompliant ? [] : requirements;

    return {
      compliant: entry.accessibilityCompliant,
      requirements,
      met,
      unmet,
    };
  }

  // ── Phase Messages ───────────────────────────────────────────────────

  static readonly PHASE_MESSAGES: PhaseMessages[] = [
    {
      phase: "INITIATION",
      messages: [
        "AROS will transform accessibility remediation for [target audience]",
        "Your voice matters - here is how to engage",
        "Accessibility is not an afterthought, it is foundational",
      ],
      channels: ["EMAIL", "NEWSLETTER", "FORUM"],
      owner: "Project Manager",
    },
    {
      phase: "DEVELOPMENT",
      messages: [
        "Progress update: [key milestone]",
        "Opportunity to shape: [design decision]",
        "Feedback driving change: [example]",
      ],
      channels: ["EMAIL", "SLACK", "DASHBOARD"],
      owner: "Project Manager",
    },
    {
      phase: "LAUNCH",
      messages: [
        "AROS is live: What is new and how to get started",
        "Early adopter success stories",
        "Continuous improvement: Your feedback in action",
      ],
      channels: ["EMAIL", "NEWSLETTER", "FORUM", "VIDEO_CALL"],
      owner: "Communications Lead",
    },
    {
      phase: "MATURITY",
      messages: [
        "Annual impact report: Accessibility outcomes",
        "Future roadmap: Your input shapes priorities",
        "Community highlight: [stakeholder achievement]",
      ],
      channels: ["EMAIL", "NEWSLETTER", "FORUM"],
      owner: "Leadership",
    },
  ];

  static getPhaseMessages(
    phase: PhaseMessages["phase"],
  ): PhaseMessages | undefined {
    return CommunicationPlanner.PHASE_MESSAGES.find((p) => p.phase === phase);
  }

  // ── Scheduling ───────────────────────────────────────────────────────

  private computeNextSend(from: Date, cadence: CommunicationCadence): Date {
    const next = new Date(from);
    switch (cadence) {
      case "DAILY":
        next.setDate(next.getDate() + 1);
        break;
      case "WEEKLY":
        next.setDate(next.getDate() + 7);
        break;
      case "BI_WEEKLY":
        next.setDate(next.getDate() + 14);
        break;
      case "MONTHLY":
        next.setMonth(next.getMonth() + 1);
        break;
      case "QUARTERLY":
        next.setMonth(next.getMonth() + 3);
        break;
      case "ANNUAL":
        next.setFullYear(next.getFullYear() + 1);
        break;
      case "AD_HOC":
        // No automatic scheduling
        break;
    }
    return next;
  }

  async getUpcomingCommunications(days: number): Promise<CommunicationEntry[]> {
    const deadline = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    return Array.from(entries.values()).filter(
      (e) => e.nextSendAt && e.nextSendAt <= deadline,
    );
  }

  async getOverdueCommunications(): Promise<CommunicationEntry[]> {
    const now = new Date();
    return Array.from(entries.values()).filter(
      (e) => e.nextSendAt && e.nextSendAt < now,
    );
  }

  // ── Export ────────────────────────────────────────────────────────────

  async listBySegment(segment: string): Promise<CommunicationEntry[]> {
    return Array.from(entries.values()).filter((e) => e.segment === segment);
  }

  async listByStakeholder(
    stakeholderId: string,
  ): Promise<CommunicationEntry[]> {
    return Array.from(entries.values()).filter(
      (e) => e.stakeholderId === stakeholderId,
    );
  }

  async exportAll(): Promise<CommunicationEntry[]> {
    return Array.from(entries.values());
  }

  async clear(): Promise<void> {
    entries.clear();
    nextId = 1;
  }
}
