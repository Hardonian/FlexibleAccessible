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
        githubRepoMapping: true,
        deployWebhooks: true,
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
  const scheduleCron = site.crawlConfig?.scheduleCron ?? null;
  const githubMapping = site.githubRepoMapping as {
    repoOwner: string;
    repoName: string;
    defaultBranch: string;
    basePath: string;
  } | null;
  const webhooks = ((site as any).deployWebhooks ?? []) as {
    id: string;
    source: string;
    secret: string;
    isActive: boolean;
  }[];

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-16">
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
          Site Configuration &amp; DevOps
        </h1>
        <p className="text-slate-500 mt-1 text-sm">
          Controls automated scanning, GitHub repository mapping, and deploy webhooks.
        </p>
      </div>

      {/* Crawl & Automation */}
      <div className="card space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Crawl &amp; Verification Cadence</h2>
        <AutoScanAfterCrawlForm
          siteId={siteId}
          initialEnabled={autoScanAfterCrawl}
          initialScheduleCron={scheduleCron}
        />
      </div>

      {/* GitHub Repository Mapping */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">GitHub Repository Mapping</h2>
            <p className="text-xs text-slate-500">
              Link this site to a GitHub repository to automatically create issues with remediation recipes.
            </p>
          </div>
          {githubMapping && (
            <span className="badge bg-emerald-100 text-emerald-800 text-xs">
              Mapped
            </span>
          )}
        </div>

        <form action={async (formData) => {
          "use server";
          const { updateGitHubMappingAction } = await import("./actions");
          await updateGitHubMappingAction(formData);
        }} className="space-y-4 pt-2">
          <input type="hidden" name="siteId" value={siteId} />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Repository Owner / Org
              </label>
              <input
                name="repoOwner"
                type="text"
                placeholder="e.g. acme-corp"
                defaultValue={githubMapping?.repoOwner ?? ""}
                required
                className="input text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Repository Name
              </label>
              <input
                name="repoName"
                type="text"
                placeholder="e.g. web-storefront"
                defaultValue={githubMapping?.repoName ?? ""}
                required
                className="input text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Default Branch
              </label>
              <input
                name="defaultBranch"
                type="text"
                placeholder="main"
                defaultValue={githubMapping?.defaultBranch ?? "main"}
                className="input text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Base Path in Repo
              </label>
              <input
                name="basePath"
                type="text"
                placeholder="/"
                defaultValue={githubMapping?.basePath ?? "/"}
                className="input text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary text-xs">
              Save Repository Mapping
            </button>
          </div>
        </form>
      </div>

      {/* Deploy Webhooks */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Post-Deploy Webhooks</h2>
            <p className="text-xs text-slate-500">
              Triggers an automated accessibility scan whenever your CI/CD deploys to production.
            </p>
          </div>
          <Link href="/settings/integrations" className="btn-secondary text-xs">
            Manage Hub
          </Link>
        </div>

        {webhooks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
            No deploy webhooks configured for this site yet. Configure one in the DevOps Hub.
          </div>
        ) : (
          <div className="space-y-3 pt-2">
            {webhooks.map((wh) => (
              <div key={wh.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
                <div className="flex items-center justify-between font-medium text-slate-900">
                  <span>{wh.source}</span>
                  <span className="badge bg-emerald-100 text-emerald-800 text-[10px]">
                    {wh.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p className="font-mono text-[11px] text-slate-500 truncate">
                  Secret: {wh.secret.slice(0, 16)}••••••••
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
