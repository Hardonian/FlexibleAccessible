import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { PRODUCT_CONTACT_EMAIL, PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata(
  "Privacy",
  `How ${PRODUCT_DISPLAY_NAME} treats account data, scan content, and retention at a high level—not a substitute for a signed DPA.`,
  "/privacy",
);

export default function PrivacyPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md">
        <p className="text-sm font-medium text-brand-700">Privacy</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Privacy overview
        </h1>
        <p className="mt-4 text-slate-600">
          This page describes how the product is designed to handle data in a
          typical self-hosted or operator-run deployment. It is not legal advice
          and does not replace a data processing agreement your counsel reviews.
        </p>

        <ul className="mt-10 space-y-8 text-slate-700">
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              What we process
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Accounts (email, name, password hash), organization and membership
              records, scan configuration, crawl and scan results, findings,
              evidence artifacts, billing identifiers synced from Stripe, and
              audit-style logs for operator accountability. Exact fields live
              in the application database schema for this deployment.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              Crawl and scan content
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              The engine fetches URLs you authorize (or submit for instant
              scans). That can include page HTML, assets needed for analysis, and
              derived artifacts (for example screenshots where configured).
              Retention follows this deployment&apos;s settings and operator
              practice—not a promise of indefinite storage.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              AI and model providers
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Where draft assist is enabled, bounded context may be sent to the
              model provider configured in your environment. That provider is a
              subprocessor for those flows; see{" "}
              <Link
                href="/legal/subprocessors"
                className="font-medium text-brand-700 hover:underline"
              >
                Subprocessors
              </Link>
              .
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              Your controls
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Organization owners and admins can manage members, API keys, and
              many product settings inside the app. For export, deletion, or
              DPA-level requests, contact your deployment operator.
            </p>
          </li>
        </ul>

        <p className="mt-12 text-sm text-slate-500">
          Questions:{" "}
          <a
            href={`mailto:${PRODUCT_CONTACT_EMAIL}`}
            className="font-medium text-brand-700 hover:underline"
          >
            {PRODUCT_CONTACT_EMAIL}
          </a>
          . Also see{" "}
          <Link href="/security" className="font-medium text-brand-700 hover:underline">
            Security &amp; privacy
          </Link>{" "}
          and{" "}
          <Link href="/legal/terms" className="font-medium text-brand-700 hover:underline">
            Terms of service
          </Link>
          .
        </p>
      </div>
    </MarketingSiteChrome>
  );
}
