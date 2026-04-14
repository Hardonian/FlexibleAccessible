import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { Prisma } from "@aros/db";
import Link from "next/link";
import { FindingStatusForm } from "./finding-status-form";
import {
  createFindingGovernanceDecisionAction,
  revokeFindingGovernanceDecisionAction,
} from "./actions";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { resolveDashboardOrgMembership } from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { hasPermission } from "@aros/config";
import { getAutomationEvidenceFreshnessDescriptor } from "@/lib/findings/evidence-freshness";
import { buildFindingProofSummary } from "@/lib/findings/proof-summary";
import { scoreFindingPriority } from "@/lib/findings/finding-priority";
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
  searchParams: Promise<{ remediation?: string; governance?: string }>;
}) {
  const { findingId } = await params;
  const sp = await searchParams;
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  let canViewSystem = false;
  try {
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      select: { role: true },
    });
    for (const membership of memberships) {
      if (hasPermission(membership.role, "org:system:view")) {
        canViewSystem = true;
        break;
      }
    }
  } catch {
    canViewSystem = false;
  }

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

  const findingDetailArgs = Prisma.validator<Prisma.CanonicalFindingDefaultArgs>()({
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
        include: { recipe: true },
        orderBy: { confidence: "desc" },
        take: 5,
      },
      evidenceRecords: {
        orderBy: [{ capturedAt: "desc" }, { createdAt: "desc" }],
        take: 12,
      },
      verificationRuns: {
        orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
        take: 8,
      },
      governanceDecisions: {
        orderBy: [{ createdAt: "desc" }],
        take: 8,
        include: {
          createdBy: { select: { email: true, name: true } },
          revokedBy: { select: { email: true, name: true } },
        },
      },
    },
  });

  type FindingDetail = Prisma.CanonicalFindingGetPayload<typeof findingDetailArgs>;

  let finding: FindingDetail | null = null;

  try {
    finding = await prisma.canonicalFinding.findFirst({
      ...findingDetailArgs,
      where: {
        id: findingId,
        site: { workspace: { organizationId: orgRes.organizationId } },
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

  const canManageFindings = hasPermission(orgRes.role, "finding:manage");

  const latestCompleted = await prisma.scanRun.findFirst({
    where: {
      status: "COMPLETED",
      completedAt: { not: null },
      site: { workspace: { organizationId: orgRes.organizationId } },
    },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true },
  });

  const automationFreshness = getAutomationEvidenceFreshnessDescriptor({
    evidenceSource: finding.evidenceSource,
    lastVerifiedAt: finding.lastVerifiedAt,
    latestCompletedScanCompletedAt: latestCompleted?.completedAt ?? null,
    jobPipelinesHealthy: platformTruth.flags.jobPipelinesHealthy,
  });
  const proofSummary = buildFindingProofSummary({
    evidenceSummary: finding.evidenceSummary,
    provenance: finding.provenance,
    firstSeenAt: finding.firstSeenAt,
    lastSeenAt: finding.lastSeenAt,
    reopenedCount: finding.reopenedCount,
    distinctScanRunsObserved: finding.distinctScanRunsObserved,
    distinctScanRunsAbsentWhenOpen: finding.distinctScanRunsAbsentWhenOpen,
    evidenceSource: finding.evidenceSource,
    sourceType: finding.sourceType,
  });
  const triagePriority = scoreFindingPriority({
    impact: finding.impact,
    truthStatus: finding.truthStatus,
    distinctScanRunsObserved: finding.distinctScanRunsObserved,
    occurrenceCount: finding.occurrenceCount,
    reopenedCount: finding.reopenedCount,
  });
  const changeSignalLabel: Record<
    (typeof proofSummary)["changedSinceLastRun"],
    string
  > = {
    newly_detected: "New this lifecycle",
    regressed: "Regressed after closure",
    persistent: "Persistent across observations",
    improved_open_backlog: "Absent in scans while still open",
    not_comparable: "Cross-run comparison not asserted",
    unknown: "Unknown",
  };
  const latestVerificationRun = finding.verificationRuns[0] ?? null;
  const activeGovernanceDecision =
    finding.governanceDecisions.find(
      (decision) =>
        decision.status === "ACTIVE" &&
        (!decision.expiresAt || decision.expiresAt.getTime() >= Date.now()),
    ) ?? null;
  const primaryRecipe =
    finding.suggestions.find((suggestion) => suggestion.recipe)?.recipe ?? null;
  const truthStatusTone =
    finding.truthStatus === "VERIFIED_FIXED"
      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
      : finding.truthStatus === "FIXED_PENDING_VERIFICATION"
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : finding.truthStatus === "WAIVED" ||
            finding.truthStatus === "SUPPRESSED"
          ? "bg-violet-50 text-violet-700 border-violet-200"
          : finding.truthStatus === "INCONCLUSIVE" ||
              finding.truthStatus === "ERRORED"
            ? "bg-rose-50 text-rose-700 border-rose-200"
            : "bg-slate-100 text-slate-700 border-slate-200";

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
  const governanceError =
    sp.governance === "forbidden"
      ? "You do not have permission to manage waivers or suppressions."
      : sp.governance === "not_found"
        ? "The finding or governance decision could not be found in your organization."
        : sp.governance === "invalid_kind"
          ? "Unknown governance decision type."
          : sp.governance === "missing_rationale"
            ? "A rationale is required for waivers and suppressions."
            : sp.governance === "invalid_expiry"
              ? "The provided expiry date is invalid."
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
  const freshnessPanelStyles = automationFreshness
    ? automationFreshness.tone === "success"
      ? {
          container: "bg-emerald-50 border-emerald-100 text-emerald-800",
          icon: CheckCircle2,
          iconClass: "text-emerald-600",
        }
      : automationFreshness.tone === "warning"
        ? {
            container: "bg-amber-50 border-amber-200 text-amber-800",
            icon: AlertTriangle,
            iconClass: "text-amber-600",
          }
        : {
            container: "bg-slate-100 border-slate-200 text-slate-700",
            icon: Info,
            iconClass: "text-slate-500",
          }
    : null;
  const FreshnessIcon = freshnessPanelStyles?.icon;

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
      {governanceError && (
        <RouteReliabilityNotice
          variant="warning"
          title="Governance update not applied"
        >
          <p>{governanceError}</p>
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
                    <span
                      className={`badge border px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${truthStatusTone}`}
                    >
                      {finding.truthStatus.replaceAll("_", " ")}
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
              <div>
                <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 px-1 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" /> Source
                </dt>
                <dd className="font-medium text-slate-900 bg-white border border-slate-200 rounded-md px-3 py-1.5 shadow-sm">
                  {finding.sourceType.toLowerCase()}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 px-1 flex items-center gap-1.5">
                  <Bug className="h-3.5 w-3.5" /> Target
                </dt>
                <dd className="font-medium text-slate-900 bg-white border border-slate-200 rounded-md px-3 py-1.5 shadow-sm">
                  {finding.targetKind.toLowerCase()}
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
              <div className="col-span-2">
                <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 px-1 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> Canonical Rule Map
                </dt>
                <dd className="bg-white border border-slate-200 rounded-md px-3 py-2 shadow-sm text-xs text-slate-700 space-y-1">
                  <div>
                    <span className="font-medium text-slate-900">
                      Normalized key:
                    </span>{" "}
                    {finding.normalizedRuleKey ?? "unmapped"}
                  </div>
                  <div>
                    <span className="font-medium text-slate-900">
                      Rule version:
                    </span>{" "}
                    {finding.ruleVersion ?? "unknown"}{" "}
                    {finding.evaluationKind &&
                      `• ${finding.evaluationKind.toLowerCase()}`}
                  </div>
                  <div>
                    <span className="font-medium text-slate-900">
                      WCAG version:
                    </span>{" "}
                    {finding.wcagVersion ?? "unspecified"}
                    {finding.wcagCriteria.length > 0 &&
                      ` • ${finding.wcagCriteria.join(", ")}`}
                  </div>
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 px-1 flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" /> Target Locator
                </dt>
                <dd className="bg-white border border-slate-200 rounded-md px-3 py-2 shadow-sm text-xs text-slate-700 break-words">
                  {finding.targetLocator
                    ? JSON.stringify(finding.targetLocator)
                    : "Locator not captured"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-slate-500" />
              <h2 className="text-lg font-bold text-slate-900">
                Cross-run history & comparison
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              Signals below are derived from stored scan verification rows and
              timestamps. They describe recurrence of the same fingerprint within
              this site, not manual audit equivalence across pages or tools.
            </p>
            <dl className="grid gap-3 sm:grid-cols-2 text-sm">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Change signal
                </dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {changeSignalLabel[proofSummary.changedSinceLastRun]}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Comparison basis
                </dt>
                <dd className="mt-1 font-mono text-xs text-slate-800 break-all">
                  {proofSummary.comparisonBasis}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Completed scan runs observed
                </dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {proofSummary.recurrence.distinctScanRunsObserved}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Absent while open (runs)
                </dt>
                <dd className="mt-1 font-medium text-slate-900">
                  {proofSummary.recurrence.distinctScanRunsAbsentWhenOpen}
                </dd>
              </div>
            </dl>
            {proofSummary.comparisonLimitations.length > 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-950 space-y-1">
                <p className="font-semibold">Explicit limits</p>
                <ul className="list-disc pl-4 space-y-1">
                  {proofSummary.comparisonLimitations.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800 space-y-2">
              <p className="font-semibold text-slate-900">
                Deterministic triage score: {triagePriority.score.toFixed(0)}{" "}
                (lower = higher priority)
              </p>
              <ul className="list-disc pl-4 space-y-1">
                {triagePriority.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
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

          {primaryRecipe && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-brand-600" />
                <h2 className="text-lg font-bold text-slate-900">
                  Remediation Recipe
                </h2>
              </div>
              <p className="text-sm text-slate-600">
                Durable repair guidance linked to this defect class. This is
                recipe knowledge, not proof that a fix has been applied.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Strategy
                  </p>
                  <p className="mt-2 text-sm text-slate-800">
                    {primaryRecipe.strategy}
                  </p>
                  <p className="mt-3 text-xs text-slate-600">
                    {primaryRecipe.guidance}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Verification Steps
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-800 list-disc pl-4">
                      {primaryRecipe.verificationSteps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Risk Notes
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-700 list-disc pl-4">
                      {primaryRecipe.riskNotes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </div>
                  <p className="text-xs text-slate-500">
                    Review level:{" "}
                    {primaryRecipe.requiredReviewLevel.toLowerCase()} •
                    confidence {Math.round(primaryRecipe.confidence * 100)}% •
                    accepted {primaryRecipe.successCount} / rejected{" "}
                    {primaryRecipe.rejectionCount}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center gap-2">
              <Shield className="h-5 w-5 text-slate-500" />
              <h2 className="text-lg font-bold text-slate-900">
                Evidence Substrate
              </h2>
            </div>
            {finding.evidenceRecords.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                No first-class evidence records are attached yet. This finding
                may predate the evidence substrate or the artifact generation
                step may have failed.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {finding.evidenceRecords.map((evidence) => (
                  <div key={evidence.id} className="p-5 sm:p-6 space-y-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="badge bg-slate-100 text-slate-700 border border-slate-200">
                          {evidence.kind.replaceAll("_", " ")}
                        </span>
                        <span className="badge bg-white text-slate-600 border border-slate-200">
                          {evidence.lifecycleStatus.toLowerCase()}
                        </span>
                        <span className="text-xs text-slate-500">
                          {evidence.capturedAt.toLocaleString()}
                        </span>
                      </div>
                      <span className="text-xs font-medium text-slate-600">
                        {evidence.label}
                      </span>
                    </div>
                    {evidence.summary && (
                      <p className="text-sm text-slate-700">
                        {evidence.summary}
                      </p>
                    )}
                    {evidence.textValue && (
                      <pre className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap overflow-x-auto">
                        {evidence.textValue}
                      </pre>
                    )}
                    {evidence.jsonValue && (
                      <pre className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(evidence.jsonValue, null, 2)}
                      </pre>
                    )}
                    {evidence.errorMessage && (
                      <p className="text-xs text-rose-700">
                        {evidence.errorMessage}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-slate-500" />
              <h2 className="text-lg font-bold text-slate-900">
                Verification History
              </h2>
            </div>
            {finding.verificationRuns.length === 0 ? (
              <div className="p-6 text-sm text-slate-500">
                No verification attempts are recorded yet. Operator status can
                still change, but the platform should treat fixed claims as
                unverified until a verification run appears here.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {finding.verificationRuns.map((run) => (
                  <div key={run.id} className="p-5 sm:p-6 space-y-2">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="badge bg-slate-100 text-slate-700 border border-slate-200">
                          {run.kind.replaceAll("_", " ")}
                        </span>
                        <span
                          className={`badge border ${
                            run.status === "PASSED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : run.status === "FAILED"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {run.status.toLowerCase()}
                        </span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {run.completedAt?.toLocaleString() ??
                          run.createdAt.toLocaleString()}
                      </span>
                    </div>
                    {run.outcomeSummary && (
                      <p className="text-sm text-slate-700">
                        {run.outcomeSummary}
                      </p>
                    )}
                    {run.failureReason && (
                      <p className="text-xs text-rose-700">
                        {run.failureReason}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

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
                      <th
                        scope="col"
                        className="px-5 py-3.5 font-semibold text-slate-600"
                      >
                        Page Context
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-3.5 font-semibold text-slate-600"
                      >
                        DOM Target
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-3.5 font-semibold text-slate-600"
                      >
                        Failure Summary
                      </th>
                      <th
                        scope="col"
                        className="px-5 py-3.5 font-semibold text-slate-600 text-right"
                      >
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
          {/* Proof completeness scorecard */}
          <ProofScorecard
            triageScore={triagePriority.score}
            triageReasons={triagePriority.reasons}
            scanRunsObserved={proofSummary.recurrence.distinctScanRunsObserved}
            changeSignal={changeSignalLabel[proofSummary.changedSinceLastRun]}
            occurrenceCount={finding.occurrenceCount}
            evidenceSource={finding.evidenceSource}
          />

          {/* Remediation Action Panel */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand-600" />
              Remediation Strategy
            </h3>
            <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-medium text-slate-900">
                Canonical truth: {finding.truthStatus.replaceAll("_", " ")}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                Workflow status and canonical truth are separated so the
                platform can distinguish operator intent from verified evidence.
              </p>
            </div>
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

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Shield className="h-4 w-4 text-violet-600" />
              Governance
            </h3>
            {activeGovernanceDecision ? (
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900 space-y-2">
                <p className="font-semibold">
                  Active {activeGovernanceDecision.kind.toLowerCase()} decision
                </p>
                <p>{activeGovernanceDecision.rationale}</p>
                {activeGovernanceDecision.justification && (
                  <p className="text-xs">
                    {activeGovernanceDecision.justification}
                  </p>
                )}
                <p className="text-xs">
                  Created by{" "}
                  {activeGovernanceDecision.createdBy.name ??
                    activeGovernanceDecision.createdBy.email}
                  {activeGovernanceDecision.expiresAt &&
                    ` • expires ${activeGovernanceDecision.expiresAt.toLocaleString()}`}
                </p>
                {canManageFindings && (
                  <form action={revokeFindingGovernanceDecisionAction}>
                    <input type="hidden" name="findingId" value={findingId} />
                    <input
                      type="hidden"
                      name="decisionId"
                      value={activeGovernanceDecision.id}
                    />
                    <button type="submit" className="btn-secondary text-xs">
                      Revoke decision
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                No active waiver or suppression. Findings marked false positive
                or accepted risk without a governance record remain
                inconclusive, not proven.
              </div>
            )}

            {canManageFindings && (
              <form
                action={createFindingGovernanceDecisionAction}
                className="space-y-3"
              >
                <input type="hidden" name="findingId" value={findingId} />
                <div>
                  <label htmlFor="governance-kind" className="label">
                    Decision type
                  </label>
                  <select
                    id="governance-kind"
                    name="kind"
                    className="input"
                    defaultValue="WAIVER"
                  >
                    <option value="WAIVER">Waiver</option>
                    <option value="SUPPRESSION">Suppression</option>
                    <option value="OVERRIDE">Override</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="governance-rationale" className="label">
                    Rationale
                  </label>
                  <textarea
                    id="governance-rationale"
                    name="rationale"
                    className="input min-h-24"
                    required
                    placeholder="Why is this decision needed, and what risk is being accepted or suppressed?"
                  />
                </div>
                <div>
                  <label htmlFor="governance-justification" className="label">
                    Justification / evidence requirement
                  </label>
                  <textarea
                    id="governance-justification"
                    name="justification"
                    className="input min-h-20"
                    placeholder="Supporting context, ticket reference, mitigation notes, or procurement-facing explanation."
                  />
                </div>
                <div>
                  <label htmlFor="governance-expiry" className="label">
                    Expiry
                  </label>
                  <input
                    id="governance-expiry"
                    type="datetime-local"
                    name="expiresAt"
                    className="input"
                  />
                </div>
                <button type="submit" className="btn-secondary w-full">
                  Save governance decision
                </button>
              </form>
            )}

            {finding.governanceDecisions.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Governance history
                </p>
                <div className="space-y-2">
                  {finding.governanceDecisions.map((decision) => (
                    <div
                      key={decision.id}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700"
                    >
                      <p className="font-medium text-slate-900">
                        {decision.kind.toLowerCase()} •{" "}
                        {decision.status.toLowerCase()}
                      </p>
                      <p className="mt-1">{decision.rationale}</p>
                      <p className="mt-1 text-slate-500">
                        {decision.createdAt.toLocaleString()} by{" "}
                        {decision.createdBy.name ?? decision.createdBy.email}
                      </p>
                      {decision.revokedBy && (
                        <p className="text-slate-500">
                          Revoked by{" "}
                          {decision.revokedBy.name ?? decision.revokedBy.email}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
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

              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">
                  Latest Verification
                </span>
                <span className="text-slate-700">
                  {latestVerificationRun
                    ? `${latestVerificationRun.status.toLowerCase()} • ${
                        latestVerificationRun.completedAt?.toLocaleDateString() ??
                        latestVerificationRun.createdAt.toLocaleDateString()
                      }`
                    : "No verification recorded"}
                </span>
              </div>

              {finding.evidenceSource === "AUTOMATED_AXE" && (
                <div className="pt-2">
                  <span className="text-xs font-medium text-slate-500 block mb-1.5">
                    Freshness Status
                  </span>
                  {automationFreshness &&
                    freshnessPanelStyles &&
                    FreshnessIcon && (
                      <div
                        className={`flex rounded-lg border p-2.5 text-xs shadow-sm ${freshnessPanelStyles.container}`}
                      >
                        <FreshnessIcon
                          className={`mt-0.5 mr-2 h-4 w-4 shrink-0 ${freshnessPanelStyles.iconClass}`}
                        />
                        <span>
                          <strong className="uppercase tracking-wide">
                            {automationFreshness.badgeLabel}:
                          </strong>{" "}
                          {automationFreshness.detail}
                          {finding.lastVerifiedAt && (
                            <>
                              {" "}
                              Last verified:{" "}
                              {finding.lastVerifiedAt.toLocaleDateString()}.
                            </>
                          )}
                        </span>
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
                            {ev.fromStatus === ev.toStatus
                              ? `${ev.toStatus} note updated`
                              : `${ev.fromStatus ?? "—"} → ${ev.toStatus}`}
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

/** Visual proof completeness scorecard for the right sidebar */
function ProofScorecard({
  triageScore,
  triageReasons,
  scanRunsObserved,
  changeSignal,
  occurrenceCount,
  evidenceSource,
}: {
  triageScore: number;
  triageReasons: string[];
  scanRunsObserved: number;
  changeSignal: string;
  occurrenceCount: number;
  evidenceSource: string;
}) {
  // Triage score: lower = higher priority. Clamp display to 0-100.
  const priorityPct = Math.max(0, Math.min(100, 100 - triageScore));
  const priorityColor =
    priorityPct >= 70
      ? { bar: "bg-red-500", text: "text-red-700", label: "High priority" }
      : priorityPct >= 40
        ? { bar: "bg-amber-400", text: "text-amber-700", label: "Medium priority" }
        : { bar: "bg-emerald-400", text: "text-emerald-700", label: "Lower priority" };

  // Observation bar — cap at 20 for display purposes
  const obsDisplay = Math.min(scanRunsObserved, 20);
  const obsPct = obsDisplay === 0 ? 0 : (obsDisplay / 20) * 100;

  const sourceLabel =
    evidenceSource === "AUTOMATED_AXE"
      ? "axe-core automated"
      : evidenceSource === "MANUAL_REVIEW"
        ? "manual review"
        : "imported";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
        <Activity className="h-3.5 w-3.5" aria-hidden="true" />
        Proof signals
      </h3>

      {/* Triage priority bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-500">Triage priority</span>
          <span className={`text-xs font-semibold ${priorityColor.text}`}>
            {priorityColor.label}
          </span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
          role="meter"
          aria-label={`Triage priority: ${priorityColor.label}`}
          aria-valuenow={priorityPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={`h-full rounded-full transition-all ${priorityColor.bar}`}
            style={{ width: `${priorityPct}%` }}
          />
        </div>
        {triageReasons.length > 0 && (
          <ul className="mt-2 space-y-0.5">
            {triageReasons.slice(0, 3).map((r) => (
              <li key={r} className="flex items-start gap-1.5 text-[11px] text-slate-500">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" aria-hidden="true" />
                {r}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Scan observations bar */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-500">Scan runs observed</span>
          <span className="text-xs font-semibold tabular-nums text-slate-700">
            {scanRunsObserved.toLocaleString()}
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
          role="meter"
          aria-label={`Observed in ${scanRunsObserved} scan runs`}
          aria-valuenow={obsDisplay}
          aria-valuemin={0}
          aria-valuemax={20}
        >
          <div
            className="h-full rounded-full bg-brand-400 transition-all"
            style={{ width: `${obsPct}%` }}
          />
        </div>
      </div>

      {/* Key-value signal row */}
      <dl className="divide-y divide-slate-100 text-xs">
        <div className="flex items-center justify-between py-2">
          <dt className="text-slate-500">Change signal</dt>
          <dd className="font-medium text-slate-800 text-right max-w-[55%] leading-snug">
            {changeSignal}
          </dd>
        </div>
        <div className="flex items-center justify-between py-2">
          <dt className="text-slate-500">Occurrences</dt>
          <dd className="font-semibold tabular-nums text-slate-900">{occurrenceCount.toLocaleString()}</dd>
        </div>
        <div className="flex items-center justify-between py-2">
          <dt className="text-slate-500">Evidence source</dt>
          <dd className="font-medium text-slate-800">{sourceLabel}</dd>
        </div>
      </dl>
    </div>
  );
}
