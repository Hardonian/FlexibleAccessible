import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Wrench, ArrowRight } from "lucide-react";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { hasPermission } from "@aros/config";
import { EmptyState, StatusBadge, ConfidenceBar } from "@aros/ui";
import { PageHeader } from "@/components/layout/page-header";
import { pageTitle } from "@/lib/product-brand";

export const metadata = { title: pageTitle("Remediation") };

export default async function RemediationPage() {
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
        <PageHeader title="Remediation suggestions" />
        <RouteReliabilityNotice
          variant="error"
          title="Remediation data requires a working database"
          showSystemLink={canViewSystem}
        >
          <p>
            Suggestions cannot be loaded until core data services are healthy.
          </p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  if (orgRes.kind === "error") {
    return (
      <div className="space-y-6">
        <PageHeader title="Remediation suggestions" />
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
        <PageHeader title="Remediation suggestions" />
        <RouteReliabilityNotice
          variant="info"
          title="No organization membership"
        >
          <p>You need an organization to view remediation suggestions.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const suggestionsResult = await runOrgScopedQuery(orgRes, (orgId) =>
    prisma.remediationSuggestion.findMany({
      where: {
        OR: [
          {
            finding: {
              occurrences: {
                some: {
                  page: { site: { workspace: { organizationId: orgId } } },
                },
              },
            },
          },
          {
            cluster: { site: { workspace: { organizationId: orgId } } },
          },
        ],
      },
      orderBy: [{ status: "asc" }, { confidence: "desc" }],
      include: {
        finding: { select: { description: true, ruleId: true, impact: true } },
        cluster: { select: { name: true } },
      },
      take: 50,
    }),
  );

  if (!suggestionsResult.ok) {
    return (
      <div className="space-y-6">
        <PageHeader title="Remediation suggestions" />
        <RouteReliabilityNotice
          variant="error"
          title="Could not load suggestions"
          showSystemLink={canViewSystem}
        >
          <p>{suggestionsResult.message}</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const suggestions = suggestionsResult.data;

  return (
    <div className="space-y-6">
      <div>
        <PageHeader title="Remediation suggestions" />
        <p className="text-slate-500 mt-1">
          AI-generated fix suggestions. Review before applying.
        </p>
      </div>

      <RouteReliabilityNotice variant="warning" title="AI-generated drafts — review required">
        <p>
          All suggestions require human review before export or application.
          Source-first means fixing the actual broken element — not adding an overlay.
          Automated analysis cannot guarantee full WCAG conformance; expert manual audit may still be required.
        </p>
      </RouteReliabilityNotice>

      {suggestions.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No remediation suggestions yet"
          description="Source-first remediation suggestions are AI-drafted code fixes generated from your findings. Each targets the actual broken element — not an overlay — and must be reviewed before applying."
          action={
            <div className="flex flex-col items-center gap-2">
              <Link href="/sites" className="btn-primary">
                Go to sites and run a scan
              </Link>
              <p className="text-xs text-slate-400">After a scan, open any finding to generate a suggestion.</p>
            </div>
          }
        />
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => {
            return (
              <Link
                key={s.id}
                href={`/remediation/${s.id}`}
                className="group flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="badge bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200">
                      {s.type.toLowerCase().replace("_", " ")}
                    </span>
                    <StatusBadge status={s.status} />
                    {s.cluster && (
                      <span className="badge bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200">
                        {s.cluster.name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700 transition-colors line-clamp-1">
                    {s.finding?.description ?? s.rationale.slice(0, 100)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">{s.rationale}</p>
                </div>
                <div className="shrink-0 text-right space-y-1.5">
                  <ConfidenceBar value={s.confidence} />
                  <ArrowRight className="ml-auto h-4 w-4 text-slate-300 group-hover:text-brand-500 transition-colors" aria-hidden="true" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
