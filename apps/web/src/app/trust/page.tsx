import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { pageTitle, PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";
import { getAppBaseUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  title: pageTitle("Trust"),
  description: `How ${PRODUCT_DISPLAY_NAME} handles evidence, automation limits, and buyer expectations—without fake compliance promises.`,
  alternates: { canonical: "/trust" },
  openGraph: {
    title: pageTitle("Trust"),
    description: `How ${PRODUCT_DISPLAY_NAME} handles evidence, automation limits, and buyer expectations.`,
    url: `${getAppBaseUrl()}/trust`,
    type: "website",
  },
};

export default function TrustPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md">
        <p className="text-sm font-medium text-brand-700">Trust</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Evidence-first, scope-honest
        </h1>
        <p className="mt-4 text-slate-600">
          {PRODUCT_DISPLAY_NAME} is built for teams that need defensible
          accessibility operations: what was scanned, what failed, what changed,
          and what still needs human judgment.
        </p>

        <ul className="mt-10 space-y-8 text-slate-700">
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              What automation can and cannot do
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Automated checks surface many failures and regressions; they do not
              replace manual audit, assistive technology testing, or legal
              advice. We say so on every public sample and in-product where it
              matters.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              Public scans are intentionally bounded
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Instant scans sample a small number of pages with rate limits and
              expiry. They are for orientation and sharing signal—not a substitute
              for monitored coverage, history, exports, or private workspaces.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              AI is optional and review-gated
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Where draft assist is enabled, it is bounded by plan limits and
              requires human review before it affects exports or remediation
              workflows. There is no “autopilot compliance” story.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              Access and entitlements
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              API keys, crawl limits, and paid surfaces are enforced on the
              server. Client UI is not a security boundary for billing or
              organization data.
            </p>
          </li>
        </ul>

        <p className="mt-12 text-sm text-slate-500">
          For data handling and security practices, see{" "}
          <Link href="/security" className="font-medium text-brand-700 hover:underline">
            Security &amp; privacy
          </Link>
          . For integration paths, see{" "}
          <Link href="/docs/api" className="font-medium text-brand-700 hover:underline">
            API &amp; integrations
          </Link>
          .
        </p>
      </div>
    </MarketingSiteChrome>
  );
}
