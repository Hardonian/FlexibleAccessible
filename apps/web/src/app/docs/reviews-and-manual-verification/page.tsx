import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata("Reviews and manual verification", "Review task lifecycle, evidence, and reviewer decisions.", "/docs/reviews-and-manual-verification");

export default function DocsReviewsPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Reviews and manual verification</h1>
        <p className="text-sm text-slate-700">Review tasks prioritize unresolved and stale items first. Evidence panels show stored artifacts and summaries when available; missing evidence is shown explicitly.</p>
        <p className="text-sm text-slate-700">Reviewer outcomes map to confirmed, false positive, and needs escalation flows inside <Link href="/reviews" className="text-brand-700 hover:underline font-medium">Review Queue</Link>.</p>
      </div>
    </MarketingSiteChrome>
  );
}
