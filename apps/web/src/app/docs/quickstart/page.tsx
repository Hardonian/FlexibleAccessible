import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata("Quickstart", "Quickstart path from signup to first private evidence artifact.", "/docs/quickstart");

export default function DocsQuickstartPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">Quickstart</h1>
        <ol className="space-y-4 text-sm text-slate-700 list-decimal pl-6">
          <li>Create account and verify email (requires deployment SMTP).</li>
          <li>Add site(s) to your workspace and run a private crawl.</li>
          <li>Triage findings, then route uncertain items to the review queue.</li>
          <li>Export reports and audit trail only after human sign-off.</li>
          <li>Configure member roles and seat limits in settings.</li>
        </ol>
        <p className="text-sm text-slate-500">Continue with <Link className="text-brand-700 hover:underline font-medium" href="/docs/how-scans-work">How scans work</Link>.</p>
      </div>
    </MarketingSiteChrome>
  );
}
