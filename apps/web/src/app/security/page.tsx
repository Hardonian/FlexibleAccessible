import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata(
  "Security & privacy",
  `Security and privacy posture for ${PRODUCT_DISPLAY_NAME}: accounts, org boundaries, and what this page is not (a legal contract).`,
  "/security",
);

export default function SecurityPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md">
        <p className="text-sm font-medium text-brand-700">Security &amp; privacy</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          How we think about your data
        </h1>
        <p className="mt-4 text-slate-600">
          This page summarizes practices and expectations for the product as
          shipped from this repository. It is not a substitute for your
          organization&apos;s procurement review, DPA, or legal counsel.
        </p>

        <ul className="mt-10 space-y-8 text-slate-700">
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              Accounts and organizations
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Workspace data is scoped to organizations and memberships. API
              keys and automation hooks inherit those boundaries on the server.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              Crawling and scan artifacts
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Scans process publicly reachable content you configure (or submit
              for instant scans). Retention and export behavior follow your plan
              and in-app settings for this deployment.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              AI and third-party models
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              When enabled, draft assist may send bounded context to configured
              model providers per your operator&apos;s environment. Review queues
              exist so suggestions are not silent production changes.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              Reporting issues
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              For security-sensitive reports, contact your deployment operator
              through the channel they publish for this instance. We do not
              publish a global vulnerability disclosure SLA here because hosted
              deployments may differ.
            </p>
          </li>
        </ul>

        <p className="mt-12 text-sm text-slate-500">
          Why we ship this page: buyers and security teams need a straight
          description of scope—not marketing claims dressed as certifications.{" "}
          <Link href="/trust" className="font-medium text-brand-700 hover:underline">
            Trust overview
          </Link>
          ·{" "}
          <Link href="/privacy" className="font-medium text-brand-700 hover:underline">
            Privacy
          </Link>
          ·{" "}
          <Link href="/legal/terms" className="font-medium text-brand-700 hover:underline">
            Terms
          </Link>
          ·{" "}
          <Link href="/" className="font-medium text-brand-700 hover:underline">
            Home
          </Link>
        </p>
      </div>
    </MarketingSiteChrome>
  );
}
