import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { PRODUCT_CONTACT_EMAIL, PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata(
  "Accessibility statement",
  `Accessibility posture for the ${PRODUCT_DISPLAY_NAME} web app: intent, limits of automated testing, and how to report issues.`,
  "/accessibility",
);

export default function AccessibilityStatementPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md">
        <p className="text-sm font-medium text-brand-700">Accessibility</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Accessibility statement
        </h1>
        <p className="mt-4 text-slate-600">
          {PRODUCT_DISPLAY_NAME} exists to help teams ship more accessible
          products. This statement covers the product UI itself—not the
          third-party sites customers scan.
        </p>

        <ul className="mt-10 space-y-8 text-slate-700">
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              What we optimize for
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Keyboard paths, visible focus, semantic structure, and clear error
              states in core flows (marketing, auth, dashboard navigation). We
              treat accessibility as ongoing work, not a one-time checkbox.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              Limits of automation in the product
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              The same honesty we apply to customer scans applies here: automated
              checks do not prove full WCAG conformance. Manual testing with
              assistive technologies remains important.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              Feedback
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              If you hit a barrier in the app, email{" "}
              <a
                href={`mailto:${PRODUCT_CONTACT_EMAIL}`}
                className="font-medium text-brand-700 hover:underline"
              >
                {PRODUCT_CONTACT_EMAIL}
              </a>{" "}
              with the page URL, browser, and assistive technology if relevant.
            </p>
          </li>
        </ul>

        <p className="mt-12 text-sm text-slate-500">
          Methodology for scans:{" "}
          <Link href="/trust" className="font-medium text-brand-700 hover:underline">
            Trust overview
          </Link>
          .
        </p>
      </div>
    </MarketingSiteChrome>
  );
}
