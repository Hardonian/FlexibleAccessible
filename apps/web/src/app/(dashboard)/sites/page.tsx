import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Globe } from "lucide-react";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { hasPermission } from "@aros/config";
import { EmptyState } from "@aros/ui";
import { PageHeader } from "@/components/layout/page-header";
import { pageTitle } from "@/lib/product-brand";
import {
  rollupSiteOperations,
  summarizeSiteOperations,
  type SiteOperationalStatus,
} from "@/lib/site-operations";
import { getEntitlementState } from "@/lib/auth-guard";
import { startCrawlAction } from "./[siteId]/actions";
import { scanSiteInitialState } from "./[siteId]/scan-action-state";
import { startSiteScanAction } from "./[siteId]/scan-actions";
import { ScanNowButton } from "./[siteId]/scan-now-button";
import { computeScanDelta } from "@/lib/scan-delta";

export const metadata = { title: pageTitle("Sites") };

export default async function SitesPage() {
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
        <h1 className="text-2xl font-bold text-slate-900">Sites</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Sites require a working database"
          showSystemLink={canViewSystem}
        >
          <p>
            Site data cannot be loaded until core data services are healthy.
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Sites</h1>
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
        <h1 className="text-2xl font-bold text-slate-900">Sites</h1>
        <RouteReliabilityNotice
          variant="info"
          title="No organization membership"
        >
          <p>You need an organization to manage sites.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const sitesResult = await runOrgScopedQuery(orgRes, async (orgId) => {
    const [sites, openFindingCounts, subscription] = await Promise.all([
      prisma.site.findMany({
        where: { workspace: { organizationId: orgId } },
        include: {
          workspace: { select: { name: true } },
          crawlConfig: { select: { scheduleCron: true } },
          scanRuns: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, status: true, completedAt: true, createdAt: true },
          },
          crawlRuns: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { status: true },
          },
          _count: {
            select: {
              crawlRuns: true,
              pages: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.canonicalFinding.groupBy({
        by: ["siteId"],
        where: {
          site: { workspace: { organizationId: orgId } },
          status: "OPEN",
        },
        _count: { _all: true },
      }),
      prisma.subscription.findUnique({
        where: { organizationId: orgId },
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
      }),
    ]);

    return { sites, openFindingCounts, subscription };
  });

  if (!sitesResult.ok) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Sites</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Could not load sites"
          showSystemLink={canViewSystem}
        >
          <p>{sitesResult.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const { sites, openFindingCounts, subscription } = sitesResult.data;
  const openFindingsBySiteId = new Map(
    openFindingCounts.map((row) => [row.siteId, row._count._all]),
  );
  const entitlement = getEntitlementState(subscription);

  const completedScanRunIds = sites.flatMap((site) =>
    site.scanRuns.filter((run) => run.status === "COMPLETED").slice(0, 2).map((run) => run.id),
  );

  const runFingerprints =
    completedScanRunIds.length > 0
      ? await prisma.rawViolation.findMany({
          where: { scanRunId: { in: completedScanRunIds } },
          select: { scanRunId: true, fingerprint: true },
          distinct: ["scanRunId", "fingerprint"],
        })
      : [];

  const fingerprintsByRunId = new Map<string, string[]>();
  for (const row of runFingerprints) {
    const bucket = fingerprintsByRunId.get(row.scanRunId) ?? [];
    bucket.push(row.fingerprint);
    fingerprintsByRunId.set(row.scanRunId, bucket);
  }

  const operationalSites = sites.map((site) => {
    const latestScan = site.scanRuns[0] ?? null;
    const latestCompleted = site.scanRuns.find((run) => run.status === "COMPLETED") ?? null;
    const priorCompleted = site.scanRuns
      .filter((run) => run.status === "COMPLETED")
      .slice(1, 2)[0] ?? null;

    const ops = summarizeSiteOperations({
      pagesCount: site._count.pages,
      openFindings: openFindingsBySiteId.get(site.id) ?? 0,
      latestCrawlStatus: site.crawlRuns[0]?.status ?? null,
      latestScanStatus: latestScan?.status ?? null,
      latestScanCompletedAt: latestCompleted?.completedAt ?? null,
      scheduleCron: site.crawlConfig?.scheduleCron ?? null,
      entitlement,
      workerRunning: platformTruth.flags.workerRunning,
      jobPipelinesHealthy: platformTruth.flags.jobPipelinesHealthy,
    });

    const delta = latestCompleted
      ? computeScanDelta(
          fingerprintsByRunId.get(latestCompleted.id) ?? [],
          priorCompleted ? (fingerprintsByRunId.get(priorCompleted.id) ?? []) : null,
        )
      : {
          comparable: false,
          newCount: 0,
          resolvedCount: 0,
          persistingCount: 0,
        };

    const scanBlocked = latestScan?.status === "PENDING" || latestScan?.status === "RUNNING";

    return {
      ...site,
      openFindings: openFindingsBySiteId.get(site.id) ?? 0,
      ops,
      delta,
      scanBlocked,
    };
  });

  const opsRollup = rollupSiteOperations(
    operationalSites.map((site) => site.ops.status),
  );

  const deltaRollup = operationalSites.reduce(
    (acc, site) => {
      acc.newCount += site.delta.newCount;
      acc.resolvedCount += site.delta.resolvedCount;
      acc.persistingCount += site.delta.persistingCount;
      if (site.delta.comparable) acc.comparableSites += 1;
      return acc;
    },
    { newCount: 0, resolvedCount: 0, persistingCount: 0, comparableSites: 0 },
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sites"
        description="Targets you crawl and verify. Add production and staging separately when they differ."
      >
        <Link href="/sites/new" className="btn-primary w-full sm:w-auto">
          Add site
        </Link>
      </PageHeader>

      {sites.length === 0 ? (
        <EmptyState
          icon={Globe}
          title="No sites yet"
          description="Add your first website to start scanning for accessibility issues."
          action={
            <Link href="/sites/new" className="btn-primary">
              Add Your First Site
            </Link>
          }
          className="card"
        />
      ) : (
        <>
          <section className="card" aria-labelledby="ops-worklist-heading">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 id="ops-worklist-heading" className="section-heading">
                Operator worklist
              </h2>
              <span className="text-xs text-slate-500">
                Deterministic site health derived from crawl/scan freshness and platform readiness.
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <OpsMetric label="Needs activation" value={opsRollup.activationRequired} />
              <OpsMetric label="Scan failures" value={opsRollup.scanAttentionRequired} />
              <OpsMetric label="Automation degraded" value={opsRollup.automationDegraded} />
              <OpsMetric label="Evidence stale" value={opsRollup.evidenceStale} />
              <OpsMetric label="Healthy" value={opsRollup.healthy} />
            </dl>
          </section>

          <section className="card" aria-labelledby="scan-delta-heading">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <h2 id="scan-delta-heading" className="section-heading">Changed since last completed scan</h2>
              <p className="text-xs text-slate-500">
                Comparable sites: {deltaRollup.comparableSites}/{operationalSites.length}
              </p>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <OpsMetric label="New violations" value={deltaRollup.newCount} />
              <OpsMetric label="Resolved" value={deltaRollup.resolvedCount} />
              <OpsMetric label="Persisting" value={deltaRollup.persistingCount} />
            </div>
          </section>

          <div className="grid gap-4">
            {operationalSites.map((site) => (
              <article key={site.id} className="card space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      <Link href={`/sites/${site.id}`} className="hover:underline">
                        {site.name}
                      </Link>
                    </h3>
                    <p className="text-sm text-slate-500 mt-0.5">{site.domain}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <EnvironmentBadge environment={site.environment} />
                      <span>{site.workspace.name}</span>
                    </div>
                  </div>
                  <StatusPill status={site.ops.status} label={site.ops.statusLabel} />
                </div>

                <p className="text-sm text-slate-700">{site.ops.statusReason}</p>

                <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
                  <DetailItem label="Pages discovered" value={String(site._count.pages)} />
                  <DetailItem label="Open findings" value={String(site.openFindings)} />
                  <DetailItem label="Evidence freshness" value={site.ops.freshnessLabel} />
                  <DetailItem label="Automation cadence" value={`${site.ops.cadenceLabel} · ${site.ops.nextScheduledRunLabel}`} />
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700" role="status">
                  {site.delta.comparable ? (
                    <p>
                      Δ since previous completed scan: <span className="font-semibold text-rose-800">+{site.delta.newCount} new</span>,{" "}
                      <span className="font-semibold text-emerald-800">-{site.delta.resolvedCount} resolved</span>,{" "}
                      <span className="font-semibold text-slate-900">{site.delta.persistingCount} persisting</span>
                    </p>
                  ) : (
                    <p>Δ since previous completed scan: baseline not available yet (need two completed scans).</p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link href={`/sites/${site.id}`} className="btn-secondary text-sm">
                    Open site
                  </Link>
                  <form action={startCrawlAction}>
                    <input type="hidden" name="siteId" value={site.id} />
                    <button type="submit" className="btn-secondary text-sm">Start crawl</button>
                  </form>
                  <div className="[&_button]:text-sm">
                    <ScanNowButton
                      action={startSiteScanAction}
                      initialState={scanSiteInitialState}
                      siteId={site.id}
                      disabled={site._count.pages === 0 || site.scanBlocked}
                      blockedHint={
                        site.scanBlocked
                          ? "Verification is already queued or running for this site."
                          : site._count.pages === 0
                            ? "Run a crawl first so there are pages to verify."
                            : null
                      }
                    />
                  </div>
                  <Link href={site.ops.nextAction.href as any} className="btn-primary text-sm">
                    {site.ops.nextAction.label}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OpsMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-slate-900 tabular-nums">{value}</dd>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="font-medium text-slate-900">{label}:</span> {value}
    </p>
  );
}

function StatusPill({ status, label }: { status: SiteOperationalStatus; label: string }) {
  const toneByStatus: Record<SiteOperationalStatus, string> = {
    activation_required: "bg-sky-50 text-sky-800 ring-sky-200",
    scan_attention_required: "bg-rose-50 text-rose-800 ring-rose-200",
    automation_degraded: "bg-amber-50 text-amber-800 ring-amber-200",
    evidence_stale: "bg-violet-50 text-violet-800 ring-violet-200",
    healthy: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  };

  return (
    <span className={`badge ring-1 ring-inset ${toneByStatus[status]}`}>{label}</span>
  );
}

function EnvironmentBadge({ environment }: { environment: string }) {
  const config: Record<string, { label: string; className: string }> = {
    PRODUCTION: {
      label: "Production",
      className: "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-200",
    },
    STAGING: {
      label: "Staging",
      className: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200",
    },
    DEVELOPMENT: {
      label: "Development",
      className: "bg-sky-50 text-sky-900 ring-1 ring-inset ring-sky-200",
    },
  };
  const { label, className } = config[environment] ?? {
    label: environment,
    className: "bg-slate-100 text-slate-600",
  };
  return <span className={`badge text-xs ${className}`}>{label}</span>;
}
