import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { resolveDashboardOrgMembership } from "@/lib/route-data-boundary";
import { RouteReliabilityNotice } from "@/components/reliability/route-reliability-notice";
import { hasPermission } from "@aros/config";
import {
  GitPullRequest,
  MessageSquare,
  Webhook,
  CheckCircle2,
  ExternalLink,
  Plus,
  Trash2,
  Power,
  ShieldCheck,
  ArrowLeft,
  Terminal,
} from "lucide-react";
import {
  createIntegrationAction,
  toggleIntegrationAction,
  deleteIntegrationAction,
  createDeployWebhookAction,
} from "./actions";

export const metadata = { title: "Integrations & DevOps Hub" };

export default async function IntegrationsPage() {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind !== "ok") {
    return (
      <div className="space-y-6 max-w-5xl">
        <h1 className="text-2xl font-bold text-slate-900">Integrations</h1>
        <RouteReliabilityNotice variant="error" title="Access Error">
          <p>You must be in an active organization to manage integrations.</p>
        </RouteReliabilityNotice>
      </div>
    );
  }

  const canEdit = hasPermission(orgRes.role, "integrations:manage");

  const [connections, webhooks, sites] = await Promise.all([
    prisma.integrationConnection.findMany({
      where: { organizationId: orgRes.organizationId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.deployWebhook.findMany({
      where: { organizationId: orgRes.organizationId },
      include: { site: { select: { id: true, name: true, domain: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.site.findMany({
      where: { workspace: { organizationId: orgRes.organizationId } },
      select: { id: true, name: true, domain: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-8 max-w-5xl pb-16">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-slate-500 mb-1">
            <Link href="/settings" className="hover:text-brand-600 flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" /> Settings
            </Link>
            <span>/</span>
            <span className="text-slate-900 font-medium">Integrations</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">DevOps &amp; Integrations Hub</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Connect CI/CD pipelines, issue trackers, and collaboration channels to automate verification and remediation.
          </p>
        </div>
      </div>

      {/* Integration Providers Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* GitHub App & Actions */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                <GitPullRequest className="h-5 w-5" />
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" /> Native CI/CD
              </span>
            </div>
            <h2 className="mt-3 text-sm font-bold text-slate-900">GitHub Actions &amp; App</h2>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Block accessibility regressions directly on pull requests. Scans code branches before production release.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Official Action</span>
            <a
              href="https://github.com/marketplace/actions/aros-accessibility-gate"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-brand-600 font-semibold hover:text-brand-700"
            >
              Action Docs <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>

        {/* Slack / Teams */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#4A154B] text-white">
                <MessageSquare className="h-5 w-5" />
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">
                Webhook Ready
              </span>
            </div>
            <h2 className="mt-3 text-sm font-bold text-slate-900">Slack &amp; Teams Alerts</h2>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Receive notifications when critical accessibility regressions occur or when automated verifications pass.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">Incoming Webhooks</span>
            <span className="text-slate-400 font-mono">#accessibility</span>
          </div>
        </div>

        {/* Self-Healing Deploy Webhooks */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-600 text-white">
                <Webhook className="h-5 w-5" />
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                Automated
              </span>
            </div>
            <h2 className="mt-3 text-sm font-bold text-slate-900">Deploy Webhooks (Vercel/Netlify)</h2>
            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
              Trigger post-deploy site scans whenever your team pushes to production. Instant verification of new code.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">HMAC-SHA256 verified</span>
            <span className="text-teal-700 font-semibold">Active</span>
          </div>
        </div>
      </div>

      {/* Connected Services List */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Active Integrations</h2>
            <p className="text-xs text-slate-500">
              Configured communication, repository, and issue-tracker bridges.
            </p>
          </div>
          {canEdit && (
            <details className="group relative">
              <summary className="btn-primary list-none cursor-pointer inline-flex items-center gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Add Connection
              </summary>
              <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl z-20">
                <form action={createIntegrationAction} className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    New Integration
                  </h3>
                  <div>
                    <label className="text-[11px] font-medium text-slate-700 block mb-1">Type</label>
                    <select name="type" className="input text-xs">
                      <option value="GITHUB">GitHub</option>
                      <option value="SLACK">Slack Webhook</option>
                      <option value="JIRA">Jira Software</option>
                      <option value="WEBHOOK">Generic Webhook</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-700 block mb-1">Name</label>
                    <input
                      name="name"
                      type="text"
                      placeholder="e.g. #eng-accessibility"
                      required
                      className="input text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-700 block mb-1">Endpoint URL (Optional)</label>
                    <input
                      name="targetUrl"
                      type="url"
                      placeholder="https://hooks.slack.com/services/..."
                      className="input text-xs"
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <button type="submit" className="btn-primary text-xs py-1 min-h-[32px]">
                      Save Integration
                    </button>
                  </div>
                </form>
              </div>
            </details>
          )}
        </div>

        {connections.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
            No integration connections configured yet. Connect Slack or GitHub above to automate your workflow.
          </div>
        ) : (
          <div className="space-y-3">
            {connections.map((conn) => (
              <div
                key={conn.id}
                className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 p-4 transition-all hover:bg-slate-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-700 shadow-xs">
                    {conn.type === "SLACK" ? (
                      <MessageSquare className="h-4 w-4 text-[#4A154B]" />
                    ) : conn.type === "GITHUB" ? (
                      <GitPullRequest className="h-4 w-4 text-slate-900" />
                    ) : (
                      <Webhook className="h-4 w-4 text-teal-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{conn.name}</span>
                      <span className="badge font-mono text-[10px] bg-white border border-slate-200">
                        {conn.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Added {new Date(conn.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <form action={toggleIntegrationAction}>
                    <input type="hidden" name="id" value={conn.id} />
                    <button
                      type="submit"
                      disabled={!canEdit}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
                        conn.isActive
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                          : "bg-slate-200 text-slate-600 hover:bg-slate-300"
                      }`}
                    >
                      <Power className="h-3 w-3" />
                      {conn.isActive ? "Active" : "Disabled"}
                    </button>
                  </form>

                  {canEdit && (
                    <form action={deleteIntegrationAction}>
                      <input type="hidden" name="id" value={conn.id} />
                      <button
                        type="submit"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        aria-label="Delete integration"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deploy Webhooks Section */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Self-Healing Deploy Webhooks</h2>
            <p className="text-xs text-slate-500">
              Incoming webhooks that automatically trigger accessibility scans when deployments succeed.
            </p>
          </div>
          {canEdit && sites.length > 0 && (
            <details className="group relative">
              <summary className="btn-secondary list-none cursor-pointer inline-flex items-center gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Register Webhook
              </summary>
              <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl z-20">
                <form action={createDeployWebhookAction} className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    New Deploy Webhook
                  </h3>
                  <div>
                    <label className="text-[11px] font-medium text-slate-700 block mb-1">Target Site</label>
                    <select name="siteId" className="input text-xs" required>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.domain})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-700 block mb-1">Deployment Provider</label>
                    <select name="source" className="input text-xs" required>
                      <option value="VERCEL">Vercel Deployment</option>
                      <option value="NETLIFY">Netlify Build Hook</option>
                      <option value="GITHUB_DEPLOY">GitHub Deployment Status</option>
                      <option value="CUSTOM">Custom CI/CD Pipeline</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-700 block mb-1">Branches (comma-separated, optional)</label>
                    <input
                      name="branches"
                      type="text"
                      placeholder="main, production"
                      className="input text-xs"
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <button type="submit" className="btn-primary text-xs py-1 min-h-[32px]">
                      Generate Secret &amp; Webhook
                    </button>
                  </div>
                </form>
              </div>
            </details>
          )}
        </div>

        {webhooks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center text-xs text-slate-500">
            No deploy webhooks registered yet. Add one to enable zero-configuration automated verification on release.
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">{wh.site.name}</span>
                    <span className="badge font-mono text-[10px] bg-white border border-slate-200">
                      {wh.source}
                    </span>
                    <span className="text-slate-400 font-mono text-[11px]">{wh.site.domain}</span>
                  </div>
                  <span className={`badge text-[10px] font-semibold ${wh.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`}>
                    {wh.isActive ? "Active" : "Inactive"}
                  </span>
                </div>

                <div className="mt-2 rounded bg-slate-900 p-2 text-[11px] font-mono text-slate-300 flex items-center justify-between">
                  <span className="truncate">Webhook Secret: {wh.secret.slice(0, 16)}••••••••</span>
                  <span className="text-[10px] text-slate-400 shrink-0">HMAC-SHA256</span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>Branches: {wh.branches.length > 0 ? wh.branches.join(", ") : "All branches"}</span>
                  <span>Endpoint: <code className="text-slate-700 font-mono">/api/deploy-webhook</code></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* GitHub Action Snippet */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-slate-600" />
          <h2 className="text-sm font-bold text-slate-900">GitHub Actions CI/CD Integration Workflow</h2>
        </div>
        <p className="text-xs text-slate-500">
          Copy this workflow into <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-800">.github/workflows/accessibility.yml</code> in your repositories to verify pull requests before merge:
        </p>
        <pre className="rounded-xl bg-slate-900 p-4 text-xs text-slate-200 font-mono overflow-x-auto leading-relaxed">
{`name: Accessibility Verification Gate
on:
  pull_request:
    branches: [main, master]

jobs:
  accessibility:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: AROS Accessibility Conformance Gate
        uses: aros-os/action@v1
        with:
          api-key: \${{ secrets.AROS_API_KEY }}
          site-domain: 'https://example.com'
          fail-on-severity: 'CRITICAL'`}
        </pre>
      </div>
    </div>
  );
}
