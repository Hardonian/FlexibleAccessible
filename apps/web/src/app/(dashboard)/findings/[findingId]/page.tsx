import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import type { Prisma } from "@aros/db";
import Link from "next/link";
import { FindingStatusForm } from "./finding-status-form";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { resolveDashboardOrgMembership } from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { hasPermission } from "@aros/config";
import { deriveAutomationEvidenceFreshness } from "@aros/shared";
import {
  ArrowLeft,
  ExternalLink,
  AlertTriangle,
  ShieldAlert,
  AlertCircle,
  CheckCircle2,
  Layers,
  Clock,
  ShieldCheck,
  Zap,
  Activity,
  BookOpen,
  Bug,
  Network,
  Shield,
  Info,
  ArrowRight,
  History,
} from "lucide-react";

export default async function FindingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ findingId: string }>;
  searchParams: Promise<{ remediation?: string }>;
}) {
  const { findingId } = await params;
  const sp = await searchParams;
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const canViewSystem = await prisma.membership
    .findMany({ where: { userId: user.id }, select: { role: true } })
    .then((rows) => rows.some((m) => hasPermission(m.role, "org:system:view")))
    .catch(() => false);

  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind === "platform_blocked") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Finding</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Finding unavailable"
          showSystemLink={canViewSystem}
        >
          <p>
            This finding cannot be loaded while core data services are down.
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error" || orgRes.kind === "none") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Finding</h1>
        <RouteReliabilityNotice
          variant="info"
          title="Access not available"
          showSystemLink={canViewSystem}
        >
          <p>
            {orgRes.kind === "none"
              ? "You need an organization membership to view findings."
              : `Could not verify organization (${orgRes.message}).`}
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  type FindingDetail = Prisma.CanonicalFindingGetPayload<{
    include: {
      site: { select: { id: true; name: true; domain: true } };
      lastScanRun: {
        select: {
          id: true;
          status: true;
          completedAt: true;
          createdAt: true;
          errorMessage: true;
        };
      };
      statusEvents: {
        orderBy: { createdAt: "desc" };
        take: 25;
        include: { user: { select: { email: true; name: true } } };
      };
      occurrences: {
        include: {
          page: { select: { id: true; url: true; title: true } };
          lastRawViolation: {
            select: {
              id: true;
              createdAt: true;
              elementContext: true;
              scanRun: {
                select: { id: true; status: true; completedAt: true };
              };
            };
          };
        };
      };
      cluster: true;
      suggestions: true;
    };
  }>;

  let finding: FindingDetail | null = null;

  try {
    finding = await prisma.canonicalFinding.findFirst({
      where: {
        id: findingId,
        occurrences: {
          some: {
            page: {
              site: { workspace: { organizationId: orgRes.organizationId } },
            },
          },
        },
      },
      include: {
        site: { select: { id: true, name: true, domain: true } },
        lastScanRun: {
          select: {
            id: true,
            status: true,
            completedAt: true,
            createdAt: true,
            errorMessage: true,
          },
        },
        statusEvents: {
          orderBy: { createdAt: "desc" },
          take: 25,
          include: { user: { select: { email: true, name: true } } },
        },
        occurrences: {
          include: {
            page: { select: { id: true, url: true, title: true } },
            lastRawViolation: {
              select: {
                id: true,
                createdAt: true,
                elementContext: true,
                scanRun: {
                  select: { id: true, status: true, completedAt: true },
                },
              },
            },
          },
          take: 50,
          orderBy: { lastSeenAt: "desc" },
        },
        cluster: true,
        suggestions: {
          orderBy: { confidence: "desc" },
          take: 5,
        },
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Database error";
    console.error("[finding detail] query failed", e);
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Finding</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Could not load finding"
          showSystemLink={canViewSystem}
        >
          <p>{message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (!finding) notFound();

  const canManageFindings = hasPermission(orgRes.role, "findings:manage");

  const latestCompleted = await prisma.scanRun.findFirst({
    where: {
      status: "COMPLETED",
      completedAt: { not: null },
      site: { workspace: { organizationId: orgRes.organizationId } },
    },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true },
  });

  const automationFreshness =
    finding.evidenceSource === "AUTOMATED_AXE"
      ? deriveAutomationEvidenceFreshness({
          lastVerifiedAt: finding.lastVerifiedAt,
          latestCompletedScanCompletedAt: latestCompleted?.completedAt ?? null,
          jobPipelinesHealthy: platformTruth.flags.jobPipelinesHealthy,
        })
      : null;

  const remediationError =
    sp.remediation === "forbidden"
      ? "You do not have permission to change remediation status."
      : sp.remediation === "invalid_transition"
        ? "That status change is not allowed from the current state."
        : sp.remediation === "invalid_status"
          ? "Unknown remediation status."
          : sp.remediation === "not_found"
            ? "Finding not found in your organization."
            : null;

  // Impact Visuals
  const impactConfig = {
    CRITICAL: {
      icon: ShieldAlert,
      color: "text-red-700",
      bg: "bg-red-50",
      border: "border-red-200",
    },
    SERIOUS: {
      icon: AlertTriangle,
      color: "text-orange-700",
      bg: "bg-orange-50",
      border: "border-orange-200",
    },
    MODERATE: {
      icon: AlertCircle,
      color: "text-amber-700",
      bg: "bg-amber-50",
      border: "border-amber-200",
    },
    MINOR: {
      icon: Info,
      color: "text-sky-700",
      bg: "bg-sky-50",
      border: "border-sky-200",
    },
  }[finding.impact] || {
    icon: Bug,
    color: "text-slate-700",
    bg: "bg-slate-50",
    border: "border-slate-200",
  };

  const ImpactIcon = impactConfig.icon;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-2 text-sm text-slate-500 font-medium tracking-wide mb-2 transition-colors">
        <Link
          href="/findings"
          className="flex items-center gap-1 hover:text-brand-600 focus-visible:outline-brand-600 rounded px-1 -mx-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Findings
        </Link>
        <span className="text-slate-300">/</span>
        <span className="text-slate-900 truncate max-w-[200px] sm:max-w-xs">
          {finding.fingerprint.slice(0, 8)}...
        </span>
      </div>

      {remediationError && (
        <RouteReliabilityNotice
          variant="warning"
          title="Remediation update not applied"
        >
          <p>{remediationError}</p>
        </RouteReliabilityNotice>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Left Column: Core Identity, Occurrences, Context */}
        <div className="flex-1 w-full space-y-6 min-w-0">
          {/* Main Context Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
            {/* Ambient impact accent */}
            <div
              className={`absolute top-0 left-0 w-1.5 h-full ${impactConfig.bg} group-hover:bg-opacity-80 transition-colors`}
            />

            <div className="p-6 sm:p-8 pl-8 sm:pl-10">
              <div className="flex items-start gap-4">
                <div
                  className={`shrink-0 p-3 rounded-xl ${impactConfig.bg} ${impactConfig.border} border`}
                >
                  <ImpactIcon className={`h-6 w-6 ${impactConfig.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center flex-wrap gap-2 mb-2">
                    <span
                      className={`badge border ${impactConfig.bg} ${impactConfig.color} ${impactConfig.border} px-2.5 py-1 text-xs font-semibold uppercase tracking-wider`}
                    >
                      {finding.impact}
                    </span>
                    <span className="badge bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1 text-xs font-mono">
                      {finding.ruleId}
                    </span>
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight mb-4">
                    {finding.description}
                  </h1>

                  {finding.helpUrl && (
                    <a
                      href={finding.helpUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-brand-600"
                    >
                      <BookOpen className="h-4 w-4" />
                      Read Accessibility Guideline
                      <ExternalLink className="h-3 w-3 opacity-50" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Metadata Grid inside card */}
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 px-6 sm:px-8 py-5 bg-slate-50 border-t border-slate-100/60">
              <div>
                <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 px-1 flex items-center gap-1.5">
                  <Network className="h-3.5 w-3.5" /> Site
                </dt>
                <dd
                  className="font-medium text-slate-900 bg-white border border-slate-200 rounded-md px-3 py-1.5 shadow-sm truncate"
                  title={finding.site.domain}
                >
                  {finding.site.name}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 px-1 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> Occurrences
                </dt>
                <dd className="font-medium text-slate-900 bg-white border border-slate-200 rounded-md px-3 py-1.5 shadow-sm">
                  {finding.occurrenceCount.toLocaleString()} items
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 px-1 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" /> WCAG Scope
                </dt>
                <dd className="text-sm font-medium text-slate-700 flex flex-wrap gap-1.5">
                  {finding.wcagTags.length > 0 ? (
                    finding.wcagTags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-white border border-slate-200 rounded text-xs px-2 py-1 shadow-sm"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-slate-500 italic px-2 py-1">
                      Unspecified tagging
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {finding.cluster && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 opacity-5 pointer-events-none transform translate-x-8 -translate-y-8">
                <Layers className="w-full h-full text-brand-900" />
              </div>
              <div className="flex items-center gap-3 mb-2">
                <Layers className="h-5 w-5 text-brand-600" />
                <h2 className="text-lg font-bold text-slate-900">
                  Component Topology
                </h2>
              </div>
              <p className="text-sm text-slate-600 mb-4 max-w-2xl">
                This finding maps to a recognized UI component cluster. Fixing
                it here will likely resolve it across multiple pages.
              </p>

              <Link
                href={`/clusters/${finding.cluster.id}`}
                className="group inline-flex items-center gap-4 p-4 rounded-lg bg-slate-50 border border-slate-200 hover:border-brand-300 hover:shadow-sm transition-all w-full"
              >
                <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 group-hover:border-brand-300 group-hover:text-brand-600 text-slate-500 transition-colors">
                  <Network className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-slate-900 group-hover:text-brand-600 truncate">
                    {finding.cluster.name}
                  </h3>
                  <p className="text-sm text-slate-500 truncate">
                    {finding.cluster.description}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-brand-500 transform group-hover:translate-x-1 transition-all" />
              </Link>
            </div>
          )}

          {finding.suggestions.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500 flex-shrink-0" />
                  <h2 className="text-lg font-bold text-slate-900">
                    Intelligence & Synthesis
                  </h2>
                </div>
                <span className="badge bg-amber-50 text-amber-700 border border-amber-200">
                  AI Assisted
                </span>
              </div>
              <div className="divide-y divide-slate-100">
                {finding.suggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="p-5 sm:p-6 hover:bg-slate-50/50 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <span className="badge bg-slate-100 text-slate-800 font-medium px-2.5 py-1">
                          {suggestion.type.toLowerCase().replace("_", " ")}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                          <Activity className="h-3.5 w-3.5 text-emerald-500" />
                          {Math.round(suggestion.confidence * 100)}% Confidence
                        </div>
                      </div>
                      <Link
                        href={`/remediation/${suggestion.id}`}
                        className="btn-secondary text-xs sm:opacity-0 sm:group-hover:opacity-100 transition-opacity whitespace-nowrap"
                      >
                        Review Fix →
                      </Link>
                    </div>
                    <p className="text-sm text-slate-700 font-medium mb-4 leading-relaxed max-w-3xl">
                      {suggestion.rationale}
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="flex flex-col rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                        <div className="px-3 py-2 border-b border-slate-200 bg-white text-xs font-semibold tracking-wide text-slate-500 uppercase">
                          Original Source
                        </div>
                        <div className="p-3 overflow-x-auto text-xs font-mono text-slate-700 selection:bg-red-200 leading-relaxed whitespace-pre">
                          {suggestion.originalCode}
                        </div>
                      </div>
                      <div className="flex flex-col rounded-lg border border-brand-200 bg-brand-50/30 overflow-hidden ring-1 ring-brand-500/10">
                        <div className="px-3 py-2 border-b border-brand-200 bg-brand-50 text-xs font-semibold tracking-wide text-brand-700 uppercase flex justify-between items-center">
                          Proposed Fix
                        </div>
                        <div className="p-3 overflow-x-auto text-xs font-mono text-slate-800 selection:bg-green-200 leading-relaxed whitespace-pre">
                          {suggestion.suggestedCode}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Observed Occurrences
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Showing {finding.occurrences.length} instances across{" "}
                  {finding.site.name}. Limited to 50 for display.
                </p>
              </div>
            </div>
            {finding.occurrences.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <CheckCircle2 className="h-8 w-8 mx-auto text-slate-300 mb-3" />
                <p>No active occurrences found in the database.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <caption className="sr-only">
                    Finding occurrences across pages
                  </caption>
                  <thead className="bg-slate-50/80 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3.5 font-semibold text-slate-600">
                        Page Context
                      </th>
                      <th className="px-5 py-3.5 font-semibold text-slate-600">
                        DOM Target
                      </th>
                      <th className="px-5 py-3.5 font-semibold text-slate-600">
                        Failure Summary
                      </th>
                      <th className="px-5 py-3.5 font-semibold text-slate-600 text-right">
                        Age
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {finding.occurrences.map((occ) => (
                      <tr
                        key={occ.id}
                        className="hover:bg-slate-50/50 transition-colors group"
                      >
                        <td className="px-5 py-4 w-1/4 max-w-[200px]">
                          <p
                            className="font-medium text-slate-900 truncate"
                            title={occ.page.title ?? occ.page.url}
                          >
                            {occ.page.title ??
                              (occ.page.url.length > 30
                                ? occ.page.url.slice(0, 30) + "..."
                                : occ.page.url)}
                          </p>
                          <a
                            href={occ.page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-brand-600 hover:text-brand-700 truncate block mt-0.5 hover:underline focus-visible:outline-brand-600 rounded"
                          >
                            {new URL(occ.page.url).pathname}
                          </a>
                        </td>
                        <td className="px-5 py-4 w-1/4 max-w-[200px]">
                          <code
                            className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2 py-1 rounded truncate block border border-slate-200"
                            title={occ.selector}
                          >
                            {occ.selector}
                          </code>
                        </td>
                        <td className="px-5 py-4 w-2/4">
                          {occ.lastRawViolation?.elementContext ? (
                            <div className="text-xs text-slate-600 whitespace-normal line-clamp-2 max-w-sm pl-2 border-l-2 border-slate-200 group-hover:border-brand-300 transition-colors">
                              {occ.lastRawViolation.elementContext}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">
                              No context recorded
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right text-xs text-slate-500 tabular-nums">
                          {occ.lastSeenAt.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Operator Action & Audit Ledger */}
        <div className="w-full lg:w-96 shrink-0 space-y-6 lg:sticky lg:top-6">
          {/* Remediation Action Panel */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand-600" />
              Remediation Strategy
            </h3>
            <FindingStatusForm
              findingId={findingId}
              defaultValue={finding.status}
              canManage={canManageFindings}
              defaultNote={finding.statusNote}
            />

            {/* Contextual help for operator */}
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-xs font-medium text-slate-500 mb-2 uppercase tracking-widest">
                Platform Note
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                Modifying the status locks it from auto-reopening unless a new
                verification scan overrides it. Closing an issue without a code
                fix will likely result in reopening upon the next structural
                crawl.
              </p>
            </div>
          </div>

          {/* Evidence Freshness Panel */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden text-sm">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 font-semibold text-slate-700 flex items-center gap-2 text-xs uppercase tracking-wider">
              <Clock className="h-4 w-4 text-slate-400" />
              Evidence Integrity
            </div>
            <div className="p-4 space-y-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">
                  Source Truth
                </span>
                <span className="font-medium text-slate-900">
                  {finding.evidenceSource === "AUTOMATED_AXE"
                    ? "axe-core Automated Engine"
                    : finding.evidenceSource === "MANUAL_REVIEW"
                      ? "Operator Verified"
                      : "External Import"}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">
                  Last Telemetry Run
                </span>
                <span className="text-slate-700 truncate">
                  {finding.lastScanRun ? (
                    <span
                      className="flex items-center gap-1.5"
                      title={finding.lastScanRun.id}
                    >
                      <Activity className="h-3 w-3 text-slate-400" />
                      {finding.lastScanRun.status.charAt(0) +
                        finding.lastScanRun.status.slice(1).toLowerCase()}
                      {finding.lastScanRun.completedAt &&
                        ` • ${finding.lastScanRun.completedAt.toLocaleDateString()}`}
                    </span>
                  ) : (
                    <span className="italic text-slate-400">Untracked run</span>
                  )}
                </span>
              </div>

              {finding.evidenceSource === "AUTOMATED_AXE" && (
                <div className="pt-2">
                  <span className="text-xs font-medium text-slate-500 block mb-1.5">
                    Freshness Status
                  </span>
                  {automationFreshness === "current" ? (
                    <div className="flex p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg text-emerald-800 text-xs">
                      <CheckCircle2 className="h-4 w-4 mr-2 shrink-0 mt-0.5" />
                      <span>
                        Data is highly synced. Last verified:{" "}
                        {finding.lastVerifiedAt?.toLocaleDateString()}.
                      </span>
                    </div>
                  ) : automationFreshness === "stale_newer_scan_exists" ? (
                    <div className="flex p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs shadow-sm">
                      <AlertTriangle className="h-4 w-4 mr-2 shrink-0 text-amber-600 mt-0.5" />
                      <span>
                        <strong>Stale Ledger:</strong> A newer scan has
                        completed since this was last verified (
                        {finding.lastVerifiedAt?.toLocaleDateString()}).
                      </span>
                    </div>
                  ) : (
                    <div className="flex p-2.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700 text-xs">
                      <Info className="h-4 w-4 mr-2 shrink-0 mt-0.5 text-slate-500" />
                      <span>Status unverified by recent pipeline hooks.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Ledger / Workflow Timeline */}
          {finding.statusEvents.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 overflow-hidden">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-5 flex items-center gap-2">
                <History className="h-4 w-4 text-slate-400" />
                Ledger History
              </h3>
              <div className="relative pl-3">
                <div className="absolute top-2 bottom-2 left-[15px] w-[2px] bg-slate-100"></div>
                <div className="space-y-6">
                  {finding.statusEvents.map((ev, i) => (
                    <div key={ev.id} className="relative pl-6">
                      {/* Node Marker */}
                      <div
                        className={`absolute top-1 left-[-5px] w-[9px] h-[9px] rounded-full border-2 border-white ring-2 ring-transparent bg-slate-300
                          ${i === 0 ? "bg-brand-500 ring-brand-100 z-10" : ""}
                       `}
                      ></div>

                      <div className="flex flex-col gap-1 text-sm">
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                          <span className="font-semibold text-slate-900">
                            {ev.fromStatus ?? "—"}{" "}
                            <span className="text-slate-400 font-normal mx-0.5">
                              →
                            </span>{" "}
                            {ev.toStatus}
                          </span>
                          <span className="text-slate-400">•</span>
                          <span className="text-slate-500 tabular-nums font-mono text-[10px]">
                            {ev.createdAt.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        {ev.user ? (
                          <div className="text-xs text-slate-500">
                            via{" "}
                            <span className="font-medium">
                              {ev.user.name ?? ev.user.email}
                            </span>
                          </div>
                        ) : (
                          <div className="text-xs text-slate-500 italic">
                            System Action
                          </div>
                        )}
                        {ev.note && (
                          <div className="mt-1.5 p-2.5 bg-slate-50 border border-slate-100 rounded-md text-xs text-slate-700 italic relative break-words">
                            {/* Small speech bubble tick */}
                            <div className="absolute -top-1.5 left-3 w-3 h-3 bg-slate-50 border-t border-l border-slate-100 transform rotate-45"></div>
                            <span className="relative z-10 whitespace-pre-wrap">
                              {ev.note}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
