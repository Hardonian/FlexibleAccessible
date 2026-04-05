import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { hasPermission } from "@aros/config";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { StatusBadge, EmptyState, SeverityChip, type SeverityLevel } from "@aros/ui";
import { ScanNowButton } from "./scan-now-button";
import { ScanSiteActionState, scanSiteInitialState } from "./scan-action-state";
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
  return { title: site ? site.name : "Site" };
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

  const findingsBySeverity = {
    critical: findings.filter((f) => f.impact === "CRITICAL").length,
    serious: findings.filter((f) => f.impact === "SERIOUS").length,
    moderate: findings.filter((f) => f.impact === "MODERATE").length,
    minor: findings.filter((f) => f.impact === "MINOR").length,
  };

  return (
    <div className="space-y-6">
      {verificationLoadError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Could not load live verification queue status ({verificationLoadError}
          ). Scan history below still reflects stored runs.
        </div>
      ) : null}
      {verificationStatus?.status === "pending" ||
      verificationStatus?.status === "running" ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {verificationStatus.status === "pending"
            ? "Verification pending"
            : "Verification in progress"}
          : automated evidence refreshes when this scan finishes (queued at{" "}
          {verificationStatus.createdAt?.toLocaleString() ?? "unknown"}).
        </div>
      ) : null}
      {showSiteFailedEnqueueBanner ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span className="font-medium">Verification could not be queued.</span>{" "}
          {scanEnqueueFailureOperatorHint(
            verificationStatus.enqueueFailureCode,
          )}
          {verificationStatus.errorDetail
            ? ` ${verificationStatus.errorDetail}`
            : ""}{" "}
          Use Queue verification scan once Redis and workers are healthy.
        </div>
      ) : null}
      {postCrawlEnqueueHint.show && postCrawlEnqueueHint.message ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-3">
          <p>{postCrawlEnqueueHint.message}</p>
          {canStartScan &&
          postCrawlKickoffFailed &&
          postCrawlEnqueueHint.crawlRunId ? (
            <form action={retryPostCrawlScanKickoffAction}>
              <input type="hidden" name="siteId" value={siteId} />
              <input
                type="hidden"
                name="crawlRunId"
                value={postCrawlEnqueueHint.crawlRunId}
              />
              <button type="submit" className="btn-secondary text-sm">
                Retry scan kickoff
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/sites" className="hover:text-brand-600">
              Sites
            </Link>
            <span>/</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{site.name}</h1>
          <p className="text-slate-500 mt-0.5">{site.domain}</p>
        </div>
        <div className="flex flex-wrap items-start gap-3">
          <form action={startCrawlAction}>
            <input type="hidden" name="siteId" value={siteId} />
            <button type="submit" className="btn-primary">
              Start Crawl
            </button>
          </form>
          {canStartScan ? (
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
          ) : null}
          {canManageSite ? (
            <Link href={`/sites/${siteId}/settings`} className="btn-secondary">
              Settings
            </Link>
          ) : null}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-slate-500">Pages Discovered</p>
          <p className="text-2xl font-bold text-slate-900">
            {site._count.pages}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Total Crawls</p>
          <p className="text-2xl font-bold text-slate-900">
            {site._count.crawlRuns}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Total Scans</p>
          <p className="text-2xl font-bold text-slate-900">
            {site._count.scanRuns}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-slate-500">Open Findings</p>
          <p className="text-2xl font-bold text-slate-900">{findings.length}</p>
        </div>
      </div>

      {/* Severity Breakdown */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Findings by Severity
        </h2>
        <div className="flex flex-wrap gap-6">
          <SeverityBlock
            label="Critical"
            count={findingsBySeverity.critical}
            severity="CRITICAL"
          />
          <SeverityBlock
            label="Serious"
            count={findingsBySeverity.serious}
            severity="SERIOUS"
          />
          <SeverityBlock
            label="Moderate"
            count={findingsBySeverity.moderate}
            severity="MODERATE"
          />
          <SeverityBlock
            label="Minor"
            count={findingsBySeverity.minor}
            severity="MINOR"
          />
        </div>
      </div>

      {/* Recent Crawls */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Recent Crawls
        </h2>
        {recentCrawls.length === 0 ? (
          <p className="text-sm text-slate-500" role="status">
            No crawls yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Recent crawl runs</caption>
              <thead>
                <tr className="border-b border-slate-200">
                  <th
                    scope="col"
                    className="pb-2 text-left font-medium text-slate-500"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="pb-2 text-right font-medium text-slate-500"
                  >
                    Pages
                  </th>
                  <th
                    scope="col"
                    className="pb-2 text-left font-medium text-slate-500"
                  >
                    After crawl
                  </th>
                  <th
                    scope="col"
                    className="pb-2 text-right font-medium text-slate-500"
                  >
                    Started
                  </th>
                  <th
                    scope="col"
                    className="pb-2 text-right font-medium text-slate-500"
                  >
                    Completed
                  </th>
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
                    <tr key={crawl.id} className="border-b border-slate-100">
                      <td className="py-2">
                        <span
                          className={`badge ${
                            crawl.status === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : crawl.status === "RUNNING"
                                ? "bg-blue-100 text-blue-800"
                                : crawl.status === "FAILED"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {crawl.status.toLowerCase()}
                        </span>
                      </td>
                      <td className="py-2 text-right text-slate-600">
                        {crawl.pagesCrawled}
                      </td>
                      <td className="py-2 text-left text-slate-600 text-xs max-w-xs">
                        {afterSummary ?? (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-2 text-right text-slate-500">
                        {crawl.startedAt?.toLocaleString() ?? "-"}
                      </td>
                      <td className="py-2 text-right text-slate-500">
                        {crawl.completedAt?.toLocaleString() ?? "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Scans */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Recent Scans
        </h2>
        {recentScans.length === 0 ? (
          <p className="text-sm text-slate-500" role="status">
            No scans yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Recent scan runs</caption>
              <thead>
                <tr className="border-b border-slate-200">
                  <th
                    scope="col"
                    className="pb-2 text-left font-medium text-slate-500"
                  >
                    Status
                  </th>
                  <th
                    scope="col"
                    className="pb-2 text-right font-medium text-slate-500"
                  >
                    Pages scanned
                  </th>
                  <th
                    scope="col"
                    className="pb-2 text-right font-medium text-slate-500"
                  >
                    Violations
                  </th>
                  <th
                    scope="col"
                    className="pb-2 text-left font-medium text-slate-500"
                  >
                    Proof snapshot
                  </th>
                  <th
                    scope="col"
                    className="pb-2 text-right font-medium text-slate-500"
                  >
                    Changed
                  </th>
                  <th
                    scope="col"
                    className="pb-2 text-right font-medium text-slate-500"
                  >
                    Started
                  </th>
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
                  <tr key={scan.id} className="border-b border-slate-100">
                    <td className="py-2">
                      <span
                        className={`badge ${
                          scan.status === "COMPLETED"
                            ? "bg-green-100 text-green-800"
                            : scan.status === "RUNNING"
                              ? "bg-blue-100 text-blue-800"
                              : scan.status === "FAILED"
                                ? "bg-red-100 text-red-800"
                                : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {scan.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="py-2 text-right text-slate-600">
                      {scan.pagesScanned}
                      {scan.totalPages > 0 ? ` / ${scan.totalPages}` : ""}
                    </td>
                    <td className="py-2 text-right text-slate-600">
                      {scan.violationsFound}
                    </td>
                    <td className="py-2 text-left text-slate-600 text-xs">
                      {proofSnapshot ? (
                        <span>
                          {proofSnapshot.complete} complete · {proofSnapshot.incomplete} incomplete
                          {proofSnapshot.regressed > 0
                            ? ` · ${proofSnapshot.regressed} regressed`
                            : ""}
                        </span>
                      ) : (
                        <span className="text-slate-400">No linked finding lineage yet</span>
                      )}
                    </td>
                    <td className="py-2 text-right text-slate-600">
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
                    <td className="py-2 text-right text-slate-500">
                      {scan.startedAt?.toLocaleString() ?? "-"}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Open Findings */}
      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Open Findings
          <Link
            href={`/findings?siteId=${siteId}`}
            className="text-sm font-normal text-brand-600 ml-3"
          >
            View all
          </Link>
        </h2>
        {findings.length === 0 ? (
          <p className="text-sm text-slate-500">
            No open findings. Queue a verification scan (or wait for one after
            crawl) to discover issues.
          </p>
        ) : (
          <ul className="space-y-2" role="list">
            {findings.slice(0, 10).map((finding) => (
              <li
                key={finding.id}
                className="flex items-center justify-between py-2 border-b border-slate-100"
              >
                <div>
                  <span className="mr-2 inline-block align-middle">
                    <SeverityChip severity={finding.impact} size="sm" />
                  </span>
                  <span className="text-sm text-slate-900">
                    {finding.description}
                  </span>
                </div>
                <span className="text-xs text-slate-500">
                  {finding.occurrenceCount} occurrences
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
  return (
    <div className="min-w-[5.5rem]">
      <SeverityChip severity={severity} size="sm" />
      <p
        className="mt-2 text-2xl font-bold tabular-nums text-slate-900"
        aria-label={`${label}: ${count} open`}
      >
        {count}
      </p>
      <p className="text-sm text-slate-500">{label} open</p>
    </div>
  );
}
