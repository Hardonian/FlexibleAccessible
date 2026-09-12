/**
 * FOSS Pa11y & Axe-Core CLI Ingestion Adapter
 * Ingests Pa11y JSON output and standardizes it into canonical AROS findings.
 */

import type { ConvertedA11yFinding } from "./google-lighthouse";

export interface Pa11yResultItem {
  code: string;
  type: "error" | "warning" | "notice";
  typeCode: number;
  message: string;
  context: string;
  selector: string;
  runner: string;
  runnerExtras?: Record<string, unknown>;
}

export function parsePa11yReport(results: Pa11yResultItem[]): ConvertedA11yFinding[] {
  return results.map((item) => {
    let severity: ConvertedA11yFinding["severity"] = "moderate";
    const lowerCode = item.code.toLowerCase();
    if (item.type === "error") {
      severity = lowerCode.includes("contrast") || lowerCode.includes("alt") || lowerCode.includes("1_4_3") ? "critical" : "serious";
    } else if (item.type === "warning") {
      severity = "moderate";
    } else {
      severity = "minor";
    }

    return {
      ruleId: item.code,
      title: item.message,
      description: item.message,
      severity,
      selector: item.selector,
      snippet: item.context,
      wcagCriteria: [item.code.split(".").slice(0, 3).join(".")],
      source: "foss-pa11y",
    };
  });
}
