import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { PRODUCT_CONTACT_EMAIL, PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata(
  "Terms of service",
  `Terms of use for ${PRODUCT_DISPLAY_NAME}: no legal conformance warranty, bounded automation, and operator-specific commercial terms.`,
  "/legal/terms",
);

export default function TermsPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md">
        <p className="text-sm font-medium text-brand-700">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Terms of service (summary)
        </h1>
        <p className="mt-4 text-slate-600">
          This is a plain-language summary of how the product is intended to be
          used. Your organization may require a separate order form, MSA, or
          vendor paper—this page does not replace those instruments.
        </p>

        <ul className="mt-10 space-y-8 text-slate-700">
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              Service scope
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              {PRODUCT_DISPLAY_NAME} provides accessibility operations tooling:
              crawling, scanning, findings, workflows, exports, and integrations.
              It does not provide legal advice or a guarantee of WCAG or
              regulatory compliance. Automated checks are incomplete by nature.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              Acceptable use
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              You may not use the product to attack third-party systems, exceed
              fair-use limits, circumvent technical controls, or scrape at a
              scale that harms targets. Public instant scans are intentionally
              rate-limited and shallow.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              Accounts and billing
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Paid access is billed through Stripe where enabled. Plan limits and
              entitlements are enforced server-side; attempting to bypass them
              violates these terms.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              Warranty disclaimer
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              The service is provided &quot;as is&quot; to the extent permitted
              by law. To the extent your jurisdiction does not allow certain
              disclaimers, those disclaimers apply only as far as allowed.
            </p>
          </li>
        </ul>

        <p className="mt-12 text-sm text-slate-500">
          Commercial and procurement terms:{" "}
          <a
            href={`mailto:${PRODUCT_CONTACT_EMAIL}`}
            className="font-medium text-brand-700 hover:underline"
          >
            {PRODUCT_CONTACT_EMAIL}
          </a>
          .{" "}
          <Link href="/privacy" className="font-medium text-brand-700 hover:underline">
            Privacy overview
          </Link>
          .
        </p>
      </div>
    </MarketingSiteChrome>
  );
}
