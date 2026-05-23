// Package vpat generates Voluntary Product Accessibility Templates (VPAT)
import type {
  AccessibilityScan,
  VPATReport,
  WCAGCriteria,
  ConformanceLevel,
} from "./types";

/**
 * Generate a VPAT 2.1 report from accessibility scan results
 */
export function generateVPAT(scan: AccessibilityScan): VPATReport {
  const timestamp = new Date().toISOString();

  return {
    reportId: `VPAT-${Date.now()}`,
    generatedAt: timestamp,
    productName: scan.productName || "Unknown Product",
    productVersion: scan.productVersion || "1.0",
    vendorName: scan.vendorName || "Unknown Vendor",
    platform: scan.platform || "Web",

    // WCAG 2.1 compliance
    wcagVersion: '2.1',
    conformanceLevel: scan.conformanceLevel || 'AA',
    
    // Count by severity
    criteria: generateCriteriaReport(scan.findings),

    // Summary
    summary: generateSummary(scan.findings),

    // Remarks
    remarks: scan.remarks || "",

    // Optional: linked scan
    linkedScanId: scan.scanId || undefined,
  };
}

/**
 * Generate criteria-level report
 */
function generateCriteriaReport(
  findings: AccessibilityScan["findings"],
): WCAGCriteria[] {
  // Group findings by WCAG criteria
  const grouped = new Map<string, typeof findings>();

  for (const f of findings) {
    const existing = grouped.get(f.wcagCriteria) || [];
    grouped.set(f.wcagCriteria, [...existing, f]);
  }

  // Generate report for each criterion
  const criteria: WCAGCriteria[] = [];

  for (const [criterion, criterionFindings] of grouped) {
    const supported = criterionFindings.every((f) => f.resolved);
    const notes =
      criterionFindings.length > 0
        ? criterionFindings
            .map((f) => `${f.severity}: ${f.description}`)
            .join("; ")
        : "All tests passed";

    criteria.push({
      criterion,
      supported,
      notes,
      violations: criterionFindings.filter((f) => !f.resolved).length,
    });
  }

  return criteria;
}

/**
 * Generate summary section
 */
function generateSummary(findings: AccessibilityScan["findings"]): string {
  const critical = findings.filter(
    (f) => f.severity === "critical" && !f.resolved,
  ).length;
  const serious = findings.filter(
    (f) => f.severity === "serious" && !f.resolved,
  ).length;
  const moderate = findings.filter(
    (f) => f.severity === "moderate" && !f.resolved,
  ).length;
  const minor = findings.filter(
    (f) => f.severity === "minor" && !f.resolved,
  ).length;
  const passed = findings.filter((f) => f.resolved).length;

  return `
## Accessibility Conformance Summary

| Severity | Violations |
|----------|------------|
| Critical | ${critical} |
| Serious | ${serious} |
| Moderate | ${moderate} |
| Minor | ${minor} |
| Passed | ${passed} |

**Total Issues:** ${critical + serious + moderate + minor}
  `.trim();
}

/**
 * Export VPAT as HTML
 */
export function exportAsHTML(report: VPATReport): string {
  const criteriaRows = report.criteria
    .map(
      (c) => `
      <tr>
        <td>${c.criterion}</td>
        <td>${c.supported ? "Supported" : "Not Supported"}</td>
        <td>${c.notes}</td>
      </tr>
    `,
    )
    .join("");

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>VPAT - ${report.productName}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background: #1a1a2e; color: white; }
    .supported { color: green; }
    .not-supported { color: red; }
  </style>
</head>
<body>
  <h1>Voluntary Product Accessibility Template (VPAT)</h1>
  <p><strong>Product:</strong> ${report.productName}</p>
  <p><strong>Version:</strong> ${report.productVersion}</p>
  <p><strong>Vendor:</strong> ${report.vendorName}</p>
  <p><strong>WCAG Version:</strong> ${report.wcagVersion}</p>
  <p><strong>Conformance Level:</strong> ${report.conformanceLevel}</p>
  <p><strong>Generated:</strong> ${report.generatedAt}</p>

  <h2>Criteria Results</h2>
  <table>
    <thead>
      <tr>
        <th>WCAG Criterion</th>
        <th>Status</th>
        <th>Notes</th>
      </tr>
    </thead>
    <tbody>
      ${criteriaRows}
    </tbody>
  </table>

  <h2>Summary</h2>
  <pre>${report.summary}</pre>
</body>
</html>
  `.trim();
}

/**
 * Export VPAT as Markdown
 */
export function exportAsMarkdown(report: VPATReport): string {
  const criteriaTable = report.criteria
    .map(
      (c) =>
        `| ${c.criterion} | ${c.supported ? "✅ Supported" : "❌ Not Supported"} | ${c.notes} |`,
    )
    .join("\n");

  return `
# VPAT - ${report.productName}

**Version:** ${report.productVersion}  
**Vendor:** ${report.vendorName}  
**WCAG Version:** ${report.wcagVersion}  
**Conformance Level:** ${report.conformanceLevel}
**Generated:** ${report.generatedAt}

## Criteria Results

| Criterion | Status | Notes |
|-----------|--------|-------|
${criteriaTable}

## Summary

${report.summary}

${report.remarks ? `## Remarks\n${report.remarks}` : ""}
  `.trim();
}

/**
 * Export VPAT as JSON
 */
export function exportAsJSON(report: VPATReport): string {
  return JSON.stringify(report, null, 2);
}
