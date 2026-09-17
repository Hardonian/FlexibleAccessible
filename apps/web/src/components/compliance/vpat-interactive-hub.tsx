"use client";

import { useState, useMemo } from "react";
import {
  FileCheck,
  Download,
  Filter,
  Search,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  XCircle,
  HelpCircle,
  CheckCircle2,
  FileCode,
  FileSpreadsheet,
} from "lucide-react";
import type { VpatReport, VpatRow } from "@/lib/vpat/generator";

interface VpatInteractiveHubProps {
  initialReport: VpatReport | null;
  sites: Array<{ id: string; name: string; domain: string }>;
  currentSiteId: string;
  organizationId: string;
}

export function VpatInteractiveHub({
  initialReport,
  sites,
  currentSiteId,
  organizationId,
}: VpatInteractiveHubProps) {
  const [report, setReport] = useState<VpatReport | null>(initialReport);
  const [selectedSiteId, setSelectedSiteId] = useState(currentSiteId);
  const [levelFilter, setLevelFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  async function handleSiteChange(siteId: string) {
    setSelectedSiteId(siteId);
    if (!siteId) {
      setReport(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports/vpat?organizationId=${encodeURIComponent(
          organizationId,
        )}&siteId=${encodeURIComponent(siteId)}&format=json`,
      );
      if (res.ok) {
        const json = await res.json();
        setReport(json.data ?? json);
      }
    } catch {
      // Degraded
    } finally {
      setLoading(false);
    }
  }

  const toggleRow = (criteriaId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [criteriaId]: !prev[criteriaId],
    }));
  };

  const filteredRows = useMemo(() => {
    if (!report?.rows) return [];
    return report.rows.filter((row) => {
      const matchesLevel =
        levelFilter === "ALL" || row.level.toUpperCase() === levelFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        row.conformanceStatus.toLowerCase() === statusFilter.toLowerCase();
      const matchesSearch =
        searchQuery === "" ||
        row.criteria.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.explanation.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesLevel && matchesStatus && matchesSearch;
    });
  }, [report, levelFilter, statusFilter, searchQuery]);

  function exportHtml() {
    if (!report) return;
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>VPAT / ACR - ${report.productName}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.5; color: #1e293b; max-width: 960px; margin: 40px auto; padding: 0 20px; }
    h1 { font-size: 24px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 10px 12px; text-align: left; vertical-align: top; }
    th { background: #f8fafc; font-weight: 600; }
    .status-supports { color: #15803d; font-weight: 600; }
    .status-partially-supports { color: #b45309; font-weight: 600; }
    .status-does-not-support { color: #b91c1c; font-weight: 600; }
    .status-not-applicable { color: #64748b; font-weight: 600; }
    .meta { background: #f1f5f9; padding: 16px; border-radius: 8px; margin-bottom: 24px; font-size: 13px; }
  </style>
</head>
<body>
  <h1>Accessibility Conformance Report (VPAT 2.5 / WCAG 2.2)</h1>
  <div class="meta">
    <p><strong>Product Name:</strong> ${report.productName}</p>
    <p><strong>Evaluation Date:</strong> ${report.reportDate}</p>
    <p><strong>Standards Evaluated:</strong> WCAG 2.2 Levels A &amp; AA</p>
    <p><strong>Methodology:</strong> Automated AST and browser heuristics with deterministic rule verification.</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Criteria</th>
        <th>Level</th>
        <th>Conformance Level</th>
        <th>Remarks and Explanations</th>
      </tr>
    </thead>
    <tbody>
      ${report.rows
        .map(
          (r) => `<tr>
            <td><strong>${r.criteria}</strong></td>
            <td>${r.level}</td>
            <td class="status-${r.conformanceStatus}">${r.conformanceStatus.replace(/-/g, " ").toUpperCase()}</td>
            <td>${r.explanation}</td>
          </tr>`,
        )
        .join("")}
    </tbody>
  </table>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vpat-${report.productName.toLowerCase().replace(/\s+/g, "-")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportMarkdown() {
    if (!report) return;
    let md = `# Accessibility Conformance Report (VPAT 2.5)
- **Product:** ${report.productName}
- **Date:** ${report.reportDate}
- **Standard:** WCAG 2.2 (Level A & AA)
- **Evaluation Methodology:** ${report.methodology}

## Conformance Summary
- **Supports:** ${report.summary.supports}
- **Partially Supports:** ${report.summary.partiallySupports}
- **Does Not Support:** ${report.summary.doesNotSupport}
- **Not Applicable:** ${report.summary.notApplicable}

## Table 1: Success Criteria
| Criteria | Level | Conformance Level | Remarks and Explanations |
| --- | --- | --- | --- |
`;

    for (const r of report.rows) {
      md += `| **${r.criteria}** | ${r.level} | ${r.conformanceStatus.replace(/-/g, " ").toUpperCase()} | ${r.explanation.replace(/\|/g, "\\|")} |\n`;
    }

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vpat-${report.productName.toLowerCase().replace(/\s+/g, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-white">
            <FileCheck className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Interactive WCAG 2.2 VPAT Matrix
            </h2>
            <p className="text-xs text-slate-500">
              Real-time conformance evaluation mapped directly to stored verification evidence.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="vpat-site-select" className="sr-only">
            Select Site
          </label>
          <select
            id="vpat-site-select"
            value={selectedSiteId}
            onChange={(e) => handleSiteChange(e.target.value)}
            className="input text-xs py-1.5 min-w-[200px]"
          >
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.domain})
              </option>
            ))}
          </select>

          {report && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={exportHtml}
                title="Download HTML VPAT"
                className="btn-secondary text-xs inline-flex items-center gap-1 py-1.5"
              >
                <FileCode className="h-3.5 w-3.5 text-blue-600" /> HTML
              </button>
              <button
                type="button"
                onClick={exportMarkdown}
                title="Download Markdown VPAT"
                className="btn-secondary text-xs inline-flex items-center gap-1 py-1.5"
              >
                <Download className="h-3.5 w-3.5 text-slate-600" /> MD
              </button>
              <a
                href={`/api/reports/vpat?organizationId=${encodeURIComponent(
                  organizationId,
                )}&siteId=${encodeURIComponent(selectedSiteId)}&format=csv`}
                download
                title="Download CSV"
                className="btn-secondary text-xs inline-flex items-center gap-1 py-1.5"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" /> CSV
              </a>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="card p-12 text-center text-xs text-slate-400">
          Generating WCAG 2.2 conformance evaluation...
        </div>
      ) : !report ? (
        <div className="card p-12 text-center text-xs text-slate-500">
          No VPAT data available for this site. Run an accessibility scan to populate criteria evaluation.
        </div>
      ) : (
        <>
          {/* Summary Scorecards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-800">Supports</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-emerald-900 tabular-nums">
                {report.summary.supports}
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">Criteria Fully Passing</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-800">Partially Supports</span>
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-amber-900 tabular-nums">
                {report.summary.partiallySupports}
              </p>
              <p className="text-[11px] text-amber-700 mt-0.5">Isolated Minor Defects</p>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-800">Does Not Support</span>
                <XCircle className="h-4 w-4 text-rose-600" />
              </div>
              <p className="mt-2 text-2xl font-bold text-rose-900 tabular-nums">
                {report.summary.doesNotSupport}
              </p>
              <p className="text-[11px] text-rose-700 mt-0.5">Blocking / Critical Defect</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700">Not Applicable</span>
                <HelpCircle className="h-4 w-4 text-slate-400" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
                {report.summary.notApplicable}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">Feature Not Present in Scope</p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-slate-400 font-medium flex items-center gap-1">
                <Filter className="h-3 w-3" /> Level:
              </span>
              {["ALL", "A", "AA"].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLevelFilter(lvl)}
                  className={`rounded px-2 py-1 font-medium transition-colors ${
                    levelFilter === lvl
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {lvl === "ALL" ? "All Levels" : `Level ${lvl}`}
                </button>
              ))}

              <span className="text-slate-300 mx-1">|</span>

              <span className="text-slate-400 font-medium">Status:</span>
              {[
                { label: "All", value: "ALL" },
                { label: "Supports", value: "supports" },
                { label: "Partial", value: "partially-supports" },
                { label: "Failing", value: "does-not-support" },
              ].map((st) => (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => setStatusFilter(st.value)}
                  className={`rounded px-2 py-1 font-medium transition-colors ${
                    statusFilter === st.value
                      ? "bg-brand-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search criterion or rule..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-8 py-1.5 text-xs w-full"
              />
            </div>
          </div>

          {/* Criteria Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 w-10"></th>
                  <th className="py-3 px-4">WCAG 2.2 Criterion</th>
                  <th className="py-3 px-4 w-20">Level</th>
                  <th className="py-3 px-4 w-40">Conformance Status</th>
                  <th className="py-3 px-4">Evidentiary Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row) => {
                  const isExpanded = !!expandedRows[row.criteria];
                  const statusTone =
                    row.conformanceStatus === "supports"
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : row.conformanceStatus === "partially-supports"
                      ? "bg-amber-50 text-amber-800 border-amber-200"
                      : row.conformanceStatus === "does-not-support"
                      ? "bg-rose-50 text-rose-800 border-rose-200"
                      : "bg-slate-100 text-slate-600 border-slate-200";

                  return (
                    <tr key={row.criteria} className="group hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 align-top text-slate-400">
                        {row.findings.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => toggleRow(row.criteria)}
                            className="p-1 rounded hover:bg-slate-200"
                            aria-label="Toggle findings detail"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-slate-700" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
                            )}
                          </button>
                        ) : null}
                      </td>
                      <td className="py-3 px-4 align-top font-medium text-slate-900">
                        {row.criteria}
                      </td>
                      <td className="py-3 px-4 align-top">
                        <span className="badge font-mono text-[10px] bg-slate-100 border border-slate-200">
                          {row.level}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-top">
                        <span className={`badge border text-[10px] font-semibold uppercase tracking-wider ${statusTone}`}>
                          {row.conformanceStatus.replace(/-/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 align-top text-slate-600 leading-relaxed">
                        <p>{row.explanation}</p>
                        {row.findings.length > 0 && isExpanded && (
                          <div className="mt-3 pt-2 border-t border-slate-200 space-y-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Active Associated Findings ({row.findings.length})
                            </p>
                            <div className="space-y-1.5">
                              {row.findings.map((f) => (
                                <div
                                  key={f.id}
                                  className="rounded-lg border border-slate-200 bg-white p-2 text-[11px] flex items-center justify-between"
                                >
                                  <div>
                                    <span className="font-mono font-semibold text-slate-900">
                                      {f.ruleId}
                                    </span>
                                    <span className="text-slate-500 ml-2">
                                      {f.description}
                                    </span>
                                  </div>
                                  <span className="badge text-[10px] uppercase font-mono">
                                    {f.impact}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
