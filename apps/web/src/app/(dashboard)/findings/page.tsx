import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { AlertTriangle, Inbox } from "lucide-react";
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
        <h1 className="text-2xl font-bold text-slate-900">Findings</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Findings require a working database"
          showSystemLink={canViewSystem}
        >
          <p>
            Findings cannot be loaded until core data services are healthy. See
            the banner above for status.
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Findings</h1>
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
        <h1 className="text-2xl font-bold text-slate-900">Findings</h1>
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

  const buildFindingsWhere = (
    organizationId: string,
  ): any => {
    const where: any = {
      site: {
        workspace: { organizationId },
        ...(params.siteId ? { id: params.siteId } : {}),
      },
    };

    if (params.severity) {
      where.impact = params.severity as Severity;
    }
    if (params.status) {
      where.status = params.status as FindingStatus;
    }
    if (params.ruleId) {
      where.ruleId = params.ruleId;
    }
    if (
      params.evidenceSource &&
      ["AUTOMATED_AXE", "MANUAL_REVIEW", "IMPORTED"].includes(
        params.evidenceSource,
      )
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
        orderBy: [{ impact: "asc" }, { occurrenceCount: "desc" }],
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
        <h1 className="text-2xl font-bold text-slate-900">Findings</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Findings list unavailable"
          showSystemLink={canViewSystem}
        >
          <p>
            Could not load findings from the database ({listResult.message}).
          </p>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Findings</h1>
          <p className="text-slate-500 mt-1">
            {total} deduplicated finding{total === 1 ? "" : "s"} in your
            organization (not a legal conformance score).
          </p>
          {filterSummary.hasFilters && (
            <p className="text-sm text-slate-600 mt-2" aria-live="polite">
              <span className="font-medium text-slate-700">Filtered by:</span>{" "}
              {filterSummary.parts.join(" · ")}
            </p>
          )}
        </div>
      </div>

      {!platformTruth.flags.jobPipelinesHealthy && (
        <RouteReliabilityNotice
          variant="warning"
          title="Automation freshness is degraded"
          showSystemLink={canViewSystem}
        >
          <p>
            Findings still reflect stored organization data, but workers or
            queues are degraded. Automated evidence freshness is shown as
            degraded until pipelines recover.
          </p>
        </RouteReliabilityNotice>
      )}

      <div className="card">
        <form className="flex flex-wrap gap-4" method="GET">
          {params.siteId ? (
            <input type="hidden" name="siteId" value={params.siteId} />
          ) : null}
          {params.ruleId ? (
            <input type="hidden" name="ruleId" value={params.ruleId} />
          ) : null}
          <div>
            <label htmlFor="severity-filter" className="label">
              Severity
            </label>
            <select
              id="severity-filter"
              name="severity"
              className="input"
              defaultValue={params.severity ?? ""}
            >
              <option value="">All</option>
              <option value="CRITICAL">Critical</option>
              <option value="SERIOUS">Serious</option>
              <option value="MODERATE">Moderate</option>
              <option value="MINOR">Minor</option>
            </select>
          </div>
          <div>
            <label htmlFor="status-filter" className="label">
              Status
            </label>
            <select
              id="status-filter"
              name="status"
              className="input"
              defaultValue={params.status ?? ""}
            >
              <option value="">All</option>
              <option value="OPEN">Open</option>
              <option value="ACKNOWLEDGED">Acknowledged</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="MITIGATED">Mitigated</option>
              <option value="FALSE_POSITIVE">False positive</option>
              <option value="WONT_FIX">Won&apos;t fix / accepted risk</option>
            </select>
          </div>
          <div>
            <label htmlFor="source-filter" className="label">
              Evidence source
            </label>
            <select
              id="source-filter"
              name="evidenceSource"
              className="input"
              defaultValue={params.evidenceSource ?? ""}
            >
              <option value="">All</option>
              <option value="AUTOMATED_AXE">Automated (axe)</option>
              <option value="MANUAL_REVIEW">Manual review</option>
              <option value="IMPORTED">Imported</option>
            </select>
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-secondary">
              Filter
            </button>
          </div>
        </form>
      </div>

      {findings.length === 0 ? (
        <EmptyState
          icon={total === 0 ? Inbox : AlertTriangle}
          title={
            total === 0 ? "No findings yet" : "No findings match your filters"
          }
          description={
            total === 0
              ? "There are no findings for this organization yet. Add a site and run a scan to get started."
              : "Try clearing filters or changing the page."
          }
          action={
            total > 0 ? (
              <Link
                href={
                  (params.siteId || params.ruleId
                    ? `/findings${buildFindingsQueryString({
                        siteId: params.siteId,
                        ruleId: params.ruleId,
                      })}`
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
        <div className="space-y-3">
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

      {totalPages > 1 && (
        <nav
          className="flex items-center justify-center gap-2"
          aria-label="Pagination"
        >
          {page > 1 && (
            <Link
              href={`/findings${findingsListQueryString(params, page - 1)}` as any}
              className="btn-secondary text-sm min-h-[44px]"
              aria-label={`Go to previous page, currently on page ${page} of ${totalPages}`}
            >
              Previous
            </Link>
          )}
          <span
            className="text-sm text-slate-500 px-3 py-2"
            aria-current="page"
          >
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/findings${findingsListQueryString(params, page + 1)}` as any}
              className="btn-secondary text-sm min-h-[44px]"
              aria-label={`Go to next page, currently on page ${page} of ${totalPages}`}
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

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
  });
  const proofCompletenessScore =
    Object.values(proofSummary.completeness).filter(Boolean).length;
  const truthLabel = finding.truthStatus.toLowerCase().replaceAll("_", " ");
  const changeLabel = proofSummary.changedSinceLastRun.replaceAll("_", " ");

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
    `Change vs last run: ${proofSummary.changedSinceLastRun.replaceAll("_", " ")}.`,
    familySummary
      ? `Rule family: ${familySummary.totalFindings} total findings, ${familySummary.activeFindings} active; ${familySummary.newlyDetectedFindings} newly detected, ${familySummary.persistentFindings} persistent${
          familySummary.regressedFindings > 0
            ? `; ${familySummary.regressedFindings} regressed`
            : ""
        }.`
      : null,
    `First seen ${finding.firstSeenAt.toLocaleDateString()}.`,
    familySummary?.firstSeenAt
      ? `Family first seen ${familySummary.firstSeenAt.toLocaleDateString()}.`
      : null,
    finding.lastVerifiedAt
      ? `Last verified ${finding.lastVerifiedAt.toLocaleDateString()}.`
      : null,
    familySummary?.lastSeenAt
      ? `Family last seen ${familySummary.lastSeenAt.toLocaleDateString()}.`
      : null,
    proofSummary.lineage.scanRunId
      ? `Lineage scan run ${proofSummary.lineage.scanRunId}.`
      : null,
    finding.wcagTags.length > 0
      ? `WCAG tags: ${finding.wcagTags.join(", ")}.`
      : null,
  ].filter(Boolean) as string[];

  const metaId = `finding-${finding.id}-extended`;

  return (
    <article className="card p-0 overflow-hidden transition-shadow hover:shadow-[var(--shadow-card-hover)] motion-reduce:transition-none">
      <Link
        href={`/findings/${finding.id}`}
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 rounded-lg"
        aria-describedby={metaId}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityChip severity={finding.impact} size="sm" />
              <span className="font-mono text-xs text-slate-500 truncate max-w-[min(100%,12rem)]">
                {finding.ruleId}
              </span>
              {finding.cluster ? (
                <span className="text-xs font-medium text-violet-800 truncate max-w-[10rem]">
                  {finding.cluster.name}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-sm font-medium text-slate-900">
              {finding.description}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {finding.site.name} · {finding._count.occurrences} occurrence
              {finding._count.occurrences === 1 ? "" : "s"}
              {freshness && freshness.freshness !== "current"
                ? ` · ${freshness.badgeLabel}`
                : ""}
            </p>
          </div>
          <div className="shrink-0 pt-0.5">
            <StatusBadge status={finding.status} />
            <span
              className={`badge ${
                proofCompletenessScore >= 4
                  ? "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200"
                  : "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200"
              }`}
              title="Summary of whether key proof fields are present for this finding."
            >
              Proof {proofCompletenessScore}/5
            </span>
            <span className="badge bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200">
              {changeLabel}
            </span>
          </div>
        </div>
        <p id={metaId} className="sr-only">
          {extendedDescriptionParts.join(" ")}
        </p>
      </Link>
      <FindingMetaDisclosure>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium text-slate-500">First seen</dt>
            <dd>{finding.firstSeenAt.toLocaleDateString()}</dd>
          </div>
          {finding.lastVerifiedAt ? (
            <div>
              <dt className="text-xs font-medium text-slate-500">
                Last verified
              </dt>
              <dd>{finding.lastVerifiedAt.toLocaleDateString()}</dd>
            </div>
          ) : null}
          {familySummary ? (
            <>
              <div>
                <dt className="text-xs font-medium text-slate-500">Rule family</dt>
                <dd>
                  {familySummary.totalFindings} total ·{" "}
                  {familySummary.activeFindings} active
                  {familySummary.regressedFindings > 0
                    ? ` · ${familySummary.regressedFindings} regressed`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Family trend</dt>
                <dd>
                  {familySummary.newlyDetectedFindings} new ·{" "}
                  {familySummary.persistentFindings} persistent
                </dd>
              </div>
              {familySummary.firstSeenAt ? (
                <div>
                  <dt className="text-xs font-medium text-slate-500">
                    Family first seen
                  </dt>
                  <dd>{familySummary.firstSeenAt.toLocaleDateString()}</dd>
                </div>
              ) : null}
              {familySummary.lastSeenAt ? (
                <div>
                  <dt className="text-xs font-medium text-slate-500">
                    Family last seen
                  </dt>
                  <dd>{familySummary.lastSeenAt.toLocaleDateString()}</dd>
                </div>
              ) : null}
            </>
          ) : null}
          {proofSummary.lineage.scanRunId ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500">Lineage scan</dt>
              <dd className="font-mono text-xs">{proofSummary.lineage.scanRunId}</dd>
            </div>
          ) : null}
          {finding.wcagTags.length > 0 ? (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium text-slate-500">WCAG tags</dt>
              <dd>{finding.wcagTags.join(", ")}</dd>
            </div>
          ) : null}
        </dl>
      </FindingMetaDisclosure>
    </article>
  );
}
