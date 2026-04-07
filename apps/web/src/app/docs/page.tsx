import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata(
  "Documentation",
  `Evaluation and onboarding docs for ${PRODUCT_DISPLAY_NAME}: getting started, plans and limits, and API integration paths.`,
  "/docs",
);

const docsCards = [
  {
    href: "/docs/getting-started",
    title: "Getting started",
    description:
      "From account creation to first private scan and first report artifact.",
  },
  {
    href: "/docs/plans-and-limits",
    title: "Plans and limits",
    description:
      "Exact tier limits and what is self-serve versus contract-shaped enterprise scope.",
  },
  {
    href: "/docs/comparison",
    title: "How we compare",
    description:
      "Category comparison: operations platform vs overlays, score-only tools, and generic AI checkers—scoped to real product behavior.",
  },
  {
    href: "/docs/api",
    title: "API and integrations",
    description:
      "Org-scoped API keys, operational limits, and supported integration surfaces in this build.",
  },
] as const;

export default function DocsIndexPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-4xl px-6 py-section-md">
        <p className="text-sm font-medium text-brand-700">Documentation</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Evaluate and onboard without guesswork
        </h1>
        <p className="mt-4 text-slate-600">
          These docs are intentionally operational: what works today, what is
          plan-gated, and where managed enterprise support begins.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {docsCards.map((card) => (
            <article
              key={card.href}
              className="rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-elevated))] p-5"
            >
              <h2 className="text-lg font-semibold text-slate-900">
                <Link href={card.href} className="hover:underline">
                  {card.title}
                </Link>
              </h2>
              <p className="mt-2 text-sm text-slate-600">{card.description}</p>
            </article>
          ))}
        </div>
      </div>
    </MarketingSiteChrome>
  );
}
