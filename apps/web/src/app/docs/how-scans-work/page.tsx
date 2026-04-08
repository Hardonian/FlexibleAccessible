import type { Metadata } from "next";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { TruthBadge } from "@/components/truth/truth-badge";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata("How scans work", "Automation boundaries, evidence capture, and review-required conditions.", "/docs/how-scans-work");

export default function DocsHowScansWorkPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">How scans work</h1>
        <div className="space-y-3 text-sm text-slate-700">
          <p><TruthBadge state="implemented" className="mr-2" />Private crawls retain findings history and evidence artifacts.</p>
          <p><TruthBadge state="partial" className="mr-2" />Public scans are intentionally shallow for orientation, not full certification.</p>
          <p><TruthBadge state="requires_human_review" className="mr-2" />Keyboard flow, reading order, and visual ambiguity can require manual verification.</p>
        </div>
      </div>
    </MarketingSiteChrome>
  );
}
