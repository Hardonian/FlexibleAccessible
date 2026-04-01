// ─── Bias Audit Engine ─────────────────────────────────────────────────
// Systematic bias detection, scoring, and mitigation tracking
// Fills gap: No bias audit, confirmation bias, survivorship bias,
//            technology bias, intersectional bias

import type {
  BiasAuditEntry,
  BiasAuditResult,
  BiasDimension,
  BiasSeverity,
  BiasMitigationStatus,
  RedTeamReview,
} from "../types/bias-audit";
import { BIAS_DIMENSIONS, BIAS_SEVERITIES } from "../types/bias-audit";

// ── Automated Bias Check Rules ─────────────────────────────────────────
// Each rule identifies a specific pattern that indicates potential bias

interface BiasCheckRule {
  dimension: BiasDimension;
  name: string;
  description: string;
  check: (context: BiasCheckContext) => BiasCheckResult;
}

interface BiasCheckContext {
  stakeholderCount: number;
  segmentCounts: Record<string, number>;
  groupCounts: Record<string, number>;
  regionCounts: Record<string, number>;
  languageCounts: Record<string, number>;
  accessibilityNeedCounts: Record<string, number>;
  engagementStatusCounts: Record<string, string[]>;
  powerDistribution: Record<string, number>;
  interestDistribution: Record<string, number>;
}

interface BiasCheckResult {
  passed: boolean;
  severity: BiasSeverity;
  finding: string;
  evidence: string;
  recommendation: string;
}

const auditEntries = new Map<string, BiasAuditEntry>();
let nextId = 1;

function generateId(): string {
  return `bias-${String(nextId++).padStart(4, "0")}`;
}

export class BiasAuditEngine {
  // ── Bias Check Rules ─────────────────────────────────────────────────

  private static readonly CHECK_RULES: BiasCheckRule[] = [
    {
      dimension: "ACCESSIBILITY_VISIBLE",
      name: "Invisible disability representation",
      description:
        "Check if cognitive, mental health, and chronic pain groups are represented",
      check: (ctx) => {
        const invisibleGroups = [
          "COGNITIVE_LEARNING",
          "MENTAL_HEALTH",
          "CHRONIC_PAIN_FATIGUE",
        ];
        const visibleGroups = [
          "VISUAL_IMPAIRMENT",
          "MOTOR_IMPAIRMENT",
          "HEARING_IMPAIRMENT",
        ];

        const invisibleCount = invisibleGroups.reduce(
          (sum, g) => sum + (ctx.groupCounts[g] || 0),
          0,
        );
        const visibleCount = visibleGroups.reduce(
          (sum, g) => sum + (ctx.groupCounts[g] || 0),
          0,
        );

        if (invisibleCount === 0 && visibleCount === 0) {
          return {
            passed: false,
            severity: "MEDIUM",
            finding: "No stakeholders with disabilities are represented",
            evidence: "No disability groups were found in the stakeholder data",
            recommendation:
              "Recruit stakeholders with both visible and invisible disabilities",
          };
        }

        const passed = invisibleCount >= visibleCount * 0.5;
        return {
          passed,
          severity: passed ? "LOW" : "HIGH",
          finding: passed
            ? "Invisible disability groups have adequate representation"
            : "Invisible disability groups are underrepresented compared to visible groups",
          evidence: `Visible groups: ${visibleCount}, Invisible groups: ${invisibleCount}`,
          recommendation: passed
            ? "Maintain current balance"
            : "Actively recruit participants with cognitive, mental health, and chronic pain conditions",
        };
      },
    },
    {
      dimension: "CONFIRMATION_BIAS",
      name: "Confirmation bias in engagement",
      description:
        "Check if only engaged/responsive stakeholders are being tracked",
      check: (ctx) => {
        const total = ctx.stakeholderCount;
        const engaged =
          (ctx.engagementStatusCounts["ACTIVE"] || []).length +
          (ctx.engagementStatusCounts["CHAMPION"] || []).length;
        const nonEngaged =
          (ctx.engagementStatusCounts["NOT_CONTACTED"] || []).length +
          (ctx.engagementStatusCounts["LOST"] || []).length +
          (ctx.engagementStatusCounts["DISINTERESTED"] || []).length;

        const engagementRatio = total > 0 ? engaged / total : 0;
        const nonEngagementRatio = total > 0 ? nonEngaged / total : 0;

        const passed = nonEngagementRatio >= 0.1; // At least 10% should be non-engaged for diversity
        return {
          passed,
          severity: passed ? "LOW" : "MEDIUM",
          finding: passed
            ? "Sufficient diversity in engagement status"
            : "Over-indexing on engaged stakeholders; potential confirmation bias",
          evidence: `Engaged: ${engaged}, Non-engaged: ${nonEngaged}, Ratio: ${engagementRatio.toFixed(2)}`,
          recommendation: passed
            ? "Continue monitoring"
            : "Actively seek input from less engaged or resistant stakeholders",
        };
      },
    },
    {
      dimension: "SURVIVORSHIP_BIAS",
      name: "Survivorship bias check",
      description: "Ensure failed or disengaged stakeholders are tracked",
      check: (ctx) => {
        const lostCount = (ctx.engagementStatusCounts["LOST"] || []).length;
        const resistantCount = (ctx.engagementStatusCounts["RESISTANT"] || [])
          .length;
        const total = ctx.stakeholderCount;

        const failureRate =
          total > 0 ? (lostCount + resistantCount) / total : 0;
        const passed = failureRate >= 0.05; // At least 5% should represent failure cases

        return {
          passed,
          severity: passed ? "LOW" : "MEDIUM",
          finding: passed
            ? "Failure and disengagement tracked"
            : "Insufficient tracking of failed or disengaged stakeholders",
          evidence: `Lost: ${lostCount}, Resistant: ${resistantCount}, Total: ${total}`,
          recommendation: passed
            ? "Maintain tracking"
            : "Document reasons for disengagement to learn from failures",
        };
      },
    },
    {
      dimension: "TECHNOLOGY_BIAS",
      name: "Digital-first bias",
      description: "Check if non-digital channels are used for engagement",
      check: (ctx) => {
        // Check if there's reasonable channel diversity
        const regionCount = Object.keys(ctx.regionCounts).length;
        if (regionCount === 0) {
          return {
            passed: false,
            severity: "MEDIUM",
            finding: "No geographic regions specified for stakeholders",
            evidence: "Region count is 0",
            recommendation: "Add region data to stakeholders to assess geographic bias",
          };
        }
        const hasDigitalOnly = ctx.regionCounts["DIGITAL_ONLY"] !== undefined;
        const hasMultipleRegions = regionCount > 1;

        return {
          passed: !hasDigitalOnly || hasMultipleRegions,
          severity: "MEDIUM",
          finding:
            "Technology bias assessment requires manual review of engagement channels",
          evidence: `Regions tracked: ${Object.keys(ctx.regionCounts).length}`,
          recommendation:
            "Ensure non-digital engagement channels (phone, in-person, mail) are available",
        };
      },
    },
    {
      dimension: "INTERSECTIONAL_BIAS",
      name: "Intersectional analysis",
      description: "Check for compound barrier representation",
      check: (ctx) => {
        const intersectionalCount = ctx.groupCounts["INTERSECTIONAL"] || 0;
        const total = ctx.stakeholderCount;

        const passed = intersectionalCount > 0;
        return {
          passed,
          severity: passed ? "LOW" : "HIGH",
          finding: passed
            ? "Intersectional stakeholders identified"
            : "No intersectional analysis performed",
          evidence: `Intersectional identified: ${intersectionalCount}, Total: ${total}`,
          recommendation: passed
            ? "Continue intersectional outreach"
            : "Map compound barriers (e.g., low-income + disability, non-English + cognitive)",
        };
      },
    },
    {
      dimension: "GEOGRAPHIC_BIAS",
      name: "Geographic representation",
      description: "Check for geographic diversity in stakeholder base",
      check: (ctx) => {
        const regionCount = Object.keys(ctx.regionCounts).length;
        const passed = regionCount >= 2;

        return {
          passed,
          severity: passed ? "LOW" : "MEDIUM",
          finding: passed
            ? "Multiple regions represented"
            : "Limited geographic diversity in stakeholder base",
          evidence: `Regions: ${regionCount}`,
          recommendation: passed
            ? "Maintain geographic diversity"
            : "Include stakeholders from different regions/countries for cultural context",
        };
      },
    },
    {
      dimension: "LANGUAGE_BIAS",
      name: "Language diversity",
      description: "Check for multi-language support",
      check: (ctx) => {
        const languageCount = Object.keys(ctx.languageCounts).length;
        const nonEnglish = Object.entries(ctx.languageCounts)
          .filter(([lang]) => lang !== "en")
          .reduce((sum, [_, count]) => sum + count, 0);

        const passed = languageCount >= 2 && nonEnglish > 0;
        return {
          passed,
          severity: passed ? "LOW" : "MEDIUM",
          finding: passed
            ? "Multi-language stakeholder base"
            : "Primarily English-speaking stakeholder base",
          evidence: `Languages: ${languageCount}, Non-English: ${nonEnglish}`,
          recommendation: passed
            ? "Continue language diversity"
            : "Recruit non-English speaking stakeholders for international accessibility",
        };
      },
    },
    {
      dimension: "ECONOMIC_BIAS",
      name: "Economic diversity",
      description: "Check for low-income/tech-constrained representation",
      check: (ctx) => {
        const lowIncomeCount = ctx.groupCounts["LOW_INCOME_TECH_LIMITED"] || 0;
        const passed = lowIncomeCount > 0;

        return {
          passed,
          severity: passed ? "LOW" : "HIGH",
          finding: passed
            ? "Low-income/tech-constrained stakeholders included"
            : "No representation from low-income or technology-constrained groups",
          evidence: `Low-income/tech-limited identified: ${lowIncomeCount}`,
          recommendation: passed
            ? "Maintain this representation"
            : "Partner with community organizations to reach economically constrained users",
        };
      },
    },
    {
      dimension: "AGE_BIAS",
      name: "Age diversity",
      description: "Check for aging population representation",
      check: (ctx) => {
        const agingCount = ctx.groupCounts["AGING_POPULATION"] || 0;
        const passed = agingCount > 0;

        return {
          passed,
          severity: passed ? "LOW" : "MEDIUM",
          finding: passed
            ? "Aging population represented"
            : "No aging population stakeholders identified",
          evidence: `Aging population identified: ${agingCount}`,
          recommendation: passed
            ? "Continue engagement"
            : "Include age-related accessibility needs in stakeholder analysis",
        };
      },
    },
    {
      dimension: "SELECTION_BIAS",
      name: "Segment balance",
      description: "Check for balanced representation across segments",
      check: (ctx) => {
        const segmentValues = Object.values(ctx.segmentCounts);
        const total = segmentValues.reduce((sum, v) => sum + v, 0);

        if (total === 0) {
          return {
            passed: false,
            severity: "CRITICAL",
            finding: "No stakeholders registered",
            evidence: "Total count: 0",
            recommendation:
              "Register stakeholders before performing balance analysis",
          };
        }

        // Check if any segment has > 50% of total (dominance)
        const maxSegment = Math.max(...segmentValues);
        const dominated = maxSegment / total > 0.5;

        return {
          passed: !dominated,
          severity: dominated ? "HIGH" : "LOW",
          finding: dominated
            ? "One segment dominates the stakeholder base"
            : "Balanced segment representation",
          evidence: `Segments: ${JSON.stringify(ctx.segmentCounts)}`,
          recommendation: dominated
            ? "Diversify stakeholder base to avoid single-segment dominance"
            : "Maintain segment balance",
        };
      },
    },
  ];

  // ── Audit Execution ──────────────────────────────────────────────────

  async runAudit(context: {
    organizationId: string;
    auditedBy: string;
    stakeholderCount: number;
    segmentCounts: Record<string, number>;
    groupCounts: Record<string, number>;
    regionCounts: Record<string, number>;
    languageCounts: Record<string, number>;
    accessibilityNeedCounts: Record<string, number>;
    engagementStatusCounts: Record<string, string[]>;
    powerDistribution: Record<string, number>;
    interestDistribution: Record<string, number>;
  }): Promise<BiasAuditResult> {
    const auditContext: BiasCheckContext = {
      stakeholderCount: context.stakeholderCount,
      segmentCounts: context.segmentCounts,
      groupCounts: context.groupCounts,
      regionCounts: context.regionCounts,
      languageCounts: context.languageCounts,
      accessibilityNeedCounts: context.accessibilityNeedCounts,
      engagementStatusCounts: context.engagementStatusCounts,
      powerDistribution: context.powerDistribution,
      interestDistribution: context.interestDistribution,
    };

    const entries: BiasAuditEntry[] = [];
    let totalScore = 0;
    let criticalFindings = 0;

    for (const rule of BiasAuditEngine.CHECK_RULES) {
      const result = rule.check(auditContext);
      const id = generateId();
      const now = new Date();

      const entry: BiasAuditEntry = {
        id,
        dimension: rule.dimension,
        severity: result.severity,
        finding: result.finding,
        evidence: result.evidence,
        mitigationPlan: result.recommendation,
        mitigationStatus: result.passed ? "MITIGATED" : "IDENTIFIED",
        createdAt: now,
        updatedAt: now,
      };

      entries.push(entry);
      auditEntries.set(id, entry);

      // Score: 0-10 per check, higher = less biased
      const scoreMap: Record<BiasSeverity, number> = {
        CRITICAL: 0,
        HIGH: 3,
        MEDIUM: 6,
        LOW: 9,
        INFO: 10,
      };
      totalScore += result.passed ? 10 : scoreMap[result.severity];

      if (result.severity === "CRITICAL") criticalFindings++;
    }

    const overallScore = Math.round(
      (totalScore / (BiasAuditEngine.CHECK_RULES.length * 10)) * 100,
    );

    const mitigatedCount = entries.filter(
      (e) => e.mitigationStatus === "MITIGATED",
    ).length;

    const recommendations = entries
      .filter((e) => e.mitigationStatus !== "MITIGATED" && e.mitigationPlan)
      .map((e) => `[${e.dimension}] ${e.mitigationPlan!}`);

    const result: BiasAuditResult = {
      id: generateId(),
      organizationId: context.organizationId,
      auditedAt: new Date(),
      auditedBy: context.auditedBy,
      entries,
      overallScore,
      criticalFindings,
      mitigatedCount,
      acceptedRiskCount: entries.filter(
        (e) => e.mitigationStatus === "ACCEPTED_RISK",
      ).length,
      recommendations,
      nextAuditDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
    };

    return result;
  }

  // ── Red Team Review ──────────────────────────────────────────────────

  async conductRedTeamReview(review: {
    analysisId: string;
    reviewers: string[];
    analysisDescription: string;
  }): Promise<RedTeamReview> {
    // Generate challenger questions based on the analysis
    const challengerQuestions = [
      "What assumptions are we making about our user base?",
      "Whose voices are missing from this analysis?",
      "How would this analysis change if we included [group]?",
      "What data would contradict our current conclusions?",
      "Are we solving the right problem, or the problem we want to solve?",
      "What would happen if we did nothing?",
      "Who benefits from the current approach?",
      "What are the second-order effects of our decisions?",
      "How would a hostile critic interpret our data?",
      "What would change if our budget was 10x smaller or larger?",
    ];

    const alternativeHypotheses = [
      "The identified stakeholders may not represent the actual end users",
      "Power dynamics may be shifting and our static analysis is outdated",
      "Underrepresented groups may have different needs than assumed",
      "Accessibility barriers may be systemic, not just technical",
    ];

    const contradictions = [
      "Check: Do champion stakeholders also report accessibility barriers?",
      "Check: Are high-power stakeholders also high-interest, or are they separate groups?",
      "Check: Do engagement metrics contradict satisfaction scores?",
    ];

    const weakAssumptions = [
      "All stakeholders have equal access to digital communication channels",
      "Engagement status accurately reflects actual involvement",
      "Power and interest levels are static over time",
      "Needs identified in surveys match actual implementation needs",
    ];

    return {
      id: generateId(),
      analysisId: review.analysisId,
      reviewers: review.reviewers,
      challengerQuestions,
      alternativeHypotheses,
      contradictions,
      weakAssumptions,
      recommendations: [
        "Conduct external validation with a non-project stakeholder group",
        "Run bias audit quarterly with fresh eyes",
        "Include hostile outsider in review process",
        "Document all assumptions and track them against reality",
      ],
      outcome: "CONDITIONAL",
      notes: "Red team review generated; findings require manual investigation",
      conductedAt: new Date(),
    };
  }

  // ── Export ────────────────────────────────────────────────────────────

  async getAllEntries(): Promise<BiasAuditEntry[]> {
    return Array.from(auditEntries.values());
  }

  async getEntriesByDimension(
    dimension: BiasDimension,
  ): Promise<BiasAuditEntry[]> {
    return Array.from(auditEntries.values()).filter(
      (e) => e.dimension === dimension,
    );
  }

  async clear(): Promise<void> {
    auditEntries.clear();
    nextId = 1;
  }
}
