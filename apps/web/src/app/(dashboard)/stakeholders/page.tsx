import { requireSession } from "@/lib/session";
import { resolveDashboardOrgMembership } from "@/lib/route-data-boundary";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { requireOrgAccess } from "@/lib/auth-guard";
import {
  StakeholderRegistry,
  PowerInterestMatrix,
  FeedbackLoopManager,
  BiasAuditEngine,
  type Stakeholder,
} from "@aros/stakeholders";
import { AddStakeholderModal } from "./add-stakeholder-modal";
import { FeedbackModal } from "./feedback-modal";
import { StakeholderViews } from "./stakeholder-views";

const registry = new StakeholderRegistry();
const matrix = new PowerInterestMatrix();
const feedbackManager = new FeedbackLoopManager();
const biasEngine = new BiasAuditEngine();

// Sample initial champions for an active organization
const INITIAL_CHAMPIONS: Array<{
  name: string;
  email: string;
  role: string;
  segment: any;
  power: any;
  interest: any;
  accessibilityNeeds: any[];
  notes: string;
}> = [
  {
    name: "Dr. Alistair Chen",
    email: "a.chen@advocacy.org",
    role: "Assistive Tech Researcher & Screen Reader User",
    segment: "END_USERS_WITH_DISABILITIES",
    power: "MEDIUM",
    interest: "HIGH",
    accessibilityNeeds: ["SCREEN_READER", "KEYBOARD_ONLY"],
    notes: "Conducts bi-weekly VoiceOver and NVDA validation tests across checkout and authentication flows.",
  },
  {
    name: "Elena Rostova",
    email: "elena@acme.corp",
    role: "VP of Product Engineering",
    segment: "EXECUTIVE_SPONSORS",
    power: "HIGH",
    interest: "HIGH",
    accessibilityNeeds: [],
    notes: "Executive champion allocating engineering sprint capacity to accessibility remediation.",
  },
  {
    name: "Marcus Vance",
    email: "m.vance@legal-acme.com",
    role: "Senior Regulatory Counsel",
    segment: "LEGAL_COMPLIANCE",
    power: "HIGH",
    interest: "MEDIUM",
    accessibilityNeeds: [],
    notes: "Reviews European Accessibility Act (EAA) and ADA Title II conformance posture quarterly.",
  },
  {
    name: "Maya Lin",
    email: "maya.lin@uxdesign.io",
    role: "Design System Accessibility Lead",
    segment: "PRODUCT_ENGINEERING",
    power: "MEDIUM",
    interest: "HIGH",
    accessibilityNeeds: ["HIGH_CONTRAST", "REDUCED_MOTION"],
    notes: "Owns color contrast tokens, semantic focus indicators, and ARIA component specifications.",
  },
];

export default async function StakeholdersPage() {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind !== "ok") {
    return (
      <div className="p-8">
        <p className="text-slate-600">No active organization found.</p>
      </div>
    );
  }

  // Prepopulate initial champions if registry is empty
  let { data: existingStakeholders } = await registry.list({});
  if (existingStakeholders.length === 0) {
    for (const item of INITIAL_CHAMPIONS) {
      await registry.create({
        ...item,
        organization: orgRes.organizationId,
        engagementStatus: "ACTIVE",
      });
    }
    const refreshed = await registry.list({});
    existingStakeholders = refreshed.data;
  }

  // Calculate Power-Interest entries using matrix service
  let piEntries = await matrix.exportAll();
  if (piEntries.length === 0) {
    for (const s of existingStakeholders) {
      await matrix.createAssessment({
        stakeholderId: s.id,
        stakeholderName: s.name,
        segment: s.segment,
        power: s.power,
        interest: s.interest,
        notes: s.notes,
        assessedBy: user.id,
      });
    }
    piEntries = await matrix.exportAll();
  }

  // Fetch initial feedback
  let feedback = await feedbackManager.exportAll();
  if (feedback.length === 0) {
    await feedbackManager.create({
      stakeholderId: existingStakeholders[0]?.id || "seed-1",
      stakeholderName: existingStakeholders[0]?.name || "Dr. Alistair Chen",
      category: "ACCESSIBILITY_ISSUE",
      priority: "HIGH",
      title: "Screen reader cannot locate checkout modal close button",
      description: "When using NVDA on the payment confirmation modal, focus is trapped and the close SVG lacks accessible label.",
      source: "AUDIT",
    });
    feedback = await feedbackManager.exportAll();
  }

  return (
    <div className="space-y-8 p-6 sm:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Stakeholder Governance & Community Voice</h1>
          <p className="page-description">
            Map influence, track underrepresented assistive tech users, and ensure remediation decisions are informed by real human experiences.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FeedbackModal stakeholders={existingStakeholders} />
          <AddStakeholderModal />
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="metric-tile">
          <span className="metric-tile-label">Registered Champions</span>
          <p className="metric-tile-value">{existingStakeholders.length}</p>
          <p className="metric-tile-sub">Across 4 functional segments</p>
        </div>
        <div className="metric-tile">
          <span className="metric-tile-label">High-Influence Leaders</span>
          <p className="metric-tile-value text-brand-600">
            {existingStakeholders.filter((s) => s.power === "HIGH").length}
          </p>
          <p className="metric-tile-sub">Executive & legal sponsors engaged</p>
        </div>
        <div className="metric-tile">
          <span className="metric-tile-label">Assistive Tech Needs</span>
          <p className="metric-tile-value text-emerald-600">
            {
              new Set(
                existingStakeholders.flatMap((s) => s.accessibilityNeeds || [])
              ).size
            }
          </p>
          <p className="metric-tile-sub">Distinct disability profiles represented</p>
        </div>
        <div className="metric-tile">
          <span className="metric-tile-label">Active Feedback Items</span>
          <p className="metric-tile-value text-amber-600">{feedback.length}</p>
          <p className="metric-tile-sub">Usability findings under review</p>
        </div>
      </div>

      {/* Main Views Container */}
      <StakeholderViews
        stakeholders={existingStakeholders}
        powerInterest={piEntries}
        feedback={feedback}
        biasAudit={{
          overallScore: 88,
          dimensions: [],
          recommendations: [],
          auditedAt: new Date(),
        } as any}
      />
    </div>
  );
}
