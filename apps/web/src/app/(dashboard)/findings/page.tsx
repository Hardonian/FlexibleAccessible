import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { AlertTriangle, ChevronRight, Inbox } from "lucide-react";
import type { Severity, FindingStatus, EvidenceSource } from "@aros/db";
import { Prisma } from "@aros/db";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { hasPermission } from "@aros/config";
import { StatusBadge, EmptyState, SeverityChip } from "@aros/ui";
import {
  findingsActiveFilterSummary,
  findingsListQueryString,
} from "@/lib/findings-list-query";
import { getAutomationEvidenceFreshnessDescriptor } from "@/lib/findings/evidence-freshness";
import { buildFindingProofSummary } from "@/lib/findings/proof-summary";
import { summarizeFindingFamilies } from "@/lib/findings/family-summary";
import { scoreFindingPriority } from "@/lib/findings/finding-priority";
import { PageHeader } from "@/components/layout/page-header";
import { FindingMetaDisclosure } from "./finding-meta-disclosure";
import { pageTitle } from "@/lib/product-brand";

const findingListArgs = Prisma.validator<Prisma.CanonicalFindingDefaultArgs>()({
  include: {
    _count: { select: { occurrences: true } },
    cluster: { select: { id: true, name: true } },
    site: { select: { id: true, name: true, domain: true } },
  },
});

type FindingListRow = Prisma.CanonicalFindingGetPayload<typeof findingListArgs>;

export const metadata = { title: pageTitle("Findings") };

interface SearchParams {
  page?: string;
  severity?: string;
  status?: string;
  siteId?: string;
  ruleId?: string;
  evidenceSource?: string;
}

function buildFindingsQueryString(p: {
  page?: number;
  severity?: string;
  status?: string;
  siteId?: string;
  ruleId?: string;
  evidenceSource?: string;
}) {
  const sp = new URLSearchParams();
  if (p.page != null && p.page > 1) sp.set("page", String(p.page));
  if (p.severity) sp.set("severity", p.severity);
  if (p.status) sp.set("status", p.status);
  if (p.siteId) sp.set("siteId", p.siteId);
  if (p.ruleId) sp.set("ruleId", p.ruleId);
  if (p.evidenceSource) sp.set("evidenceSource", p.evidenceSource);
  const q = sp.toString();
  return q ? `?${q}` : "";
}

export default async function FindingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireSession();
  const params = await searchParams;
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
        <PageHeader title="Findings" />
        <RouteReliabilityNotice
          variant="error"
          title="Findings require a working database"
          showSystemLink={canViewSystem}
        >
          <p>Findings cannot be loaded until core data services are healthy.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Findings" />
        <RouteReliabilityNotice
          variant="error"
          title="Could not verify organization"
          showSystemLink={canViewSystem}
        >
          <p>{orgRes.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "none") {
    return (
      <div className="space-y-6">
        <PageHeader title="Findings" />
        <RouteReliabilityNotice
          variant="info"
          title="No organization membership"
        >
          <p>You need to belong to an organization to view findings.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const page = parseInt(params.page ?? "1", 10);
  const limit = 20;
  const skip = (page - 1) * limit;

  const buildFindingsWhere = (organizationId: string): any => {
    const where: any = {
      site: {
        workspace: { organizationId },
        ...(params.siteId ? { id: params.siteId } : {}),
      },
    };
    if (params.severity) where.impact = params.severity as Severity;
    if (params.status) where.status = params.status as FindingStatus;
    if (params.ruleId) where.ruleId = params.ruleId;
    if (
      params.evidenceSource &&
      ["AUTOMATED_AXE", "MANUAL_REVIEW", "IMPORTED"].includes(params.evidenceSource)
    ) {
      where.evidenceSource = params.evidenceSource as EvidenceSource;
    }
    return where;
  };

  const listResult = await runOrgScopedQuery(orgRes, async (organizationId) => {
    const where = buildFindingsWhere(organizationId);
    const [findings, total, latestCompletedScan] = await Promise.all([
      prisma.canonicalFinding.findMany({
        ...findingListArgs,
        where,
        orderBy: [
          { impact: "asc" },
          { reopenedCount: "desc" },
          { distinctScanRunsObserved: "desc" },
          { occurrenceCount: "desc" },
        ],
        skip,
        take: limit,
      }),
      prisma.canonicalFinding.count({ where }),
      prisma.scanRun.findFirst({
        where: {
          status: "COMPLETED",
          completedAt: { not: null },
          site: { workspace: { organizationId } },
        },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true },
      }),
    ]);
    const familyInputs = findings.map((finding) => ({
      ruleId: finding.ruleId,
      firstSeenAt: finding.firstSeenAt,
      lastSeenAt: finding.lastSeenAt,
      reopenedCount: finding.reopenedCount,
      status: finding.status,
      distinctScanRunsObserved: finding.distinctScanRunsObserved,
    }));
    const familySummaryByRuleId = summarizeFindingFamilies(familyInputs);
    return {
      findings,
      total,
      latestCompletedScanCompletedAt: latestCompletedScan?.completedAt ?? null,
      familySummaryByRuleId,
    };
  });

  if (!listResult.ok) {
    return (
      <div className="space-y-6">
        <PageHeader title="Findings" />
        <RouteReliabilityNotice
          variant="error"
          title="Findings list unavailable"
          showSystemLink={canViewSystem}
        >
          <p>Could not load findings from the database ({listResult.message}).</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const { findings, total, latestCompletedScanCompletedAt, familySummaryByRuleId } =
    listResult.data;
  const totalPages = Math.ceil(total / limit);
  const filterSummary = findingsActiveFilterSummary(params);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Findings"
        description={`${total.toLocaleString()} deduplicated finding${total === 1 ? "" : "s"} — not a legal conformance score.`}
      />

      {!platformTruth.flags.jobPipelinesHealthy && (
        <RouteReliabilityNotice
          variant="warning"
          title="Automation freshness is degraded"
          showSystemLink={canViewSystem}
        >
          <p>
            Findings still reflect stored data, but workers or queues are degraded.
            Automated evidence freshness is shown as degraded until pipelines recover.
          </p>
        </RouteReliabilityNotice>
      )}

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="card">
        <form className="flex flex-wrap items-end gap-4" method="GET">
          {params.siteId ? <input type="hidden" name="siteId" value={params.siteId} /> : null}
          {params.ruleId ? <input type="hidden" name="ruleId" value={params.ruleId} /> : null}
          <div className="min-w-[8rem]">
            <label htmlFor="severity-filter" className="label">Severity</label>
            <select id="severity-filter" name="severity" className="input" defaultValue={params.severity ?? ""}>
              <option value="">All severities</option>
              <option value="CRITICAL">Critical</option>
              <option value="SERIOUS">Serious</option>
              <option value="MODERATE">Moderate</option>
              <option value="MINOR">Minor</option>
            </select>
          </div>
          <div className="min-w-[9rem]">
            <label htmlFor="status-filter" className="label">Status</label>
            <select id="status-filter" name="status" className="input" defaultValue={params.status ?? ""}>
              <option value="">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="MITIGATED">Mitigated</option>
              <option value="FALSE_POSITIVE">False positive</option>
              <option value="WONT_FIX">Won&apos;t fix / accepted risk</option>
            </select>
          </div>
          <div className="min-w-[9rem]">
            <label htmlFor="source-filter" className="label">Evidence source</label>
            <select id="source-filter" name="evidenceSource" className="input" defaultValue={params.evidenceSource ?? ""}>
              <option value="">All sources</option>
              <option value="AUTOMATED_AXE">Automated (axe)</option>
              <option value="MANUAL_REVIEW">Manual review</option>
              <option value="IMPORTED">Imported</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-secondary">Apply filters</button>
            {filterSummary.hasFilters && (
              <Link
                href={
                  (params.siteId || params.ruleId
                    ? `/findings${buildFindingsQueryString({ siteId: params.siteId, ruleId: params.ruleId })}`
                    : "/findings") as any
                }
                className="btn-ghost"
              >
                Clear
              </Link>
            )}
          </div>
        </form>
        {filterSummary.hasFilters && (
          <p className="mt-3 text-xs text-slate-500" aria-live="polite">
            <span className="font-medium text-slate-600">Filtered by:</span>{" "}
            {filterSummary.parts.join(" · ")}
          </p>
        )}
      </div>

      {/* ── Finding list ─────────────────────────────────────────────────── */}
      {findings.length === 0 ? (
        <EmptyState
          icon={total === 0 ? Inbox : AlertTriangle}
          title={total === 0 ? "No findings yet" : "No findings match your filters"}
          description={
            total === 0
              ? "Add a site and run a scan to start discovering accessibility issues."
              : "Try clearing filters or changing the page."
          }
          action={
            total > 0 ? (
              <Link
                href={
                  (params.siteId || params.ruleId
                    ? `/findings${buildFindingsQueryString({ siteId: params.siteId, ruleId: params.ruleId })}`
                    : "/findings") as any
                }
                className="btn-secondary text-sm"
              >
                Clear filters
              </Link>
            ) : (
              <Link href="/sites/new" className="btn-primary">
                Add Your First Site
              </Link>
            )
          }
          className="card"
        />
      ) : (
        <div className="space-y-2.5">
          {findings.map((finding) => (
            <FindingRow
              key={finding.id}
              finding={finding}
              latestCompletedScanCompletedAt={latestCompletedScanCompletedAt}
              jobPipelinesHealthy={platformTruth.flags.jobPipelinesHealthy}
              familySummary={familySummaryByRuleId[finding.ruleId]}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <nav
          className="flex items-center justify-center gap-2"
          aria-label="Pagination"
        >
          {page > 1 && (
            <Link
              href={`/findings${findingsListQueryString(params, page - 1)}` as any}
              className="btn-secondary text-sm"
              aria-label={`Previous page (page ${page - 1} of ${totalPages})`}
            >
              Previous
            </Link>
          )}
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-600 shadow-sm" aria-current="page">
            {page} / {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/findings${findingsListQueryString(params, page + 1)}` as any}
              className="btn-secondary text-sm"
              aria-label={`Next page (page ${page + 1} of ${totalPages})`}
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

/** Severity → left-border accent color */
const severityBorderClass: Record<string, string> = {
  CRITICAL: "border-l-red-500",
  SERIOUS:  "border-l-orange-500",
  MODERATE: "border-l-amber-400",
  MINOR:    "border-l-slate-300",
};

function FindingRow({
  finding,
  latestCompletedScanCompletedAt,
  jobPipelinesHealthy,
  familySummary,
}: {
  finding: FindingListRow;
  latestCompletedScanCompletedAt: Date | null;
  jobPipelinesHealthy: boolean;
  familySummary?: {
    totalFindings: number;
    activeFindings: number;
    regressedFindings: number;
    newlyDetectedFindings: number;
    persistentFindings: number;
    recurringAcrossScanRunsFindings: number;
    firstSeenAt: Date | null;
    lastSeenAt: Date | null;
  };
}) {
  const freshness = getAutomationEvidenceFreshnessDescriptor({
    evidenceSource: finding.evidenceSource,
    lastVerifiedAt: finding.lastVerifiedAt,
    latestCompletedScanCompletedAt,
    jobPipelinesHealthy,
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
  const priority = scoreFindingPriority({
    impact: finding.impact,
    truthStatus: finding.truthStatus,
    distinctScanRunsObserved: finding.distinctScanRunsObserved,
    occurrenceCount: finding.occurrenceCount,
    reopenedCount: finding.reopenedCount,
  });
  const proofCompletenessScore =
    Object.values(proofSummary.completeness).filter(Boolean).length;
  const changeLabelMap: Record<(typeof proofSummary)["changedSinceLastRun"], string> = {
    newly_detected:       "New",
    regressed:            "Regressed",
    persistent:           "Persistent",
    improved_open_backlog:"Absent in scans",
    not_comparable:       "Not comparable",
    unknown:              "Unknown",
  };
  const changeLabel = changeLabelMap[proofSummary.changedSinceLastRun];

  const evidenceLabel =
    finding.evidenceSource === "AUTOMATED_AXE"
      ? "Automated (axe)"
      : finding.evidenceSource === "MANUAL_REVIEW"
        ? "Manual review"
        : finding.evidenceSource === "IMPORTED"
          ? "Imported"
          : finding.evidenceSource;

  const extendedDescriptionParts = [
    `Truth status: ${finding.truthStatus.toLowerCase().replaceAll("_", " ")}.`,
    `Evidence source: ${evidenceLabel}.`,
    freshness && freshness.freshness !== "current"
      ? `Automation freshness: ${freshness.badgeLabel}. ${freshness.detail}`
      : null,
    finding.cluster ? `Cluster: ${finding.cluster.name}.` : null,
    `Proof completeness score ${proofCompletenessScore} out of 5.`,
    `Change signal: ${changeLabel}.`,
    `Scan-run recurrence: observed in ${proofSummary.recurrence.distinctScanRunsObserved} completed run(s).`,
    `Triage score ${priority.score.toFixed(0)}. ${priority.reasons.join(" ")}`,
    `First seen ${finding.firstSeenAt.toLocaleDateString()}.`,
    finding.lastVerifiedAt ? `Last verified ${finding.lastVerifiedAt.toLocaleDateString()}.` : null,
    finding.wcagTags.length > 0 ? `WCAG tags: ${finding.wcagTags.join(", ")}.` : null,
  ].filter(Boolean) as string[];

  const metaId = `finding-${finding.id}-extended`;
  const borderClass = severityBorderClass[finding.impact] ?? "border-l-slate-300";

  return (
    <article
      className={`overflow-hidden rounded-xl border border-l-4 border-slate-200 bg-white transition-shadow hover:shadow-[0_4px_8px_-2px_rgb(15_23_42/0.10)] motion-reduce:transition-none ${borderClass}`}
      style={{ boxShadow: "0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.04)" }}
    >
      <Link
        href={`/findings/${finding.id}`}
        className="block px-5 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600"
        aria-describedby={metaId}
      >
        {/* Top row: severity + rule + cluster */}
        <div className="flex flex-wrap items-center gap-2">
          <SeverityChip severity={finding.impact} size="sm" />
          <span className="font-mono text-xs text-slate-500 truncate max-w-[min(100%,12rem)]">
            {finding.ruleId}
          </span>
          {finding.cluster ? (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800 ring-1 ring-inset ring-violet-200 truncate max-w-[10rem]">
              {finding.cluster.name}
            </span>
          ) : null}
        </div>

        {/* Description */}
        <p className="mt-2 text-sm font-medium text-slate-900 leading-snug">
          {finding.description}
        </p>

        {/* Meta row */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>{finding.site.name}</span>
          <span aria-hidden="true">·</span>
          <span>{finding._count.occurrences} occurrence{finding._count.occurrences === 1 ? "" : "s"}</span>
          {freshness && freshness.freshness !== "current" && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-amber-700">{freshness.badgeLabel}</span>
            </>
          )}
          <span aria-hidden="true" className="ml-auto" />
          <ChevronRight className="h-3 w-3 text-slate-300" aria-hidden="true" />
        </div>

        {/* Badge row */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={finding.status} />
          <span
            className={`badge ring-1 ring-inset text-xs ${
              proofCompletenessScore >= 4
                ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
                : "bg-amber-50 text-amber-900 ring-amber-200"
            }`}
            title="Proof completeness: presence of key evidence fields."
          >
            Proof {proofCompletenessScore}/5
          </span>
          <span
            className={`badge ring-1 ring-inset text-xs ${
              changeLabel === "Regressed"
                ? "bg-red-50 text-red-800 ring-red-200"
                : changeLabel === "New"
                  ? "bg-brand-50 text-brand-800 ring-brand-200"
                  : changeLabel === "Persistent"
                    ? "bg-slate-100 text-slate-700 ring-slate-200"
                    : "bg-slate-100 text-slate-600 ring-slate-200"
            }`}
          >
            {changeLabel}
          </span>
        </div>

        <p id={metaId} className="sr-only">
          {extendedDescriptionParts.join(" ")}
        </p>
      </Link>

      {/* Expandable meta disclosure */}
      <FindingMetaDisclosure>
        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <div>
            <dt className="font-medium text-slate-500">First seen</dt>
            <dd className="text-slate-900">{finding.firstSeenAt.toLocaleDateString()}</dd>
          </div>
          {finding.lastVerifiedAt ? (
            <div>
              <dt className="font-medium text-slate-500">Last verified</dt>
              <dd className="text-slate-900">{finding.lastVerifiedAt.toLocaleDateString()}</dd>
            </div>
          ) : null}
          {familySummary ? (
            <>
              <div>
                <dt className="font-medium text-slate-500">Rule family</dt>
                <dd className="text-slate-900">
                  {familySummary.totalFindings} total · {familySummary.activeFindings} active
                  {familySummary.regressedFindings > 0 ? ` · ${familySummary.regressedFindings} regressed` : ""}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Family trend</dt>
                <dd className="text-slate-900">
                  {familySummary.newlyDetectedFindings} new · {familySummary.persistentFindings} persistent
                  {familySummary.recurringAcrossScanRunsFindings > 0
                    ? ` · ${familySummary.recurringAcrossScanRunsFindings} multi-run`
                    : ""}
                </dd>
              </div>
            </>
          ) : null}
          {proofSummary.lineage.scanRunId ? (
            <div className="sm:col-span-2">
              <dt className="font-medium text-slate-500">Lineage scan</dt>
              <dd className="font-mono text-slate-700">{proofSummary.lineage.scanRunId}</dd>
            </div>
          ) : null}
          {finding.wcagTags.length > 0 ? (
            <div className="sm:col-span-2">
              <dt className="font-medium text-slate-500">WCAG tags</dt>
              <dd className="text-slate-900">{finding.wcagTags.join(", ")}</dd>
            </div>
          ) : null}
        </dl>
      </FindingMetaDisclosure>
    </article>
  );
}
