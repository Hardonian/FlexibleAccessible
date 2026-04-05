export type FindingsListSearchParams = {
  page?: string;
  severity?: string;
  status?: string;
  siteId?: string;
  ruleId?: string;
  evidenceSource?: string;
};

/**
 * Stable query string for findings list filters + pagination (all params preserved).
 */
export function findingsListQueryString(
  params: FindingsListSearchParams,
  page: number,
): string {
  const q = new URLSearchParams();
  if (page > 1) q.set("page", String(page));
  if (params.severity) q.set("severity", params.severity);
  if (params.status) q.set("status", params.status);
  if (params.siteId) q.set("siteId", params.siteId);
  if (params.ruleId) q.set("ruleId", params.ruleId);
  if (params.evidenceSource) q.set("evidenceSource", params.evidenceSource);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function findingsActiveFilterSummary(params: FindingsListSearchParams): {
  parts: string[];
  hasFilters: boolean;
} {
  const parts: string[] = [];
  if (params.severity) parts.push(`Severity: ${params.severity.toLowerCase()}`);
  if (params.status) parts.push(`Status: ${params.status.toLowerCase().replaceAll("_", " ")}`);
  if (params.evidenceSource) {
    const src =
      params.evidenceSource === "AUTOMATED_AXE"
        ? "Automated (axe)"
        : params.evidenceSource === "MANUAL_REVIEW"
          ? "Manual review"
          : params.evidenceSource === "IMPORTED"
            ? "Imported"
            : params.evidenceSource;
    parts.push(`Source: ${src}`);
  }
  if (params.siteId) parts.push("Site filter on");
  if (params.ruleId) parts.push(`Rule: ${params.ruleId}`);
  return { parts, hasFilters: parts.length > 0 };
}
