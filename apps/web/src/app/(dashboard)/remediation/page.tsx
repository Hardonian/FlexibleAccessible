import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import {
  resolveDashboardOrgMembership,
  runOrgScopedQuery,
} from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { hasPermission } from "@aros/config";
import { StatusBadge } from "@aros/ui";

export const metadata = { title: "Remediation" };

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
        <h1 className="text-2xl font-bold text-slate-900">
          Remediation Suggestions
        </h1>
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
        <h1 className="text-2xl font-bold text-slate-900">
          Remediation Suggestions
        </h1>
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
        <h1 className="text-2xl font-bold text-slate-900">
          Remediation Suggestions
        </h1>
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
        <h1 className="text-2xl font-bold text-slate-900">
          Remediation Suggestions
        </h1>
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
        <h1 className="text-2xl font-bold text-slate-900">
          Remediation Suggestions
        </h1>
        <p className="text-slate-500 mt-1">
          AI-generated fix suggestions. Review before applying.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        All suggestions are AI-generated drafts and require human review before export or application.
        Source-first means fixing the actual broken element — not adding an overlay.
        Automated analysis cannot guarantee full WCAG conformance; expert manual audit may still be required.
      </div>

      {suggestions.length === 0 ? (
        <div className="card py-10 px-6">
          <div className="mx-auto max-w-md text-center">
            <h3 className="text-base font-semibold text-slate-900">No remediation suggestions yet</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Source-first remediation suggestions are AI-drafted code fixes generated from your findings.
              Each suggestion targets the actual broken element — not an overlay workaround — and must be reviewed by a human before it is safe to apply.
            </p>
            <div className="mt-6 flex flex-col items-center gap-2">
              <Link href="/sites" className="btn-primary text-sm">
                Go to sites and run a scan
              </Link>
              <p className="text-xs text-slate-400">
                After a scan completes, open any finding to generate a suggestion.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <Link
              key={s.id}
              href={`/remediation/${s.id}`}
              className="card hover:shadow-md transition-shadow block"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge bg-blue-100 text-blue-800">
                      {s.type.toLowerCase().replace("_", " ")}
                    </span>
                    <StatusBadge status={s.status} />
                    {s.cluster && (
                      <span className="text-xs text-purple-600">
                        {s.cluster.name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-slate-900">
                    {s.finding?.description ?? s.rationale.slice(0, 100)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                    {s.rationale}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">
                    {Math.round(s.confidence * 100)}%
                  </p>
                  <p className="text-xs text-slate-500">confidence</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
