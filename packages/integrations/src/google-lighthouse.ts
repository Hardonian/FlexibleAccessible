/**
 * Google Lighthouse & Lighthouse CI (LHCI) Integration Adapter
 * Parses Google Lighthouse JSON audit results and formats AROS findings into LHCI assertions.
 */

export interface LighthouseAuditItem {
  id: string;
  title: string;
  description: string;
  score: number | null;
  scoreDisplayMode?: string;
  details?: {
    type?: string;
    items?: Array<{
      node?: {
        selector?: string;
        snippet?: string;
        nodeLabel?: string;
        explanation?: string;
      };
      [key: string]: unknown;
    }>;
  };
}

export interface LighthouseResult {
  lighthouseVersion?: string;
  requestedUrl?: string;
  finalDisplayedUrl?: string;
  fetchTime?: string;
  categories?: {
    accessibility?: {
      id: "accessibility";
      title: string;
      score: number | null;
      auditRefs?: Array<{ id: string; weight: number; group?: string }>;
    };
    [key: string]: unknown;
  };
  audits?: Record<string, LighthouseAuditItem>;
}

export interface ConvertedA11yFinding {
  ruleId: string;
  title: string;
  description: string;
  severity: "critical" | "serious" | "moderate" | "minor";
  selector: string;
  snippet?: string;
  wcagCriteria?: string[];
  source: "google-lighthouse" | "chrome-devtools" | "foss-pa11y";
}

/**
 * Maps Lighthouse audit IDs to standard WCAG criteria
 */
const LIGHTHOUSE_WCAG_MAP: Record<string, { severity: ConvertedA11yFinding["severity"]; wcag: string[] }> = {
  "color-contrast": { severity: "serious", wcag: ["WCAG 2.2 1.4.3"] },
  "image-alt": { severity: "critical", wcag: ["WCAG 2.2 1.1.1"] },
  "button-name": { severity: "critical", wcag: ["WCAG 2.2 4.1.2"] },
  "link-name": { severity: "serious", wcag: ["WCAG 2.2 2.4.4", "WCAG 2.2 4.1.2"] },
  "document-title": { severity: "moderate", wcag: ["WCAG 2.2 2.4.2"] },
  "html-has-lang": { severity: "serious", wcag: ["WCAG 2.2 3.1.1"] },
  "aria-allowed-attr": { severity: "serious", wcag: ["WCAG 2.2 4.1.2"] },
  "aria-required-attr": { severity: "critical", wcag: ["WCAG 2.2 4.1.2"] },
  "aria-valid-attr-value": { severity: "serious", wcag: ["WCAG 2.2 4.1.2"] },
  "label": { severity: "critical", wcag: ["WCAG 2.2 1.3.1", "WCAG 2.2 4.1.2"] },
  "target-size": { severity: "serious", wcag: ["WCAG 2.2 2.5.8"] },
};

/**
 * Parses Google Lighthouse JSON audit output into canonical AROS findings
 */
export function parseLighthouseReport(lhr: LighthouseResult): ConvertedA11yFinding[] {
  const findings: ConvertedA11yFinding[] = [];
  if (!lhr.audits) return findings;

  const a11yRefs = lhr.categories?.accessibility?.auditRefs || [];
  const auditIdsToCheck =
    a11yRefs.length > 0 ? a11yRefs.map((ref) => ref.id) : Object.keys(lhr.audits);

  for (const auditId of auditIdsToCheck) {
    const audit = lhr.audits[auditId];
    if (!audit) continue;

    // A score of 0 or scoreDisplayMode 'binary' with score 0 indicates a failure
    if (audit.score !== null && audit.score < 1 && audit.details?.items) {
      const mapping = LIGHTHOUSE_WCAG_MAP[auditId] || { severity: "moderate", wcag: ["WCAG 2.2 Level A/AA"] };

      for (const item of audit.details.items) {
        findings.push({
          ruleId: audit.id,
          title: audit.title,
          description: audit.description,
          severity: mapping.severity,
          selector: item.node?.selector || item.node?.nodeLabel || "body",
          snippet: item.node?.snippet,
          wcagCriteria: mapping.wcag,
          source: "google-lighthouse",
        });
      }
    }
  }

  return findings;
}

/**
 * Formats AROS findings into Google Lighthouse CI (LHCI) assertion format
 */
export function exportToLighthouseAssertions(findings: ConvertedA11yFinding[]): {
  passed: boolean;
  score: number;
  assertionResults: Array<{ auditProperty: string; expected: number; actual: number; operator: string }>;
} {
  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const seriousCount = findings.filter((f) => f.severity === "serious").length;
  const totalViolations = findings.length;

  // Emulate Lighthouse a11y category score (1.0 = 100%, each critical deducts 0.2, serious 0.1)
  const deduction = criticalCount * 0.2 + seriousCount * 0.1;
  const score = Math.max(0, parseFloat((1.0 - deduction).toFixed(2)));
  const passed = totalViolations === 0;

  return {
    passed,
    score,
    assertionResults: [
      {
        auditProperty: "categories:accessibility",
        expected: 0.9,
        actual: score,
        operator: ">=",
      },
    ],
  };
}
