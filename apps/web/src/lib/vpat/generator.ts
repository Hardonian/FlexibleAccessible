/**
 * VPAT (Voluntary Product Accessibility Template) generator.
 * Produces a structured JSON report mapping findings to WCAG 2.2 criteria,
 * suitable for PDF export or direct consumption by legal teams.
 */

import { prisma } from "@aros/db";

export interface VpatRow {
  criteria: string;
  level: string;
  conformanceStatus:
    | "supports"
    | "partially-supports"
    | "does-not-support"
    | "not-applicable";
  explanation: string;
  findings: Array<{
    id: string;
    ruleId: string;
    impact: string;
    description: string;
    status: string;
    occurrenceCount: number;
  }>;
}

export interface VpatReport {
  productName: string;
  productUrl: string;
  reportDate: string;
  wcagVersion: string;
  conformanceLevel: string;
  summary: {
    totalCriteria: number;
    supports: number;
    partiallySupports: number;
    doesNotSupport: number;
    notApplicable: number;
    openFindings: number;
    resolvedFindings: number;
  };
  rows: VpatRow[];
  methodology: string;
  limitations: string[];
}

/** All WCAG 2.2 Level A + AA criteria. */
const WCAG_CRITERIA: Array<{ id: string; level: string; name: string }> = [
  { id: "1.1.1", level: "A", name: "Non-text Content" },
  { id: "1.2.1", level: "A", name: "Audio-only and Video-only (Prerecorded)" },
  { id: "1.2.2", level: "A", name: "Captions (Prerecorded)" },
  { id: "1.2.3", level: "A", name: "Audio Description or Media Alternative" },
  { id: "1.2.5", level: "AA", name: "Audio Description (Prerecorded)" },
  { id: "1.3.1", level: "A", name: "Info and Relationships" },
  { id: "1.3.2", level: "A", name: "Meaningful Sequence" },
  { id: "1.3.3", level: "A", name: "Sensory Characteristics" },
  { id: "1.3.4", level: "AA", name: "Orientation" },
  { id: "1.3.5", level: "AA", name: "Identify Input Purpose" },
  { id: "1.4.1", level: "A", name: "Use of Color" },
  { id: "1.4.2", level: "A", name: "Audio Control" },
  { id: "1.4.3", level: "AA", name: "Contrast (Minimum)" },
  { id: "1.4.4", level: "AA", name: "Resize Text" },
  { id: "1.4.5", level: "AA", name: "Images of Text" },
  { id: "1.4.10", level: "AA", name: "Reflow" },
  { id: "1.4.11", level: "AA", name: "Non-text Contrast" },
  { id: "1.4.12", level: "AA", name: "Text Spacing" },
  { id: "1.4.13", level: "AA", name: "Content on Hover or Focus" },
  { id: "2.1.1", level: "A", name: "Keyboard" },
  { id: "2.1.2", level: "A", name: "No Keyboard Trap" },
  { id: "2.1.4", level: "A", name: "Character Key Shortcuts" },
  { id: "2.2.1", level: "A", name: "Timing Adjustable" },
  { id: "2.2.2", level: "A", name: "Pause, Stop, Hide" },
  { id: "2.3.1", level: "A", name: "Three Flashes or Below Threshold" },
  { id: "2.4.1", level: "A", name: "Bypass Blocks" },
  { id: "2.4.2", level: "A", name: "Page Titled" },
  { id: "2.4.3", level: "A", name: "Focus Order" },
  { id: "2.4.4", level: "A", name: "Link Purpose (In Context)" },
  { id: "2.4.5", level: "AA", name: "Multiple Ways" },
  { id: "2.4.6", level: "AA", name: "Headings and Labels" },
  { id: "2.4.7", level: "AA", name: "Focus Visible" },
  { id: "2.4.11", level: "AA", name: "Focus Not Obscured (Minimum)" },
  { id: "2.5.1", level: "A", name: "Pointer Gestures" },
  { id: "2.5.2", level: "A", name: "Pointer Cancellation" },
  { id: "2.5.3", level: "A", name: "Label in Name" },
  { id: "2.5.4", level: "A", name: "Motion Actuation" },
  { id: "3.1.1", level: "A", name: "Language of Page" },
  { id: "3.1.2", level: "AA", name: "Language of Parts" },
  { id: "3.2.1", level: "A", name: "On Focus" },
  { id: "3.2.2", level: "A", name: "On Input" },
  { id: "3.2.3", level: "AA", name: "Consistent Navigation" },
  { id: "3.2.4", level: "AA", name: "Consistent Identification" },
  { id: "3.2.6", level: "A", name: "Consistent Help" },
  { id: "3.3.1", level: "A", name: "Error Identification" },
  { id: "3.3.2", level: "A", name: "Labels or Instructions" },
  { id: "3.3.3", level: "AA", name: "Error Suggestion" },
  {
    id: "3.3.4",
    level: "AA",
    name: "Error Prevention (Legal, Financial, Data)",
  },
  { id: "3.3.7", level: "A", name: "Redundant Entry" },
  { id: "3.3.8", level: "AA", name: "Accessible Authentication (Minimum)" },
  { id: "4.1.2", level: "A", name: "Name, Role, Value" },
  { id: "4.1.3", level: "AA", name: "Status Messages" },
];

/**
 * Maps axe-core rule IDs to WCAG criteria IDs.
 * Uses wcagTags from findings where available, falls back to rule metadata.
 */
function mapRuleToCriteria(ruleId: string, wcagTags: string[]): string[] {
  const criteria: string[] = [];

  // Extract from wcagTags (e.g., ["wcag2a", "wcag111"])
  for (const tag of wcagTags) {
    const match = tag.match(/wcag(\d{3,4})/);
    if (match) {
      const digits = match[1];
      // Convert 3-digit or 4-digit to criteria ID
      if (digits.length === 3) {
        criteria.push(`${digits[0]}.${digits[1]}.${digits[2]}`);
      } else if (digits.length === 4) {
        criteria.push(`${digits[0]}.${digits[1]}.${digits[2]}.${digits[3]}`);
      }
    }
  }

  return [...new Set(criteria)];
}

/**
 * Generate a VPAT report for a site.
 */
export async function generateVpatReport(
  siteId: string,
  organizationName?: string,
): Promise<VpatReport> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { name: true, domain: true },
  });

  if (!site) throw new Error("Site not found");

  const findings = await prisma.canonicalFinding.findMany({
    where: { siteId },
    select: {
      id: true,
      ruleId: true,
      impact: true,
      description: true,
      status: true,
      wcagTags: true,
      wcagCriteria: true,
      occurrenceCount: true,
      truthStatus: true,
    },
    orderBy: { impact: "asc" },
  });

  // Map findings to criteria
  const findingsByCriteria = new Map<string, typeof findings>();

  for (const finding of findings) {
    const criteriaIds =
      finding.wcagCriteria.length > 0
        ? finding.wcagCriteria
        : mapRuleToCriteria(finding.ruleId, finding.wcagTags);

    for (const criteriaId of criteriaIds) {
      if (!findingsByCriteria.has(criteriaId)) {
        findingsByCriteria.set(criteriaId, []);
      }
      findingsByCriteria.get(criteriaId)!.push(finding);
    }
  }

  // Build VPAT rows
  const rows: VpatRow[] = WCAG_CRITERIA.map((criteria) => {
    const criteriaFindings = findingsByCriteria.get(criteria.id) ?? [];

    if (criteriaFindings.length === 0) {
      return {
        criteria: `${criteria.id} ${criteria.name}`,
        level: criteria.level,
        conformanceStatus: "supports" as const,
        explanation:
          "No violations detected by automated scanning. Manual testing recommended for complete verification.",
        findings: [],
      };
    }

    const openFindings = criteriaFindings.filter(
      (f) => f.status === "OPEN" || f.status === "IN_PROGRESS",
    );
    const resolvedFindings = criteriaFindings.filter(
      (f) => f.status === "RESOLVED" || f.status === "MITIGATED",
    );

    let conformanceStatus: VpatRow["conformanceStatus"];
    if (openFindings.length === 0 && resolvedFindings.length > 0) {
      conformanceStatus = "supports";
    } else if (resolvedFindings.length > 0) {
      conformanceStatus = "partially-supports";
    } else {
      conformanceStatus = "does-not-support";
    }

    return {
      criteria: `${criteria.id} ${criteria.name}`,
      level: criteria.level,
      conformanceStatus,
      explanation:
        openFindings.length > 0
          ? `${openFindings.length} open finding(s) affecting this criterion. Remediation in progress.`
          : `${resolvedFindings.length} finding(s) resolved.`,
      findings: criteriaFindings.map((f) => ({
        id: f.id,
        ruleId: f.ruleId,
        impact: f.impact,
        description: f.description,
        status: f.status,
        occurrenceCount: f.occurrenceCount,
      })),
    };
  });

  const summary = {
    totalCriteria: rows.length,
    supports: rows.filter((r) => r.conformanceStatus === "supports").length,
    partiallySupports: rows.filter(
      (r) => r.conformanceStatus === "partially-supports",
    ).length,
    doesNotSupport: rows.filter(
      (r) => r.conformanceStatus === "does-not-support",
    ).length,
    notApplicable: rows.filter((r) => r.conformanceStatus === "not-applicable")
      .length,
    openFindings: findings.filter(
      (f) => f.status === "OPEN" || f.status === "IN_PROGRESS",
    ).length,
    resolvedFindings: findings.filter(
      (f) => f.status === "RESOLVED" || f.status === "MITIGATED",
    ).length,
  };

  return {
    productName: organizationName
      ? `${organizationName} - ${site.name}`
      : site.name,
    productUrl: `https://${site.domain}`,
    reportDate: new Date().toISOString(),
    wcagVersion: "2.2",
    conformanceLevel: "AA",
    summary,
    rows,
    methodology:
      "This report was generated by AROS using automated axe-core scanning with Playwright browser rendering. Automated tools detect approximately 30-40% of WCAG criteria. Manual expert review is recommended for full conformance assessment.",
    limitations: [
      "Automated scanning covers approximately 30-40% of WCAG 2.2 criteria.",
      "Criteria requiring human judgment (e.g., content clarity, meaningful sequence) are marked as 'supports' when no automated violations are found, but manual review is recommended.",
      "Dynamic content loaded after initial page render may require additional testing.",
      "Screen reader and keyboard-only testing require manual verification.",
    ],
  };
}
