"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { BarChart3, Gauge } from "lucide-react";
import { SeverityChip, type SeverityLevel } from "@aros/ui";
import { EmbedBadgeDialog } from "@/components/sites/embed-badge-dialog";

type PublicEvidenceState =
  | "valid"
  | "expired"
  | "missing"
  | "incomplete"
  | "failed";

export interface PublicScanBodyScan {
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
  initialScan: PublicScanBodyScan | null;
}

function getSampleTier(score: number): {
  label: string;
  detail: string;
} {
  if (score >= 90)
    return {
      label: "Strong sample",
      detail: "Fewer automated issues detected in this small page sample.",
    };
  if (score >= 70)
    return {
      label: "Mixed sample",
      detail: "Meaningful automated signal; prioritize by severity and retest.",
    };
  if (score >= 50)
    return {
      label: "Weak sample",
      detail: "Elevated automated findings in this sample—triage critical and serious first.",
    };
  return {
    label: "High defect density",
    detail: "Dense automated findings in this sample—not a statement of full-site WCAG status.",
  };
}

function toSeverityLevel(impact: unknown): SeverityLevel {
  const u = String(impact ?? "")
    .toUpperCase()
    .trim();
  if (u === "CRITICAL") return "CRITICAL";
  if (u === "SERIOUS") return "SERIOUS";
  if (u === "MODERATE") return "MODERATE";
  return "MINOR";
}

function isCurrentPublicProof(scan: PublicScanBodyScan | null): boolean {
  return (
    scan?.status === "COMPLETED" &&
    scan.score !== null &&
    scan.evidenceState === "valid"
  );
}

export function PublicScanBody({ domain, initialScan }: Props) {
  const [scan, setScan] = useState<PublicScanBodyScan | null>(initialScan);
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
    if (!polling) return;
    const kickoff = setTimeout(() => {
      void fetchScan();
    }, 0);
    const interval = setInterval(fetchScan, 2000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(interval);
    };
  }, [polling, fetchScan]);

  const currentProof =
    scan !== null && isCurrentPublicProof(scan) ? scan : null;
  const violations: Record<string, unknown>[] =
    (currentProof?.violations as Record<string, unknown>[] | null) ?? [];

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500 mb-1">Public sample report</p>
          <h1 className="text-3xl font-bold text-slate-900">{domain}</h1>
          {scan?.completedAt && (
            <p className="mt-1 text-sm text-slate-500">
              Scanned {new Date(scan.completedAt).toLocaleDateString()}
            </p>
          )}
        </div>
        {currentProof && (
          <EmbedBadgeDialog domain={domain} siteName={domain} />
        )}
      </div>

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
          <p className="mt-4 text-lg text-slate-600">Scanning {domain}…</p>
          <p className="mt-2 text-sm text-slate-500">
            Running accessibility checks on up to 5 pages
          </p>
        </div>
      )}

      {scan?.status === "FAILED" && (
        <div className="card border-red-200 bg-red-50 text-center py-12">
          <p className="text-lg text-red-800 font-semibold">Scan failed</p>
          <p className="mt-2 text-sm text-red-700">
            We couldn&apos;t scan this domain. Please verify it&apos;s a valid,
            publicly accessible website.
          </p>
          <Link href="/" className="btn-primary mt-6 inline-block">
            Try another domain
          </Link>
        </div>
      )}

      {scan?.status === "COMPLETED" && scan.evidenceState === "expired" && (
        <div className="card border-amber-200 bg-amber-50 py-10 px-6 text-center">
          <p className="text-lg font-semibold text-amber-950">
            This public scan evidence has expired
          </p>
          <p className="mt-2 text-sm text-amber-900 max-w-lg mx-auto">
            Shared previews only reflect unexpired completed scans. Start a new
            instant scan from the home page to refresh results.
          </p>
          <Link href="/" className="btn-primary mt-6 inline-block">
            Run a new scan
          </Link>
        </div>
      )}

      {currentProof && (
        <div className="space-y-8">
          {currentProof.expiresAt && (
            <p className="text-sm text-slate-600">
              Public evidence valid until{" "}
              <time dateTime={currentProof.expiresAt}>
                {new Date(currentProof.expiresAt).toLocaleString()}
              </time>
              . Sampled up to 5 pages; not a WCAG conformance guarantee.
            </p>
          )}

          <div className="grid md:grid-cols-3 gap-6">
            <div className="card text-center md:col-span-1">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-canvas))] text-slate-700">
                <Gauge className="h-5 w-5" aria-hidden />
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sample index
              </p>
              <p
                className="mt-1 text-5xl font-bold tabular-nums text-slate-900"
                aria-label={`Sample index ${currentProof.score}`}
              >
                {currentProof.score}
              </p>
              {(() => {
                const tier = getSampleTier(currentProof.score!);
                return (
                  <>
                    <p className="mt-3 text-sm font-semibold text-slate-800">
                      {tier.label}
                    </p>
                    <p className="mt-2 text-xs text-slate-600 leading-relaxed max-w-[14rem] mx-auto">
                      {tier.detail} This number is not legal proof of
                      conformance.
                    </p>
                  </>
                );
              })()}
            </div>

            <div className="card md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-5 w-5 text-slate-600" aria-hidden />
                <h2 className="text-lg font-semibold text-slate-900">
                  Issues in sample: {currentProof.totalViolations}
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(
                  [
                    ["CRITICAL", currentProof.criticalCount] as const,
                    ["SERIOUS", currentProof.seriousCount] as const,
                    ["MODERATE", currentProof.moderateCount] as const,
                    ["MINOR", currentProof.minorCount] as const,
                  ] as const
                ).map(([severity, count]) => (
                  <div
                    key={severity}
                    className="flex flex-col items-center gap-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-canvas))] p-3"
                  >
                    <SeverityChip severity={severity} size="sm" />
                    <span
                      className="text-2xl font-bold tabular-nums text-slate-900"
                      aria-label={`${severity} count ${count}`}
                    >
                      {count}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-500">
                Scanned {currentProof.pagesScanned} page
                {currentProof.pagesScanned !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {violations.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-slate-900 mb-4">
                Top issues in sample
              </h2>
              <div className="space-y-3">
                {violations.slice(0, 10).map((v, i) => (
                  <div key={i} className="card">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <SeverityChip
                            severity={toSeverityLevel(v.impact)}
                            size="sm"
                          />
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
                            className="text-xs text-brand-700 hover:underline mt-2 inline-block font-medium"
                          >
                            Learn more (opens in new tab)
                          </a>
                        )}
                      </div>
                      <span className="text-sm text-slate-500 whitespace-nowrap">
                        {(v.count as number) ?? 1} occurrence
                        {((v.count as number) ?? 1) !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-canvas))] px-6 py-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
              Private workspace
            </p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">
              {currentProof.totalViolations > 0
                ? `Track and address these ${currentProof.totalViolations} issue${currentProof.totalViolations !== 1 ? "s" : ""} over time`
                : "Monitor this site continuously with a private workspace"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              {currentProof.totalViolations > 0
                ? `This public sample covered ${currentProof.pagesScanned} page${currentProof.pagesScanned !== 1 ? "s" : ""} and expires shortly. A private workspace stores your full scan history, lets you track regressions, and produces evidence reports for auditors and stakeholders.`
                : `Your site returned a clean public sample. A private workspace runs recurring scans across your full domain, so regressions surface before they reach production.`}
            </p>
            <ul className="mt-4 space-y-1.5 text-sm text-slate-700" role="list">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-brand-600" aria-hidden="true">›</span>
                <span><span className="font-medium">Persistent history:</span> compare each scan run — detect regressions before stakeholders do</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-brand-600" aria-hidden="true">›</span>
                <span><span className="font-medium">Full-domain coverage:</span> scan beyond the 5-page public sample limit</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-brand-600" aria-hidden="true">›</span>
                <span><span className="font-medium">Evidence exports:</span> structured JSON/CSV reports for audits, tickets, and legal review</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 text-brand-600" aria-hidden="true">›</span>
                <span><span className="font-medium">Source-first remediation:</span> AI-drafted fix suggestions with human-review workflows — no overlay substitutes</span>
              </li>
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link href="/signup" className="btn-primary px-6 py-3">
                Create free workspace
              </Link>
              <Link href="/" className="btn-secondary px-6 py-3">
                Scan another site
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-500">
              Free to start. Paid plans unlock full-domain scans, team seats, saved org history, and API access — enforced server-side.
            </p>
          </div>

          <div className="rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-elevated))] px-4 py-3 text-center text-sm text-slate-600">
            <span className="font-medium text-slate-800">Share this page:</span>{" "}
            <code className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-800">
              {typeof window !== "undefined"
                ? window.location.href
                : `/scan/${encodeURIComponent(domain)}`}
            </code>
          </div>
        </div>
      )}

      {!scan && !polling && (
        <div className="card text-center py-16">
          <p className="text-lg text-slate-600">No scan found for this domain.</p>
          <Link href="/" className="btn-primary mt-6 inline-block">
            Scan this domain
          </Link>
        </div>
      )}
    </div>
  );
}
