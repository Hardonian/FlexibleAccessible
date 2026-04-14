import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { ChevronRight, Clock, Globe, Layers, RefreshCw } from "lucide-react";
import { hasPermission } from "@aros/config";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import {
  StatusBadge,
  EmptyState,
  MetricCard,
  SeverityChip,
  ProcessBadge,
  type SeverityLevel,
} from "@aros/ui";
import { ScanNowButton } from "./scan-now-button";
import { scanSiteInitialState } from "./scan-action-state";
import { getAutomationEvidenceFreshnessDescriptor } from "@/lib/findings/evidence-freshness";
import {
  scanEnqueueFailureOperatorHint,
  postCrawlKickoffOperatorSummary,
  getSiteVerificationStatus,
  getPostCrawlScanEnqueueFailureHint,
} from "@/lib/sites/verification-status";
import { buildFindingProofSummary } from "@/lib/findings/proof-summary";
import { startCrawlAction } from "./actions";
import {
  startSiteScanAction,
  retryPostCrawlScanKickoffAction,
} from "./scan-actions";
import { pageTitle } from "@/lib/product-brand";
import {
  nextScheduleRunAt,
  scheduleBlockedReason,
  scheduleCadenceLabel,
} from "@aros/core-services";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { name: true },
  });
  return { title: site ? pageTitle(site.name) : pageTitle("Site") };
}

export default async function SiteDetailPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();

  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind === "platform_blocked") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Site Details</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Site details require a working database"
        >
          <p>
            Site information cannot be loaded until core data services are
            healthy.
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Site Details</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Could not verify organization"
        >
          <p>{orgRes.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "none") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Site Details</h1>
        <RouteReliabilityNotice
          variant="info"
          title="No organization membership"
        >
          <p>You need an organization to view sites.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const siteResult = await runOrgScopedQuery(orgRes, async (organizationId) => {
    return prisma.site.findFirst({
      where: { id: siteId, workspace: { organizationId } },
      include: {
        crawlConfig: true,
        workspace: {
          select: {
            id: true,
            organizationId: true,
          },
        },
        scanRuns: {
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            status: true,
            createdAt: true,
            completedAt: true,
            pagesScanned: true,
            violationsFound: true,
          },
        },
        canonicalFindings: {
          take: 20,
          orderBy: { occurrenceCount: "desc" },
          include: {
            _count: { select: { occurrences: true } },
            cluster: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: {
            pages: true,
            crawlRuns: true,
            scanRuns: true,
          },
        },
      },
    });
  });

  if (!siteResult.ok || !siteResult.data) {
    notFound();
  }

  const site = siteResult.data;
  if (!hasPermission(orgRes.role, "site:view")) {
    notFound();
  }

  const canStartScan = hasPermission(orgRes.role, "scan:start");
  const canManageSite = hasPermission(orgRes.role, "site:manage");

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: orgRes.organizationId },
    select: {
      plan: true,
      status: true,
      maxDomains: true,
      maxPagesPerCrawl: true,
      maxScansPerMonth: true,
      maxSeats: true,
      aiEnabled: true,
      aiTokenLimit: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  });

  const [
    recentCrawls,
    recentScans,
    findings,
    pageCountForScan,
    verificationExtras,
    findingsForRecentScanProof,
  ] = await Promise.all([
    prisma.crawlRun.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        pagesCrawled: true,
        startedAt: true,
        completedAt: true,
        postCrawlScanKickoffStatus: true,
        postCrawlScanKickoffReasonCode: true,
        postCrawlScanKickoffDetail: true,
      },
    }),
    prisma.scanRun.findMany({
      where: { siteId },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.canonicalFinding.findMany({
      where: {
        occurrences: { some: { page: { siteId } } },
        status: "OPEN",
      },
      orderBy: { impact: "asc" },
      take: 20,
    }),
    prisma.page.count({ where: { siteId } }),
    (async () => {
      try {
        const [verificationStatus, postCrawlEnqueueHint] = await Promise.all([
          getSiteVerificationStatus(prisma, {
            siteId,
            organizationId: site.workspace.organizationId,
          }),
          getPostCrawlScanEnqueueFailureHint(prisma, {
            siteId,
            organizationId: site.workspace.organizationId,
          }),
        ]);
        return {
          verificationStatus,
          postCrawlEnqueueHint,
          verificationLoadError: null as string | null,
        };
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Could not load verification status";
        console.error("[site detail] verification status query failed", e);
        return {
          verificationStatus: null,
          postCrawlEnqueueHint: {
            show: false,
            message: null,
            kickoffStatus: null,
            relatedScanRunId: null,
            crawlRunId: null,
          },
          verificationLoadError: message,
        };
      }
    })(),
    prisma.canonicalFinding.findMany({
      where: { siteId, lastScanRunId: { in: site.scanRuns.map((scan) => scan.id) } },
      select: {
        lastScanRunId: true,
        evidenceSummary: true,
        provenance: true,
        firstSeenAt: true,
        lastSeenAt: true,
        reopenedCount: true,
        distinctScanRunsObserved: true,
        distinctScanRunsAbsentWhenOpen: true,
        evidenceSource: true,
        sourceType: true,
      },
    }),
  ]);
  const proofByScanRunId: Record<
    string,
    { complete: number; incomplete: number; regressed: number }
  > = {};
  for (const finding of findingsForRecentScanProof) {
    if (!finding.lastScanRunId) continue;
    const proof = buildFindingProofSummary({
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
    const completenessCount = Object.values(proof.completeness).filter(Boolean).length;
    const bucket = (proofByScanRunId[finding.lastScanRunId] ??= {
      complete: 0,
      incomplete: 0,
      regressed: 0,
    });
    if (completenessCount >= 4) bucket.complete += 1;
    else bucket.incomplete += 1;
    if (proof.changedSinceLastRun === "regressed") bucket.regressed += 1;
  }

  const { verificationStatus, postCrawlEnqueueHint, verificationLoadError } =
    verificationExtras;

  const postCrawlKickoffFailed =
    postCrawlEnqueueHint.show &&
    postCrawlEnqueueHint.kickoffStatus != null &&
    [
      "QUEUE_UNAVAILABLE",
      "QUEUE_REJECTED",
      "DISPATCH_UNAVAILABLE",
      "KICKOFF_FAILED_UNKNOWN",
    ].includes(postCrawlEnqueueHint.kickoffStatus);
  const showSiteFailedEnqueueBanner =
    verificationStatus?.status === "failed_enqueue" &&
    (!postCrawlKickoffFailed ||
      verificationStatus.scanRunId !== postCrawlEnqueueHint.relatedScanRunId);

  const scanBlocked =
    verificationStatus?.status === "pending" ||
    verificationStatus?.status === "running";
  const scanBlockedHint =
    verificationStatus?.status === "pending"
      ? "Verification is already queued for this site."
      : verificationStatus?.status === "running"
        ? "Verification is already running for this site."
        : null;

  const scheduleCron = site.crawlConfig?.scheduleCron ?? null;
  const cadenceLabel = scheduleCadenceLabel(scheduleCron);
  const scheduleNextRunAt = nextScheduleRunAt(scheduleCron, new Date());
  const scheduleBlockedHint = scheduleBlockedReason(scheduleCron);
  const lastSuccessfulCrawl = recentCrawls.find((crawl) => crawl.status === "COMPLETED" && crawl.completedAt);

  const findingsBySeverity = {
    critical: findings.filter((f) => f.impact === "CRITICAL").length,
    serious: findings.filter((f) => f.impact === "SERIOUS").length,
    moderate: findings.filter((f) => f.impact === "MODERATE").length,
    minor: findings.filter((f) => f.impact === "MINOR").length,
  };

  return (
    <div className="space-y-6">
      {verificationLoadError ? (
        <RouteReliabilityNotice variant="warning" title="Verification queue status unavailable">
          <p>Could not load live verification queue status ({verificationLoadError}). Scan history below still reflects stored runs.</p>
        </RouteReliabilityNotice>
      ) : null}
      {(verificationStatus?.status === "pending" || verificationStatus?.status === "running") ? (
        <RouteReliabilityNotice variant="info" title={verificationStatus.status === "pending" ? "Verification pending" : "Verification in progress"}>
          <p>Automated evidence refreshes when this scan finishes (queued at {verificationStatus.createdAt?.toLocaleString() ?? "unknown"}).</p>
        </RouteReliabilityNotice>
      ) : null}
      {showSiteFailedEnqueueBanner ? (
        <RouteReliabilityNotice variant="warning" title="Verification could not be queued">
          <p>
            {scanEnqueueFailureOperatorHint(verificationStatus.enqueueFailureCode)}
            {verificationStatus.errorDetail ? ` ${verificationStatus.errorDetail}` : ""}{" "}
            Use Queue verification scan once Redis and workers are healthy.
          </p>
        </RouteReliabilityNotice>
      ) : null}
      {postCrawlEnqueueHint.show && postCrawlEnqueueHint.message ? (
        <RouteReliabilityNotice variant="warning" title="Post-crawl scan kickoff issue">
          <p>{postCrawlEnqueueHint.message}</p>
          {canStartScan && postCrawlKickoffFailed && postCrawlEnqueueHint.crawlRunId ? (
            <form action={retryPostCrawlScanKickoffAction} className="mt-3">
              <input type="hidden" name="siteId" value={siteId} />
              <input type="hidden" name="crawlRunId" value={postCrawlEnqueueHint.crawlRunId} />
              <button type="submit" className="btn-secondary text-sm">Retry scan kickoff</button>
            </form>
          ) : null}
        </RouteReliabilityNotice>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <nav
            className="mb-1 text-sm text-slate-500"
            aria-label="Breadcrumb"
          >
            <ol className="flex flex-wrap items-center gap-1">
              <li>
                <Link href="/sites" className="hover:text-brand-700">
                  Sites
                </Link>
              </li>
              <li aria-hidden="true" className="text-slate-300">
                /
              </li>
              <li className="truncate font-medium text-slate-700">{site.name}</li>
            </ol>
          </nav>
          <h1 className="page-title">{site.name}</h1>
          <p className="page-description mt-0.5">{site.domain}</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
          <form action={startCrawlAction} className="w-full sm:w-auto">
            <input type="hidden" name="siteId" value={siteId} />
            <button type="submit" className="btn-primary w-full sm:w-auto">
              Start crawl
            </button>
          </form>
          {canStartScan ? (
            <div className="w-full sm:w-auto [&_button]:w-full [&_button]:sm:w-auto">
              <ScanNowButton
                action={startSiteScanAction}
                initialState={scanSiteInitialState}
                siteId={siteId}
                disabled={pageCountForScan === 0 || Boolean(scanBlocked)}
                blockedHint={
                  scanBlockedHint ??
                  (pageCountForScan === 0
                    ? "Run a crawl first so there are pages to verify."
                    : null)
                }
              />
            </div>
          ) : null}
          {canManageSite ? (
            <Link
              href={`/sites/${siteId}/settings`}
              className="btn-secondary w-full text-center sm:w-auto"
            >
              Site settings
            </Link>
          ) : null}
        </div>
      </div>

      {/* ── Summary metrics ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="Pages discovered" value={site._count.pages} icon={Globe} variant="brand" accent as="article" />
        <MetricCard label="Total crawls"     value={site._count.crawlRuns} icon={RefreshCw} variant="neutral" accent as="article" />
        <MetricCard label="Total scans"      value={site._count.scanRuns} icon={Layers} variant="neutral" accent as="article" />
        <MetricCard
          label="Open findings"
          value={findings.length}
          icon={RefreshCw}
          variant={findings.length > 0 ? "critical" : "success"}
          accent
          as="article"
        />
      </div>

      {/* ── Crawl automation ───────────────────────────────────────────── */}
      <section className="card" aria-labelledby="crawl-automation-heading">
        <div className="flex items-center gap-2 mb-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100" aria-hidden="true">
            <Clock className="h-3.5 w-3.5 text-slate-500" />
          </span>
          <h2 id="crawl-automation-heading" className="section-heading">Crawl automation</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Cadence</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{cadenceLabel}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Last successful crawl</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {lastSuccessfulCrawl?.completedAt?.toLocaleString() ?? "Never"}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Next scheduled run</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">
              {scheduleNextRunAt?.toLocaleString() ?? "Not scheduled"}
            </p>
          </div>
        </div>
        {scheduleBlockedHint ? (
          <p className="mt-3 text-xs font-medium text-amber-700">Blocked: {scheduleBlockedHint}</p>
        ) : null}
      </section>

      {/* ── Severity breakdown ─────────────────────────────────────────── */}
      <section className="card" aria-labelledby="severity-breakdown-heading">
        <h2 id="severity-breakdown-heading" className="section-heading mb-4">Findings by severity</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SeverityBlock label="Critical" count={findingsBySeverity.critical} severity="CRITICAL" />
          <SeverityBlock label="Serious"  count={findingsBySeverity.serious}  severity="SERIOUS"  />
          <SeverityBlock label="Moderate" count={findingsBySeverity.moderate} severity="MODERATE" />
          <SeverityBlock label="Minor"    count={findingsBySeverity.minor}    severity="MINOR"    />
        </div>
        {/* Visual severity bar */}
        {findings.length > 0 && (
          <div className="mt-4" aria-hidden="true">
            <SeverityBar
              critical={findingsBySeverity.critical}
              serious={findingsBySeverity.serious}
              moderate={findingsBySeverity.moderate}
              minor={findingsBySeverity.minor}
            />
          </div>
        )}
      </section>

      {/* ── Recent crawls ──────────────────────────────────────────────── */}
      <div className="card">
        <h2 className="section-heading mb-4">Recent crawls</h2>
        {recentCrawls.length === 0 ? (
          <EmptyState
            icon={RefreshCw}
            title="No crawls yet"
            description="Start a crawl to begin discovering pages for accessibility scanning."
          />
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="data-table">
              <caption className="sr-only">Recent crawl runs</caption>
              <thead>
                <tr>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">Pages</th>
                  <th scope="col">After crawl</th>
                  <th scope="col" className="text-right">Started</th>
                  <th scope="col" className="text-right">Completed</th>
                </tr>
              </thead>
              <tbody>
                {recentCrawls.map((crawl) => {
                  const afterSummary =
                    crawl.status === "COMPLETED"
                      ? postCrawlKickoffOperatorSummary(
                          crawl.postCrawlScanKickoffStatus,
                          crawl.postCrawlScanKickoffReasonCode,
                          crawl.postCrawlScanKickoffDetail,
                        )
                      : null;
                  return (
                    <tr key={crawl.id}>
                      <td><ProcessBadge status={crawl.status} /></td>
                      <td className="text-right tabular-nums">{crawl.pagesCrawled}</td>
                      <td className="max-w-xs text-xs">
                        {afterSummary ?? <span className="text-slate-400">—</span>}
                      </td>
                      <td className="text-right text-xs text-slate-500 tabular-nums">
                        {crawl.startedAt?.toLocaleString() ?? "—"}
                      </td>
                      <td className="text-right text-xs text-slate-500 tabular-nums">
                        {crawl.completedAt?.toLocaleString() ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recent scans ───────────────────────────────────────────────── */}
      <div className="card">
        <h2 className="section-heading mb-4">Recent verification scans</h2>
        {recentScans.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No scans yet"
            description="Run a verification scan after crawling to find accessibility issues."
          />
        ) : (
          <div className="overflow-x-auto -mx-6 px-6">
            <table className="data-table">
              <caption className="sr-only">Recent scan runs</caption>
              <thead>
                <tr>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">Pages</th>
                  <th scope="col" className="text-right">Violations</th>
                  <th scope="col">Proof snapshot</th>
                  <th scope="col" className="text-right">Δ</th>
                  <th scope="col" className="text-right">Started</th>
                </tr>
              </thead>
              <tbody>
                {recentScans.map((scan, index) => {
                  const previous = recentScans[index + 1];
                  const change = previous
                    ? scan.violationsFound - previous.violationsFound
                    : null;
                  const proofSnapshot = proofByScanRunId[scan.id];
                  return (
                    <tr key={scan.id}>
                      <td><ProcessBadge status={scan.status} /></td>
                      <td className="text-right tabular-nums">
                        {scan.pagesScanned}{scan.totalPages > 0 ? ` / ${scan.totalPages}` : ""}
                      </td>
                      <td className="text-right tabular-nums font-medium">{scan.violationsFound}</td>
                      <td className="text-xs">
                        {proofSnapshot ? (
                          <span>
                            <span className="text-emerald-700 font-medium">{proofSnapshot.complete}✓</span>
                            {" · "}
                            <span className="text-amber-700">{proofSnapshot.incomplete} incomplete</span>
                            {proofSnapshot.regressed > 0 && (
                              <span className="text-red-700"> · {proofSnapshot.regressed} regressed</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400">No lineage yet</span>
                        )}
                      </td>
                      <td className="text-right tabular-nums font-semibold">
                        {change == null ? (
                          <span className="text-slate-400">—</span>
                        ) : change > 0 ? (
                          <span className="text-red-700">+{change}</span>
                        ) : change < 0 ? (
                          <span className="text-emerald-700">{change}</span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                      <td className="text-right text-xs text-slate-500 tabular-nums">
                        {scan.startedAt?.toLocaleString() ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Open findings ──────────────────────────────────────────────── */}
      <div className="card">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="section-heading">Open findings</h2>
          <Link
            href={`/findings?siteId=${siteId}`}
            className="flex items-center gap-1 text-sm font-medium text-brand-700 underline-offset-2 hover:underline"
          >
            View all for this site
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
        {findings.length === 0 ? (
          <EmptyState
            icon={Globe}
            variant="success"
            title="No open findings"
            description="Queue a verification scan to discover accessibility issues."
          />
        ) : (
          <ul className="divide-y divide-slate-100" role="list">
            {findings.slice(0, 10).map((finding) => (
              <li key={finding.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <SeverityChip severity={finding.impact} size="sm" />
                  <span className="truncate text-sm text-slate-900">{finding.description}</span>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-slate-500">
                  {finding.occurrenceCount} occ.
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SeverityBlock({
  label,
  count,
  severity,
}: {
  label: string;
  count: number;
  severity: SeverityLevel;
}) {
  const accentByLevel: Record<SeverityLevel, string> = {
    CRITICAL: "border-l-red-500",
    SERIOUS:  "border-l-orange-500",
    MODERATE: "border-l-amber-400",
    MINOR:    "border-l-slate-300",
  };
  return (
    <div
      className={`rounded-xl border border-l-4 border-slate-200 bg-white p-3 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)] ${accentByLevel[severity]}`}
    >
      <SeverityChip severity={severity} size="sm" />
      <p
        className="mt-2 text-2xl font-bold tabular-nums text-slate-900"
        aria-label={`${label}: ${count} open`}
      >
        {count}
      </p>
      <p className="text-xs text-slate-500 mt-0.5">{label} open</p>
    </div>
  );
}

/** Visual proportional bar showing severity distribution */
function SeverityBar({
  critical,
  serious,
  moderate,
  minor,
}: {
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
}) {
  const total = critical + serious + moderate + minor;
  if (total === 0) return null;

  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;

  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
      {critical > 0 && (
        <div className="bg-red-500 transition-all" style={{ width: pct(critical) }} />
      )}
      {serious > 0 && (
        <div className="bg-orange-500 transition-all" style={{ width: pct(serious) }} />
      )}
      {moderate > 0 && (
        <div className="bg-amber-400 transition-all" style={{ width: pct(moderate) }} />
      )}
      {minor > 0 && (
        <div className="bg-slate-300 transition-all" style={{ width: pct(minor) }} />
      )}
    </div>
  );
}
