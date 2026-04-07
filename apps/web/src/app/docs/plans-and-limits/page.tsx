import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { getPublicPlanCards } from "@/lib/public-packaging";
import { PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata(
  "Plans and limits",
  `Plan limits for ${PRODUCT_DISPLAY_NAME}: scans, seats, domains, AI usage, and where managed enterprise contracts apply.`,
  "/docs/plans-and-limits",
);

export default function PlansAndLimitsPage() {
  const plans = getPublicPlanCards();

  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-5xl px-6 py-section-md">
        <p className="text-sm font-medium text-brand-700">Documentation</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Plans and limits
        </h1>
        <p className="mt-4 text-slate-600">
          Public scans remain intentionally bounded for quick signal. Private
          workspace capabilities and API usage are enforced by plan on the
          server.
        </p>

        <div className="mt-8 overflow-x-auto rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-elevated))]">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[rgb(var(--color-border))] bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Price / month</th>
                <th className="px-4 py-3 font-semibold">Operational limits</th>
                <th className="px-4 py-3 font-semibold">Bounded commitments</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.tier} className="border-b border-[rgb(var(--color-border))] align-top">
                  <td className="px-4 py-4 font-semibold text-slate-900">{plan.name}</td>
                  <td className="px-4 py-4 text-slate-700">${plan.priceMonthly}</td>
                  <td className="px-4 py-4">
                    <ul className="space-y-1 text-slate-600">
                      {plan.bullets.slice(0, 6).map((bullet) => (
                        <li key={bullet}>• {bullet}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-4">
                    <ul className="space-y-1 text-slate-600">
                      {plan.commitments.map((commitment) => (
                        <li key={commitment.heading}>
                          <span className="font-medium text-slate-700">{commitment.heading}:</span>{" "}
                          {commitment.detail}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 space-y-3 text-sm text-slate-600">
          <p>
            Managed enterprise engagements are contract-shaped (SOW, response expectations,
            and onboarding scope) and may include terms not exposed in self-serve checkout.
          </p>
          <p>
            Need contract review? Contact{" "}
            <Link href="/support" className="font-medium text-brand-700 hover:underline">
              support
            </Link>{" "}
            and include procurement requirements early.
          </p>
          <p>
            Confidence labels used in the app and reports are documented in the{" "}
            <Link href="/trust" className="font-medium text-brand-700 hover:underline">
              trust page
            </Link>
            .
          </p>
          <p>
            API key management and org-scoped usage details are in{" "}
            <Link href="/docs/api" className="font-medium text-brand-700 hover:underline">
              API and integrations
            </Link>
            .
          </p>
        </div>
      </div>
    </MarketingSiteChrome>
  );
}
