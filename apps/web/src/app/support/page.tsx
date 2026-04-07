import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { PRODUCT_CONTACT_EMAIL, PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata(
  "Support & contact",
  `How to reach the operator of this ${PRODUCT_DISPLAY_NAME} deployment for support, procurement, and incident reports.`,
  "/support",
);

export default function SupportPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md">
        <p className="text-sm font-medium text-brand-700">Support</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Contact &amp; support
        </h1>
        <p className="mt-4 text-slate-600">
          This deployment is operated by a human team (or solo operator). There
          is no implied 24/7 global support desk unless your contract says
          otherwise.
        </p>

        <ul className="mt-10 space-y-8 text-slate-700">
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              Product and billing questions
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Email{" "}
              <a
                href={`mailto:${PRODUCT_CONTACT_EMAIL}`}
                className="font-medium text-brand-700 hover:underline"
              >
                {PRODUCT_CONTACT_EMAIL}
              </a>
              . Include your organization name, approximate timezone, and what you
              were trying to do—we respond as capacity allows.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Self-serve plans use the in-app billing page for upgrades, downgrades, and
              payment updates. If private routes are locked, check billing status there
              first (past due or cancelled subscriptions block paid surfaces even when
              marketing pages still load).
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Enterprise or managed accessibility operations are contract-shaped: scope,
              response expectations, and onboarding commitments apply only where agreed in
              writing—not from marketing copy alone.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              Security reports
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Use the same channel and mark the subject line with
              &quot;Security&quot;. We do not publish a public bug bounty or
              pentest summary here; scope is agreed per deployment.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              Status and incidents
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              A human-readable summary lives at{" "}
              <Link href={"/status" as Route} className="font-medium text-brand-700 hover:underline">
                /status
              </Link>
              . Raw checks:{" "}
              <Link href="/api/health" className="font-medium text-brand-700 hover:underline">
                /api/health
              </Link>{" "}
              and{" "}
              <Link href="/api/health?detailed=true" className="font-medium text-brand-700 hover:underline">
                /api/health?detailed=true
              </Link>{" "}
              (readiness + Redis-backed rate-limit posture). Operators can still publish an external status page;
              adapt the incident template in the repository under{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-800">
                docs/internal/INCIDENT_COMMUNICATION_TEMPLATE.md
              </code>
              .
            </p>
          </li>
        </ul>

        <p className="mt-12 text-sm text-slate-500">
          <Link href="/trust" className="font-medium text-brand-700 hover:underline">
            Trust overview
          </Link>
          ·{" "}
          <Link href="/accessibility" className="font-medium text-brand-700 hover:underline">
            Product accessibility statement
          </Link>
        </p>
      </div>
    </MarketingSiteChrome>
  );
}
