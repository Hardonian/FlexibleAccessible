import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata(
  "How we compare",
  `How ${PRODUCT_DISPLAY_NAME} differs from overlays, score-only tools, and generic AI checkers—grounded in what the product actually ships.`,
  "/docs/comparison",
);

const rows = [
  {
    topic: "Primary output",
    amf: "Operational findings, clusters, review state, and exportable evidence summaries",
    overlays: "Client-side widget behavior; does not fix source",
    scoreOnly: "Aggregate scores with limited remediation workflow",
    genericAi: "Often a black-box pass/fail or narrative without durable org memory",
  },
  {
    topic: "Conformance claims",
    amf: "Explicit non-guarantee: automated testing is partial; manual review remains essential",
    overlays: "Frequently over-claims; rejected by many practitioners",
    scoreOnly: "Risk of implying completeness from a single number",
    genericAi: "High variance; may imply certainty the model cannot support",
  },
  {
    topic: "Engine",
    amf: "Playwright-rendered pages + axe-core normalization + tenant-scoped data model",
    overlays: "Third-party script injection",
    scoreOnly: "Varies; often limited crawl depth or synthetic checks",
    genericAi: "Varies; may not preserve your exact render path",
  },
  {
    topic: "Remediation path",
    amf: "Source-first: suggestions, human review, GitHub/Jira/export paths where configured",
    overlays: "Not applicable to repository fixes",
    scoreOnly: "May stop at reporting",
    genericAi: "Often lacks review queues tied to org history",
  },
  {
    topic: "AI posture (this product)",
    amf: "Draft assist when keys and plan allow; otherwise rule-based suggestions; copilot returns 503 if no provider configured",
    overlays: "N/A",
    scoreOnly: "Often none or opaque",
    genericAi: "Primary surface; may lack enforcement and audit trail",
  },
] as const;

export default function ComparisonPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-5xl px-6 py-section-md">
        <p className="text-sm font-medium text-brand-700">Documentation</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          How we compare
        </h1>
        <p className="mt-4 text-slate-600">
          This matrix is intentionally conservative: it describes categories of tools and how{" "}
          {PRODUCT_DISPLAY_NAME} is architected—not a feature checklist of competitors. Verify any
          vendor&apos;s claims in your own environment.
        </p>

        <div className="mt-8 overflow-x-auto rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-elevated))]">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead className="border-b border-[rgb(var(--color-border))] bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Topic</th>
                <th className="px-4 py-3 font-semibold text-brand-900">{PRODUCT_DISPLAY_NAME}</th>
                <th className="px-4 py-3 font-semibold">Accessibility overlays</th>
                <th className="px-4 py-3 font-semibold">Score-only / shallow scans</th>
                <th className="px-4 py-3 font-semibold">Generic &quot;AI accessibility&quot; tools</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.topic} className="border-b border-[rgb(var(--color-border))] align-top">
                  <th scope="row" className="px-4 py-4 font-medium text-slate-900">
                    {row.topic}
                  </th>
                  <td className="px-4 py-4 text-slate-600">{row.amf}</td>
                  <td className="px-4 py-4 text-slate-600">{row.overlays}</td>
                  <td className="px-4 py-4 text-slate-600">{row.scoreOnly}</td>
                  <td className="px-4 py-4 text-slate-600">{row.genericAi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 space-y-3 text-sm text-slate-600">
          <p>
            For plan limits and AI token boundaries, see{" "}
            <Link href="/docs/plans-and-limits" className="font-medium text-brand-700 hover:underline">
              Plans and limits
            </Link>
            . For confidence labels and export posture, see{" "}
            <Link href="/trust" className="font-medium text-brand-700 hover:underline">
              Trust
            </Link>
            .
          </p>
        </div>
      </div>
    </MarketingSiteChrome>
  );
}
