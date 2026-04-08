import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata(
  "Reviews and manual verification",
  "Review task lifecycle, evidence, reviewer rationale, and escalation posture.",
  "/docs/reviews-and-manual-verification",
);

export default function DocsReviewsPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md space-y-4">
        <h1 className="text-3xl font-bold text-slate-900">Reviews and manual verification</h1>
        <p className="text-sm text-slate-700">
          Review Queue groups work into overdue unresolved, in-progress, pending,
          and resolved queues so teams can prioritize aging human-review risk.
        </p>
        <p className="text-sm text-slate-700">
          Task taxonomy distinguishes interaction behavior, assistive technology,
          language clarity, remediation quality, and governance checks. These
          labels indicate where human validation is required, not deterministic
          compliance truth.
        </p>
        <p className="text-sm text-slate-700">
          Evidence panels summarize available automation and control-plane artifacts;
          reviewer notes should capture rationale and evidence references for auditability.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Link href="/reviews" className="btn-secondary text-xs">Open Review Queue</Link>
          <Link href="/docs/team-admin" className="btn-secondary text-xs">Team-admin docs</Link>
          <Link href="/trust" className="btn-secondary text-xs">Trust posture</Link>
        </div>
      </div>
    </MarketingSiteChrome>
  );
}
