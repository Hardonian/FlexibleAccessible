import type { Metadata } from "next";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata("Reports and proof", "How report exports and audit evidence should be interpreted.", "/docs/reports-and-proof");

export default function DocsReportsProofPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Reports and proof</h1>
        <p className="text-sm text-slate-700">Reports can be exported from authenticated routes. Confidence labels indicate machine certainty and review status; they are not legal determinations.</p>
        <p className="text-sm text-slate-700">Audit logs capture review and team-admin events for organization-scoped evidence trails.</p>
      </div>
    </MarketingSiteChrome>
  );
}
