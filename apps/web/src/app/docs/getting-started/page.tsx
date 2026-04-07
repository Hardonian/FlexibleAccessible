import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata(
  "Getting started",
  `How to go from signup to first scan and first shareable evidence in ${PRODUCT_DISPLAY_NAME}.`,
  "/docs/getting-started",
);

export default function GettingStartedDocsPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md">
        <p className="text-sm font-medium text-brand-700">Documentation</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Getting started
        </h1>
        <p className="mt-4 text-slate-600">
          Follow this sequence to get first value quickly while preserving
          evidence quality and tenant boundaries.
        </p>

        <ol className="mt-8 space-y-6 text-slate-700">
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              1. Create an account and verify email
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Use{" "}
              <Link
                href="/signup"
                className="font-medium text-brand-700 hover:underline"
              >
                signup
              </Link>{" "}
              to create your user and workspace. Production signup depends on
              outbound SMTP for email verification.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              2. Add a site in your workspace
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              In dashboard settings, add each domain you own so scans and
              findings stay organization-scoped and auditable.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              3. Run an initial private crawl
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Queue a scan to establish baseline findings. Public scans are
              intentionally shallow; private crawls provide retained history and
              remediation workflows.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              4. Triage and assign critical findings first
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Use clustered findings to identify repeated root causes before
              generating exports. Automated results accelerate triage but do not
              replace manual assistive-technology testing.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              5. Create API keys only when needed
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Generate org-scoped API keys in Settings → API keys, rotate
              regularly, and revoke unused keys. See{" "}
              <Link
                href="/docs/api"
                className="font-medium text-brand-700 hover:underline"
              >
                API and integrations
              </Link>
              .
            </p>
          </li>
        </ol>

        <p className="mt-10 text-sm text-slate-500">
          Next: {" "}
          <Link
            href="/docs/plans-and-limits"
            className="font-medium text-brand-700 hover:underline"
          >
            Plans and limits
          </Link>{" "}
          · {" "}
          <Link href="/docs/api" className="font-medium text-brand-700 hover:underline">
            API docs
          </Link>
          .
        </p>
      </div>
    </MarketingSiteChrome>
  );
}
