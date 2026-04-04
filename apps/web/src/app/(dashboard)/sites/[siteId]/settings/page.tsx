import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { hasPermission } from "@aros/config";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { AutoScanAfterCrawlForm } from "./auto-scan-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  // Note: metadata generation cannot use user context, so we keep basic query
  // The page component will enforce org scoping
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    select: { name: true },
  });
  return {
    title: site ? `${site.name} settings` : "Site settings",
  };
}

export default async function SiteSettingsPage({
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
        <h1 className="text-2xl font-bold text-slate-900">Site Settings</h1>
        <RouteReliabilityNotice
          variant="error"
          title="Site settings require a working database"
        >
          <p>
            Site configuration cannot be loaded until core data services are
            healthy.
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-900">Site Settings</h1>
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
        <h1 className="text-2xl font-bold text-slate-900">Site Settings</h1>
        <RouteReliabilityNotice
          variant="info"
          title="No organization membership"
        >
          <p>You need an organization to manage sites.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const siteResult = await runOrgScopedQuery(orgRes, async (organizationId) => {
    return prisma.site.findFirst({
      where: { id: siteId, workspace: { organizationId } },
      include: {
        crawlConfig: true,
        workspace: { select: { id: true } },
      },
    });
  });

  if (!siteResult.ok || !siteResult.data) {
    notFound();
  }

  const site = siteResult.data;
  if (!hasPermission(orgRes.role, "site:manage")) {
    notFound();
  }

  const autoScanAfterCrawl = site.crawlConfig?.autoScanAfterCrawl !== false;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
          <Link href="/sites" className="hover:text-brand-600">
            Sites
          </Link>
          <span>/</span>
          <Link href={`/sites/${siteId}`} className="hover:text-brand-600">
            {site.name}
          </Link>
          <span>/</span>
          <span>Settings</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          Crawl &amp; verification
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Controls how this site is crawled and what happens next.
        </p>
      </div>

      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">After crawl</h2>
        <AutoScanAfterCrawlForm
          siteId={siteId}
          initialEnabled={autoScanAfterCrawl}
        />
      </div>
    </div>
  );
}
