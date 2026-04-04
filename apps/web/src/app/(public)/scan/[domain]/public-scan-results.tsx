"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";

type PublicEvidenceState =
  | "valid"
  | "expired"
  | "missing"
  | "incomplete"
  | "failed";

interface ScanData {
  id: string;
  domain: string;
  status: string;
  evidenceState?: PublicEvidenceState | null;
  score: number | null;
  totalViolations: number;
  criticalCount: number;
  seriousCount: number;
  moderateCount: number;
  minorCount: number;
  pagesScanned: number;
  violations: Record<string, unknown>[] | null;
  createdAt: string;
  completedAt: string | null;
  expiresAt?: string | null;
}

interface Props {
  domain: string;
  initialScan: ScanData | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-800 border-red-200",
  serious: "bg-orange-100 text-orange-800 border-orange-200",
  moderate: "bg-amber-100 text-amber-800 border-amber-200",
  minor: "bg-green-100 text-green-800 border-green-200",
};

const SCORE_COLORS: Record<string, string> = {
  good: "text-green-500",
  fair: "text-amber-500",
  poor: "text-orange-500",
  critical: "text-red-500",
};

function getScoreColor(score: number): string {
  if (score >= 90) return SCORE_COLORS.good;
  if (score >= 70) return SCORE_COLORS.fair;
  if (score >= 50) return SCORE_COLORS.poor;
  return SCORE_COLORS.critical;
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Strong sample";
  if (score >= 70) return "Mixed sample";
  if (score >= 50) return "Weak sample";
  return "High defect density";
}

function isCurrentPublicProof(scan: ScanData | null): boolean {
  return (
    scan?.status === "COMPLETED" &&
    scan.score !== null &&
    scan.evidenceState === "valid"
  );
}

export function PublicScanResults({ domain, initialScan }: Props) {
  const [scan, setScan] = useState<ScanData | null>(initialScan);
  const [polling, setPolling] = useState(() => {
    if (!initialScan?.id) return false;
    if (initialScan.status === "FAILED") return false;
    if (initialScan.evidenceState === "expired") return false;
    if (isCurrentPublicProof(initialScan)) return false;
    if (initialScan.status === "COMPLETED") return false;
    return true;
  });

  const fetchScan = useCallback(async () => {
    const pollId = scan?.id ?? initialScan?.id;
    if (!pollId) return;
    try {
      const res = await fetch(`/api/public-scan/${pollId}`);
      const json = await res.json();
      if (res.status === 410) {
        setPolling(false);
        setScan((prev) =>
          prev
            ? { ...prev, evidenceState: "expired" }
            : {
                id: pollId,
                domain,
                status: "COMPLETED",
                evidenceState: "expired",
                score: null,
                totalViolations: 0,
                criticalCount: 0,
                seriousCount: 0,
                moderateCount: 0,
                minorCount: 0,
                pagesScanned: 0,
                violations: null,
                createdAt: new Date().toISOString(),
                completedAt: null,
                expiresAt: null,
              },
        );
        return;
      }
      if (json.success) {
        setScan(json.data);
        const done =
          json.data.status === "FAILED" ||
          json.data.evidenceState === "expired" ||
          isCurrentPublicProof(json.data);
        if (done) {
          setPolling(false);
        }
      }
    } catch {
      // Silent poll failure; will retry
    }
  }, [domain, scan?.id, initialScan?.id]);

  useEffect(() => {
    if (!initialScan?.id && !scan?.id) {
      setPolling(false);
    }
  }, [initialScan?.id, scan?.id]);

  useEffect(() => {
    if (!polling) return;
    void fetchScan();
    const interval = setInterval(fetchScan, 2000);
    return () => clearInterval(interval);
  }, [polling, fetchScan]);

  const currentProof =
    scan !== null && isCurrentPublicProof(scan) ? scan : null;
  const violations: Record<string, unknown>[] =
    (currentProof?.violations as Record<string, unknown>[] | null) ?? [];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-200">
        <nav className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-brand-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 rounded"
          >
            {PRODUCT_DISPLAY_NAME}
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Sign In
            </Link>
            <Link href="/signup" className="btn-primary text-sm">
              Open workspace
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        {/* Domain Header */}
        <div className="mb-8">
          <p className="text-sm text-slate-500 mb-1">Accessibility Report</p>
          <h1 className="text-3xl font-bold text-slate-900">{domain}</h1>
          {scan?.completedAt && (
            <p className="mt-1 text-sm text-slate-400">
              Scanned {new Date(scan.completedAt).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Loading State */}
        {polling && (!scan || scan.status !== "COMPLETED") && (
          <div
            className="text-center py-20"
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <div
              className="inline-block h-12 w-12 rounded-full border-4 border-slate-200 border-t-brand-600 motion-safe:animate-spin"
              aria-hidden="true"
            />
            <p className="mt-4 text-lg text-slate-600">Scanning {domain}...</p>
            <p className="mt-2 text-sm text-slate-400">
              Running accessibility checks on up to 5 pages
            </p>
          </div>
        )}

        {/* Failed State */}
        {scan?.status === "FAILED" && (
          <div className="card border-red-200 bg-red-50 text-center py-12">
            <p className="text-lg text-red-800 font-semibold">Scan Failed</p>
            <p className="mt-2 text-sm text-red-600">
              We couldn&apos;t scan this domain. Please verify it&apos;s a
              valid, publicly accessible website.
            </p>
            <Link href="/" className="btn-primary mt-6 inline-block">
              Try Another Domain
            </Link>
          </div>
        )}

        {scan?.status === "COMPLETED" && scan.evidenceState === "expired" && (
          <div className="card border-amber-200 bg-amber-50 py-10 px-6 text-center">
            <p className="text-lg font-semibold text-amber-900">
              This public scan evidence has expired
            </p>
            <p className="mt-2 text-sm text-amber-800 max-w-lg mx-auto">
              Shared previews and badges only reflect unexpired completed scans.
              Start a new instant scan from the home page to refresh results.
            </p>
            <Link href="/" className="btn-primary mt-6 inline-block">
              Run a new scan
            </Link>
          </div>
        )}

        {/* Results — only when server classifies evidence as current */}
        {currentProof && (
          <div className="space-y-8">
            {currentProof.expiresAt && (
              <p className="text-sm text-slate-500">
                Public evidence valid until{" "}
                <time dateTime={currentProof.expiresAt}>
                  {new Date(currentProof.expiresAt).toLocaleString()}
                </time>
                . Sampled up to 5 pages; not a WCAG conformance guarantee.
              </p>
            )}
            {/* Score + Summary */}
            <div className="grid md:grid-cols-3 gap-6">
              {/* Score Card */}
              <div className="card text-center md:col-span-1">
                <div
                  className={`text-6xl font-extrabold ${getScoreColor(currentProof.score!)}`}
                >
                  {currentProof.score}
                </div>
                <p
                  className={`mt-2 font-semibold ${getScoreColor(currentProof.score!)}`}
                >
                  {getScoreLabel(currentProof.score!)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Automated sample index
                </p>
                <p className="mt-1 text-xs text-slate-400 max-w-[12rem] mx-auto">
                  Higher means fewer detected issues in this sample—not WCAG
                  conformance.
                </p>
              </div>

              {/* Severity Breakdown */}
              <div className="card md:col-span-2">
                <h2 className="text-lg font-semibold text-slate-900 mb-4">
                  Issues Found: {currentProof.totalViolations}
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    {
                      label: "Critical",
                      count: currentProof.criticalCount,
                      key: "critical",
                    },
                    {
                      label: "Serious",
                      count: currentProof.seriousCount,
                      key: "serious",
                    },
                    {
                      label: "Moderate",
                      count: currentProof.moderateCount,
                      key: "moderate",
                    },
                    { label: "Minor", count: currentProof.minorCount, key: "minor" },
                  ].map(({ label, count, key }) => (
                    <div
                      key={key}
                      className={`rounded-lg border p-4 text-center ${SEVERITY_COLORS[key]}`}
                    >
                      <div className="text-2xl font-bold">{count}</div>
                      <div className="text-sm">{label}</div>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm text-slate-400">
                  Scanned {currentProof.pagesScanned} page
                  {currentProof.pagesScanned !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Violations List (top 10) */}
            {violations.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-4">
                  Top Issues
                </h2>
                <div className="space-y-3">
                  {violations.slice(0, 10).map((v, i) => (
                    <div key={i} className="card">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span
                              className={`badge badge-${(v.impact as string)?.toLowerCase() ?? "minor"}`}
                            >
                              {v.impact as string}
                            </span>
                            <span className="text-sm font-mono text-slate-500 truncate">
                              {v.ruleId as string}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700">
                            {v.description as string}
                          </p>
                          {(v.helpUrl as string) && (
                            <a
                              href={v.helpUrl as string}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-brand-600 hover:underline mt-1 inline-block"
                            >
                              Learn more
                            </a>
                          )}
                        </div>
                        <span className="text-sm text-slate-400 whitespace-nowrap">
                          {(v.count as number) ?? 1} occurrence
                          {((v.count as number) ?? 1) !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="card bg-brand-50 border-brand-200 text-center py-12">
              <h2 className="text-2xl font-bold text-slate-900">
                Want deeper coverage and exports?
              </h2>
              <p className="mt-2 text-slate-600 max-w-xl mx-auto">
                Create a workspace for private crawls, tracked findings,
                remediation workflows, and plan-gated exports — with
                server-enforced limits.
              </p>
              <div className="mt-6 flex items-center justify-center gap-4">
                <Link href="/signup" className="btn-primary px-6 py-3">
                  Create workspace
                </Link>
                <Link href="/" className="btn-secondary px-6 py-3">
                  Scan Another Site
                </Link>
              </div>
            </div>

            {/* Share */}
            <div className="text-center text-sm text-slate-400">
              <p>
                Share this report:{" "}
                <code className="bg-slate-100 px-2 py-1 rounded">
                  {typeof window !== "undefined"
                    ? window.location.href
                    : `/scan/${encodeURIComponent(domain)}`}
                </code>
              </p>
            </div>
          </div>
        )}

        {/* No Scan Yet */}
        {!scan && !polling && (
          <div className="card text-center py-16">
            <p className="text-lg text-slate-600">
              No scan found for this domain.
            </p>
            <Link href="/" className="btn-primary mt-6 inline-block">
              Scan This Domain
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
