// ─── Gap Analysis Generator ────────────────────────────────────────────
// Automated gap detection based on the 9 dimensions from the audit
// Generates evidence-based gap reports with remedies

import { StakeholderRegistry } from "../services/registry";
import { PowerInterestMatrix } from "../services/power-interest-matrix";
import { UnderrepresentedGroupTracker } from "../services/underrepresented-tracker";
import { BiasAuditEngine } from "../services/bias-audit";
import { FeedbackLoopManager } from "../services/feedback-loop";
import { CommunicationPlanner } from "../services/communication-planner";
import { ValidationFramework } from "../services/validation-framework";
import { MetricsTracker } from "../services/metrics-tracker";

export interface GapEntry {
  dimension: string;
  gap: string;
  whyItMatters: string;
  evidenceOfGap: string;
  dataRequired: string[];
  whoInvolved: string[];
  remedy: string;
  owner: string;
  timeline: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export interface GapAnalysisReport {
  generatedAt: Date;
  dimensions: Record<string, GapEntry[]>;
  totalGaps: number;
  criticalGaps: number;
  highPriorityGaps: number;
  recommendedSequence: string[];
}

export async function generateGapAnalysis(
  organizationId: string,
): Promise<GapAnalysisReport> {
  const registry = new StakeholderRegistry();
  const powerInterest = new PowerInterestMatrix();
  const underrepresented = new UnderrepresentedGroupTracker();
  const biasAudit = new BiasAuditEngine();
  const feedback = new FeedbackLoopManager();
  const communication = new CommunicationPlanner();
  const validation = new ValidationFramework();
  const metrics = new MetricsTracker();

  // Gather current state
  const [
    registrySummary,
    piSummary,
    urSummary,
    feedbackSummary,
    commEntries,
    validationSummary,
  ] = await Promise.all([
    registry.getSummary(),
    powerInterest.getMatrixSummary(),
    underrepresented.getSummary(),
    feedback.getSummary(),
    communication.exportAll(),
    validation.getValidationSummary(),
  ]);

  const dimensions: Record<string, GapEntry[]> = {
    "Stakeholder Identification": [],
    "Underrepresented Groups": [],
    "Needs and Expectations": [],
    "Power/Interest Mapping": [],
    "Risk and Bias": [],
    "Engagement and Communication": [],
    "Data Sources": [],
    "Validation Methods": [],
    "Goal Alignment": [],
  };

  // ── Dimension 1: Stakeholder Identification ──────────────────────────

  if (registrySummary.total === 0) {
    dimensions["Stakeholder Identification"].push({
      dimension: "Stakeholder Identification",
      gap: "No formal stakeholder registry exists",
      whyItMatters:
        "Incomplete identification leads to missed voices, scope creep, and failed adoption",
      evidenceOfGap: "Stakeholder registry contains 0 entries",
      dataRequired: [
        "Existing project documents",
        "Organizational charts",
        "Partner ecosystems",
      ],
      whoInvolved: ["Project Manager", "Business Analyst", "Executive Sponsor"],
      remedy:
        "Create stakeholder registry by scanning existing documents and conducting identification workshops",
      owner: "Project Manager",
      timeline: "Week 1-2",
      priority: "CRITICAL",
    });
  }

  if (
    registrySummary.total > 0 &&
    Object.keys(registrySummary.byRegion).length < 2
  ) {
    dimensions["Stakeholder Identification"].push({
      dimension: "Stakeholder Identification",
      gap: "No secondary/tertiary stakeholders identified",
      whyItMatters:
        "Indirect influencers affect outcomes and are often overlooked",
      evidenceOfGap: `Only ${Object.keys(registrySummary.byRegion).length} region(s) represented`,
      dataRequired: [
        "Supply chain maps",
        "Partner ecosystem documentation",
        "Advocacy group networks",
      ],
      whoInvolved: ["Project Manager", "Community Manager"],
      remedy:
        "Map stakeholder interdependencies and include indirect influencers",
      owner: "Project Manager",
      timeline: "Week 2-4",
      priority: "HIGH",
    });
  }

  // ── Dimension 2: Underrepresented Groups ─────────────────────────────

  if (urSummary.totalUnderrepresented === 0) {
    dimensions["Underrepresented Groups"].push({
      dimension: "Underrepresented Groups",
      gap: "No disability-specific stakeholder mapping conducted",
      whyItMatters:
        "Core audience for accessibility remediation may be underserved",
      evidenceOfGap: "0 underrepresented group outreach records",
      dataRequired: [
        "Disability advocacy organization contacts",
        "Assistive technology community lists",
        "Disability studies research",
      ],
      whoInvolved: ["Accessibility Lead", "Community Manager", "UX Research"],
      remedy:
        "Partner with disability advocacy organizations and recruit participants through assistive technology forums",
      owner: "Accessibility Lead",
      timeline: "Week 2-4",
      priority: "CRITICAL",
    });
  }

  if (urSummary.commonBarriers.length > 0) {
    dimensions["Underrepresented Groups"].push({
      dimension: "Underrepresented Groups",
      gap: "Barriers reported by underrepresented groups not addressed",
      whyItMatters:
        "Unaddressed barriers prevent engagement and signal exclusion",
      evidenceOfGap: `${urSummary.commonBarriers.length} barrier types reported`,
      dataRequired: [
        "Barrier reports",
        "Engagement channel accessibility audit",
        "AT compatibility data",
      ],
      whoInvolved: ["Accessibility Lead", "Product Manager"],
      remedy:
        "Prioritize top barriers and develop mitigation plans with affected groups",
      owner: "Accessibility Lead",
      timeline: "Week 4-6",
      priority: "HIGH",
    });
  }

  // ── Dimension 3: Power/Interest Mapping ──────────────────────────────

  if (piSummary.totalAssessed === 0) {
    dimensions["Power/Interest Mapping"].push({
      dimension: "Power/Interest Mapping",
      gap: "No formal power/interest matrix created",
      whyItMatters: "Resources misallocated; key players under-engaged",
      evidenceOfGap: "0 power/interest assessments completed",
      dataRequired: [
        "RACI matrix",
        "Decision rights documentation",
        "Organizational influence maps",
      ],
      whoInvolved: ["Project Manager", "Executive Sponsor"],
      remedy:
        "Conduct power/interest assessment workshop with project leadership",
      owner: "Project Manager",
      timeline: "Week 2-4",
      priority: "HIGH",
    });
  }

  // ── Dimension 4: Risk and Bias ───────────────────────────────────────

  const biasEntries = await biasAudit.getAllEntries();
  const unmitigated = biasEntries.filter(
    (e) => e.mitigationStatus === "IDENTIFIED",
  );

  if (unmitigated.length > 0) {
    dimensions["Risk and Bias"].push({
      dimension: "Risk and Bias",
      gap: `${unmitigated.length} unmitigated bias findings`,
      whyItMatters: "Biases silently distort requirements and design decisions",
      evidenceOfGap: `${unmitigated.length} bias audit entries in IDENTIFIED status`,
      dataRequired: [
        "Bias audit report",
        "Stakeholder demographic data",
        "Engagement channel analysis",
      ],
      whoInvolved: ["Accessibility Lead", "UX Research", "Project Manager"],
      remedy:
        "Address each unmitigated bias finding with specific mitigation plans and owners",
      owner: "Accessibility Lead",
      timeline: "Week 3-6",
      priority: "HIGH",
    });
  }

  // ── Dimension 5: Engagement and Communication ────────────────────────

  if (commEntries.length === 0) {
    dimensions["Engagement and Communication"].push({
      dimension: "Engagement and Communication",
      gap: "No communication plan exists",
      whyItMatters: "Ad-hoc communication; key stakeholders forgotten",
      evidenceOfGap: "0 communication plan entries",
      dataRequired: [
        "Stakeholder channel preferences",
        "Accessibility requirements per channel",
        "Cadence requirements",
      ],
      whoInvolved: ["Communications Lead", "Project Manager"],
      remedy:
        "Generate communication plan from segment templates, verify accessibility compliance",
      owner: "Communications Lead",
      timeline: "Week 1-3",
      priority: "HIGH",
    });
  }

  // ── Dimension 6: Feedback ────────────────────────────────────────────

  if (feedbackSummary.total === 0) {
    dimensions["Engagement and Communication"].push({
      dimension: "Engagement and Communication",
      gap: "No feedback loop mechanisms established",
      whyItMatters: "Stakeholder input disappears; no evidence of impact",
      evidenceOfGap: "0 feedback items recorded",
      dataRequired: [
        "Feedback collection channels",
        "Response tracking system",
        "Resolution process",
      ],
      whoInvolved: ["Product Manager", "Project Manager"],
      remedy:
        "Deploy feedback collection system with closed-loop tracking and SLA monitoring",
      owner: "Product Manager",
      timeline: "Week 3-5",
      priority: "HIGH",
    });
  }

  // ── Dimension 7: Validation ──────────────────────────────────────────

  if (validationSummary.totalValidations === 0) {
    dimensions["Validation Methods"].push({
      dimension: "Validation Methods",
      gap: "No validation process established",
      whyItMatters: "Analysis not reality-checked; drifts from truth",
      evidenceOfGap: "0 validation records",
      dataRequired: [
        "Validation methodology",
        "External benchmarks",
        "User testing data",
      ],
      whoInvolved: ["QA Lead", "UX Research", "Accessibility Lead"],
      remedy:
        "Establish validation framework with triangulation methodology and quarterly cadence",
      owner: "QA Lead",
      timeline: "Week 2-4",
      priority: "MEDIUM",
    });
  }

  // ── Dimension 8: Metrics ─────────────────────────────────────────────

  const dashboard = await metrics.getDashboardSummary();
  if (dashboard.targets.length === 0) {
    dimensions["Goal Alignment"].push({
      dimension: "Goal Alignment",
      gap: "No success metrics defined",
      whyItMatters: "Cannot demonstrate stakeholder engagement value",
      evidenceOfGap: "0 metric targets set",
      dataRequired: [
        "KPI framework",
        "Baseline measurements",
        "Target-setting criteria",
      ],
      whoInvolved: ["Project Manager", "Executive Sponsor"],
      remedy:
        "Initialize default metric targets and establish baseline measurements",
      owner: "Project Manager",
      timeline: "Week 2-4",
      priority: "HIGH",
    });
  }

  // ── Compile Report ───────────────────────────────────────────────────

  const allGaps = Object.values(dimensions).flat();
  const totalGaps = allGaps.length;
  const criticalGaps = allGaps.filter((g) => g.priority === "CRITICAL").length;
  const highPriorityGaps = allGaps.filter((g) => g.priority === "HIGH").length;

  // Recommended sequence based on dependencies
  const recommendedSequence = [
    "Stakeholder Identification",
    "Power/Interest Mapping",
    "Risk and Bias",
    "Underrepresented Groups",
    "Engagement and Communication",
    "Data Sources",
    "Validation Methods",
    "Goal Alignment",
    "Needs and Expectations",
  ];

  return {
    generatedAt: new Date(),
    dimensions,
    totalGaps,
    criticalGaps,
    highPriorityGaps,
    recommendedSequence,
  };
}
