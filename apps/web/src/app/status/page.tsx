import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";
import { prisma } from "@/lib/db";
import {
  collectPlatformHealth,
  toPublicHealthSummary,
} from "@aros/core-services";

export const dynamic = "force-dynamic";

export const metadata: Metadata = marketingSurfaceMetadata(
  "Status",
  `Live readiness summary for this ${PRODUCT_DISPLAY_NAME} deployment (same signals as /api/health?detailed=true).`,
  "/status",
);

export default async function StatusPage() {
  let summary: ReturnType<typeof toPublicHealthSummary> | null = null;
  let error: string | null = null;
  try {
    const report = await collectPlatformHealth(prisma);
    summary = toPublicHealthSummary(report);
  } catch (e) {
    error = e instanceof Error ? e.message : "Health collection failed";
  }

  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md">
        <p className="text-sm font-medium text-brand-700">Status</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Service status
        </h1>
        <p className="mt-4 text-slate-600">
          This page reflects the same automated checks as{" "}
          <Link href="/api/health?detailed=true" className="font-medium text-brand-700 hover:underline">
            the detailed health JSON endpoint
          </Link>
          . It is not a third-party status vendor; operators may still publish an external page for customers.
        </p>

        {error ? (
          <div
            className="mt-8 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"
            role="alert"
          >
            <p className="font-medium">Could not load status</p>
            <p className="mt-1">{error}</p>
          </div>
        ) : summary ? (
          <dl className="mt-10 space-y-4 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-elevated))] p-6 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="font-medium text-slate-800">Overall</dt>
              <dd className={summary.ready ? "text-emerald-800 font-medium" : "text-amber-900 font-medium"}>
                {summary.ready ? "Operational" : "Degraded or blocked"}
              </dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-slate-600">Checked at</dt>
              <dd className="font-mono text-xs text-slate-700">{summary.checkedAt}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-2">
              <dt className="text-slate-600">Readiness</dt>
              <dd className="font-mono text-xs text-slate-700">{summary.readiness}</dd>
            </div>
            <div className="border-t border-[rgb(var(--color-border))] pt-4 space-y-2">
              <p className="font-medium text-slate-800">Checks</p>
              <ul className="grid gap-2 sm:grid-cols-2">
                <CheckRow label="Database" ok={summary.checks.database} />
                <CheckRow label="Redis" ok={summary.checks.redis} />
                <CheckRow label="Session store" ok={summary.checks.session} />
                <CheckRow label="Outbound email config" ok={summary.checks.outboundEmail} />
                <CheckRow label="Workers" ok={summary.checks.worker} />
                <CheckRow label="Job pipelines" ok={summary.checks.jobPipelines} />
              </ul>
            </div>
            <div className="border-t border-[rgb(var(--color-border))] pt-4">
              <dt className="text-slate-600">Abuse rate limiting</dt>
              <dd className="mt-1 text-slate-800">{summary.checks.abuseRateLimiting}</dd>
            </div>
          </dl>
        ) : null}

        <p className="mt-8 text-sm text-slate-500">
          For account-specific issues, contact{" "}
          <Link href="/support" className="font-medium text-brand-700 hover:underline">
            support
          </Link>
          .
        </p>
      </div>
    </MarketingSiteChrome>
  );
}

function CheckRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-white px-3 py-2">
      <span className="text-slate-700">{label}</span>
      <span className={ok ? "text-emerald-700 font-medium" : "text-red-700 font-medium"}>
        {ok ? "OK" : "Issue"}
      </span>
    </li>
  );
}
