import type { Metadata } from "next";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata("Remediation workflow", "From findings to suggestions to approved remediation actions.", "/docs/remediation-workflow");

export default function DocsRemediationWorkflowPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Remediation workflow</h1>
        <p className="text-sm text-slate-700">Suggestions are generated, reviewed, and then approved or rejected. Human reviewers remain the release gate for ambiguous findings.</p>
      </div>
    </MarketingSiteChrome>
  );
}
