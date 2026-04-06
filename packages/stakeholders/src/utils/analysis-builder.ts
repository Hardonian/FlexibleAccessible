// ─── Analysis Builder ──────────────────────────────────────────────────
// Orchestrator that builds a comprehensive stakeholder analysis
// from all available data across services

import { StakeholderRegistry } from "../services/registry";
import { PowerInterestMatrix } from "../services/power-interest-matrix";
import { UnderrepresentedGroupTracker } from "../services/underrepresented-tracker";
import { BiasAuditEngine } from "../services/bias-audit";
import { FeedbackLoopManager } from "../services/feedback-loop";
import { MetricsTracker } from "../services/metrics-tracker";
import { EngagementScorer } from "../services/engagement-scorer";
import type { BiasAuditResult } from "../types/bias-audit";

export interface ComprehensiveAnalysis {
  timestamp: Date;
  registry: Awaited<ReturnType<StakeholderRegistry["getSummary"]>>;
  powerInterest: Awaited<ReturnType<PowerInterestMatrix["getMatrixSummary"]>>;
  underrepresented: Awaited<
    ReturnType<UnderrepresentedGroupTracker["getSummary"]>
  >;
  feedback: Awaited<ReturnType<FeedbackLoopManager["getSummary"]>>;
  engagement: Awaited<ReturnType<EngagementScorer["getPortfolioSummary"]>>;
  validation: Awaited<ReturnType<MetricsTracker["getDashboardSummary"]>>;
  gaps: string[];
  risks: string[];
  recommendations: string[];
  nextActions: {
    action: string;
    owner: string;
    deadline: string;
    priority: "HIGH" | "MEDIUM" | "LOW";
  }[];
}

export async function buildStakeholderAnalysis(
  organizationId: string,
  context?: {
    auditedBy?: string;
    hasRegistry?: boolean;
    hasEngagementStrategy?: boolean;
    hasCommunicationPlan?: boolean;
    hasFeedbackLoop?: boolean;
    hasBiasAudit?: boolean;
    hasValidationFramework?: boolean;
    hasGoalAlignment?: boolean;
  },
): Promise<ComprehensiveAnalysis> {
  const registry = new StakeholderRegistry();
  const powerInterest = new PowerInterestMatrix();
  const underrepresented = new UnderrepresentedGroupTracker();
  const biasAudit = new BiasAuditEngine();
  const feedback = new FeedbackLoopManager();
  const metrics = new MetricsTracker();
  const engagementScorer = new EngagementScorer();

  // Collect summaries from all services
  const [
    registrySummary,
    piSummary,
    urSummary,
    feedbackSummary,
    engagementSummary,
    dashboard,
  ] = await Promise.all([
    registry.getSummary(),
    powerInterest.getMatrixSummary(),
    underrepresented.getSummary(),
    feedback.getSummary(),
    engagementScorer.getPortfolioSummary(),
    metrics.getDashboardSummary(),
  ]);

  // Run bias audit if stakeholder data is available
  let biasResult: BiasAuditResult | null = null;
  if (registrySummary.total > 0) {
    biasResult = await biasAudit.runAudit({
      organizationId,
      auditedBy: context?.auditedBy ?? "system",
      stakeholderCount: registrySummary.total,
      segmentCounts: registrySummary.bySegment as unknown as Record<
        string,
        number
      >,
      groupCounts: registrySummary.byUnderrepresentedGroup,
      regionCounts: registrySummary.byRegion,
      languageCounts: { en: registrySummary.total },
      accessibilityNeedCounts:
        registrySummary.byAccessibilityNeed as unknown as Record<
          string,
          number
        >,
      engagementStatusCounts: Object.fromEntries(
        Object.entries(registrySummary.byEngagementStatus).map(([k, _]) => [
          k,
          [],
        ]),
      ),
      powerDistribution: registrySummary.byPower as unknown as Record<
        string,
        number
      >,
      interestDistribution: registrySummary.byInterest as unknown as Record<
        string,
        number
      >,
    });
  }

  // Identify gaps
  const gaps: string[] = [];

  if (registrySummary.total === 0) {
    gaps.push("CRITICAL: No stakeholders registered in the system");
  }
  if (piSummary.totalAssessed === 0) {
    gaps.push("HIGH: No power/interest assessments completed");
  }
  if (urSummary.totalUnderrepresented === 0) {
    gaps.push("HIGH: No underrepresented group outreach has been conducted");
  }
  if (feedbackSummary.total === 0) {
    gaps.push("MEDIUM: No feedback items recorded — feedback loop not active");
  }
  if (biasResult && biasResult.overallScore < 70) {
    gaps.push(
      `HIGH: Bias audit score ${biasResult.overallScore}/100 — multiple findings need mitigation`,
    );
  }

  // Identify risks
  const risks: string[] = [];

  if (registrySummary.engagementRate < 50) {
    risks.push(
      `Engagement rate (${registrySummary.engagementRate}%) below 50% — stakeholder buy-in at risk`,
    );
  }
  if (
    feedbackSummary.averageResponseTimeDays !== null &&
    feedbackSummary.averageResponseTimeDays > 14
  ) {
    risks.push(
      `Average feedback response time (${feedbackSummary.averageResponseTimeDays} days) exceeds 14-day threshold`,
    );
  }
  if (urSummary.overallEngagementRate < 30) {
    risks.push(
      `Underrepresented group engagement (${urSummary.overallEngagementRate}%) critically low`,
    );
  }

  // Generate recommendations
  const recommendations: string[] = [
    ...urSummary.recommendations,
    ...(biasResult?.recommendations ?? []),
  ];

  // Next actions
  const nextActions: ComprehensiveAnalysis["nextActions"] = [
    {
      action: "Complete stakeholder registry",
      owner: "Project Manager",
      deadline: "Week 2",
      priority: "HIGH",
    },
    {
      action:
        "Conduct power/interest assessments for all registered stakeholders",
      owner: "Project Manager",
      deadline: "Week 4",
      priority: "HIGH",
    },
    {
      action: "Execute underrepresented group outreach plan",
      owner: "Community Manager",
      deadline: "Week 6",
      priority: "HIGH",
    },
    {
      action: "Deploy feedback collection system",
      owner: "Product Manager",
      deadline: "Week 4",
      priority: "MEDIUM",
    },
    {
      action: "Run initial bias audit",
      owner: "Accessibility Lead",
      deadline: "Week 3",
      priority: "HIGH",
    },
    {
      action: "Establish stakeholder council",
      owner: "Leadership",
      deadline: "Week 8",
      priority: "MEDIUM",
    },
  ];

  return {
    timestamp: new Date(),
    registry: registrySummary,
    powerInterest: piSummary,
    underrepresented: urSummary,
    feedback: feedbackSummary,
    engagement: engagementSummary,
    validation: dashboard,
    gaps,
    risks,
    recommendations,
    nextActions,
  };
}
