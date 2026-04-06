import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata(
  "Subprocessors",
  `Infrastructure and service subprocessors commonly used with ${PRODUCT_DISPLAY_NAME} when operators enable them.`,
  "/legal/subprocessors",
);

export default function SubprocessorsPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md">
        <p className="text-sm font-medium text-brand-700">Legal</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Subprocessors
        </h1>
        <p className="mt-4 text-slate-600">
          This list describes categories of vendors your operator may configure
          when running {PRODUCT_DISPLAY_NAME}. It is not exhaustive for every
          deployment—your DPA should name the subprocessors actually in use.
        </p>

        <div className="mt-10 overflow-x-auto rounded-lg border border-[rgb(var(--color-border))]">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-[rgb(var(--color-surface-elevated))] text-slate-900">
              <tr>
                <th className="px-4 py-3 font-semibold">Category</th>
                <th className="px-4 py-3 font-semibold">Typical purpose</th>
                <th className="px-4 py-3 font-semibold">When it applies</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-[rgb(var(--color-border))]">
                <td className="px-4 py-3">Hosting / edge</td>
                <td className="px-4 py-3">Serve the web app and APIs</td>
                <td className="px-4 py-3">Always for SaaS-style hosting</td>
              </tr>
              <tr className="border-t border-[rgb(var(--color-border))]">
                <td className="px-4 py-3">PostgreSQL</td>
                <td className="px-4 py-3">Primary application data</td>
                <td className="px-4 py-3">Always</td>
              </tr>
              <tr className="border-t border-[rgb(var(--color-border))]">
                <td className="px-4 py-3">Redis</td>
                <td className="px-4 py-3">Queues, caches, rate limits</td>
                <td className="px-4 py-3">When workers / jobs enabled</td>
              </tr>
              <tr className="border-t border-[rgb(var(--color-border))]">
                <td className="px-4 py-3">Stripe</td>
                <td className="px-4 py-3">Payments and subscription state</td>
                <td className="px-4 py-3">When billing is configured</td>
              </tr>
              <tr className="border-t border-[rgb(var(--color-border))]">
                <td className="px-4 py-3">Object storage (e.g. S3)</td>
                <td className="px-4 py-3">Large artifacts and screenshots</td>
                <td className="px-4 py-3">When S3 env vars are set</td>
              </tr>
              <tr className="border-t border-[rgb(var(--color-border))]">
                <td className="px-4 py-3">Model providers</td>
                <td className="px-4 py-3">Optional draft assist</td>
                <td className="px-4 py-3">When API keys are configured</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-10 text-sm text-slate-500">
          <Link href="/privacy" className="font-medium text-brand-700 hover:underline">
            Privacy overview
          </Link>
          ·{" "}
          <Link href="/security" className="font-medium text-brand-700 hover:underline">
            Security &amp; privacy
          </Link>
        </p>
      </div>
    </MarketingSiteChrome>
  );
}
