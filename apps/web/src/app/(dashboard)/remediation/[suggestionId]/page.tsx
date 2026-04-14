import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import {
  approveSuggestionAction,
  rejectSuggestionAction,
  exportSnippetAction,
} from "./actions";
import { StatusBadge } from "@aros/ui";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { hasPermission } from "@aros/config";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { resolveDashboardOrgMembership } from "@/lib/route-data-boundary";
import { sanitizeAiCode } from "@/lib/sanitizer";
import { AiUpsell } from "@/components/monetization/ai-upsell";
import { PageHeader } from "@/components/layout/page-header";
import { pageTitle } from "@/lib/product-brand";

export const metadata = { title: pageTitle("Remediation Suggestion") };

export default async function SuggestionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ suggestionId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { suggestionId } = await params;
  const sp = await searchParams;
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind !== "ok") {
    return (
      <div className="space-y-6">
        <PageHeader title="Remediation suggestion" />
        <RouteReliabilityNotice variant="error" title="Cannot load suggestion">
          <p>Organization context unavailable.</p>
        </RouteReliabilityNotice>
        <Link href="/remediation" className="btn-secondary text-sm">
          Back to remediation
        </Link>
      </div>
    );
  }

  const suggestion = await prisma.remediationSuggestion.findFirst({
    where: {
      id: suggestionId,
      OR: [
        {
          finding: {
            occurrences: {
              some: {
                page: {
                  site: {
                    workspace: { organizationId: orgRes.organizationId },
                  },
                },
              },
            },
          },
        },
        {
          cluster: {
            site: { workspace: { organizationId: orgRes.organizationId } },
          },
        },
      ],
    },
    include: {
      reviewTask: true,
      recipe: true,
      finding: {
        include: {
          occurrences: {
            take: 1,
            include: {
              page: {
                include: { site: true },
              },
            },
          },
          _count: { select: { occurrences: true } },
        },
      },
      cluster: {
        include: {
          site: true,
        },
      },
    },
  });

  if (!suggestion) notFound();

  const canApprove = hasPermission(orgRes.role, "suggestion:approve");
  const canExport = hasPermission(orgRes.role, "suggestion:export");

  const errorMessage = sp.error
    ? ({
        forbidden: "You do not have permission for that action.",
        invalid_transition: "That action is not valid from the current status.",
        update_failed: "Update failed. Please try again.",
        stale_session:
          "Your organization context changed. Refresh the page and try again.",
      }[sp.error] ?? "An error occurred.")
    : null;

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: orgRes.organizationId },
  });

  const occurrence = suggestion.finding?.occurrences[0];
  const page = occurrence?.page;
  const site = page?.site || suggestion.cluster?.site;

  if (!site) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div>
        <nav className="flex items-center gap-2 text-sm text-slate-500 mb-2" aria-label="Breadcrumb">
          <Link
            href="/remediation"
            className="hover:text-brand-600 focus-visible:outline-brand-600 rounded transition-colors"
          >
            Remediation
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-slate-900 font-medium truncate max-w-xs">Suggestion</span>
        </nav>
        <PageHeader title="Remediation suggestion" />
      </div>

      {errorMessage && (
        <RouteReliabilityNotice variant="error" title="Action not applied">
          <p>{errorMessage}</p>
        </RouteReliabilityNotice>
      )}

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="badge bg-blue-100 text-blue-800">
              {suggestion.type.toLowerCase().replace("_", " ")}
            </span>
            <StatusBadge status={suggestion.status} />
          </div>
          <p className="text-sm text-slate-500">
            Confidence:{" "}
            <strong>{Math.round(suggestion.confidence * 100)}%</strong>
          </p>
        </div>

        <h2 className="text-sm font-medium text-slate-500 mb-2">Rationale</h2>
        <p className="text-sm text-slate-700">{suggestion.rationale}</p>

        {suggestion.finding && (
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-xs text-slate-500">Related finding:</p>
            <Link
              href={`/findings/${suggestion.finding.id}`}
              className="text-sm text-brand-600 hover:underline"
            >
              {suggestion.finding.description}
            </Link>
            <span className="text-xs text-slate-400 ml-2">
              ({suggestion.finding._count.occurrences} occurrences)
            </span>
          </div>
        )}

        {suggestion.cluster && (
          <div className="mt-3 pt-3 border-t border-slate-200">
            <p className="text-xs text-slate-500">Component cluster:</p>
            <Link
              href={`/clusters/${suggestion.cluster.id}`}
              className="text-sm text-brand-600 hover:underline"
            >
              {suggestion.cluster.name}
            </Link>
            <span className="text-xs text-slate-400 ml-2">
              ({suggestion.cluster.pageCount} pages)
            </span>
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">
          Code Changes
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h3 className="text-sm font-medium text-red-700 mb-2">
              Original Code
            </h3>
            <pre className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm overflow-x-auto max-h-[400px] whitespace-pre-wrap">
              <code>{suggestion.originalCode}</code>
            </pre>
          </div>
          <div>
            <h3 className="text-sm font-medium text-green-700 mb-2">
              Suggested Fix
            </h3>
            <pre className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm overflow-x-auto max-h-[400px] whitespace-pre-wrap">
              <code>{sanitizeAiCode(suggestion.suggestedCode)}</code>
            </pre>
          </div>
        </div>
      </div>

      {suggestion.validationResult && (
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            Validation Result
          </h2>
          <pre className="bg-slate-50 rounded-lg p-3 text-sm overflow-x-auto">
            {JSON.stringify(suggestion.validationResult, null, 2)}
          </pre>
        </div>
      )}

      {suggestion.recipe && (
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">
            Linked Recipe
          </h2>
          <p className="text-sm text-slate-700 mb-2">
            {suggestion.recipe.title}
          </p>
          <p className="text-sm text-slate-600 mb-4">
            {suggestion.recipe.strategy}
          </p>
          <div className="grid gap-4 lg:grid-cols-2 text-sm">
            <div>
              <p className="font-medium text-slate-900 mb-2">
                Verification steps
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                {suggestion.recipe.verificationSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-medium text-slate-900 mb-2">Risk notes</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700">
                {suggestion.recipe.riskNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {(() => {
        if (!subscription?.aiEnabled) {
          return <AiUpsell reason={subscription ? "tier_limit" : "disabled"} />;
        }

        // Final gate for approval
        if (!(canApprove || canExport)) return null;

        return (
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">
              Actions
            </h2>
            <div className="flex flex-wrap gap-3">
              {canApprove &&
                (suggestion.status === "DRAFT" ||
                  suggestion.status === "VALIDATED") && (
                  <form action={approveSuggestionAction}>
                    <input
                      type="hidden"
                      name="expectedOrganizationId"
                      value={orgRes.organizationId}
                    />
                    <input
                      type="hidden"
                      name="suggestionId"
                      value={suggestionId}
                    />
                    <button type="submit" className="btn-primary">
                      Approve Suggestion
                    </button>
                  </form>
                )}

              {canApprove &&
                suggestion.status !== "REJECTED" &&
                suggestion.status !== "APPLIED" && (
                  <form action={rejectSuggestionAction}>
                    <input
                      type="hidden"
                      name="expectedOrganizationId"
                      value={orgRes.organizationId}
                    />
                    <input
                      type="hidden"
                      name="suggestionId"
                      value={suggestionId}
                    />
                    <button type="submit" className="btn-danger">
                      Reject
                    </button>
                  </form>
                )}

              {canExport &&
                (suggestion.status === "APPROVED" ||
                  suggestion.status === "VALIDATED") && (
                  <form action={exportSnippetAction}>
                    <input
                      type="hidden"
                      name="expectedOrganizationId"
                      value={orgRes.organizationId}
                    />
                    <input
                      type="hidden"
                      name="suggestionId"
                      value={suggestionId}
                    />
                    <button type="submit" className="btn-secondary">
                      Export as Snippet
                    </button>
                  </form>
                )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
