import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";
import { TruthBadge, type TruthState } from "@/components/truth/truth-badge";

export const metadata: Metadata = marketingSurfaceMetadata(
  "Documentation",
  `Evaluation and onboarding docs for ${PRODUCT_DISPLAY_NAME}: quickstart, review workflow, reports, and team administration grounded in shipped behavior.`,
  "/docs",
);

const docsCards: Array<{
  href: Route;
  title: string;
  description: string;
  state: TruthState;
}> = [
  {
    href: "/docs/quickstart",
    title: "Quickstart",
    description: "Create a workspace, run a private crawl, and produce first evidence.",
    state: "implemented",
  },
  {
    href: "/docs/how-scans-work",
    title: "How scans work",
    description: "What is automated, what is bounded, and where manual verification is required.",
    state: "implemented",
  },
  {
    href: "/docs/reports-and-proof",
    title: "Reports and proof",
    description: "How exports, audit logs, and confidence labels work in this build.",
    state: "implemented",
  },
  {
    href: "/docs/remediation-workflow",
    title: "Remediation workflow",
    description: "From finding clusters to suggestions, approvals, and tracked outcomes.",
    state: "implemented",
  },
  {
    href: "/docs/reviews-and-manual-verification",
    title: "Reviews and manual verification",
    description: "How review tasks are prioritized, resolved, and documented.",
    state: "implemented",
  },
  {
    href: "/docs/team-admin",
    title: "Team administration",
    description: "Members, roles, seats, pending invites, and audit trail posture.",
    state: "partial",
  },
  {
    href: "/docs/api",
    title: "API and integrations",
    description: "Org-scoped API keys and MCP integration surfaces.",
    state: "implemented",
  },
  {
    href: "/docs/api-mcp",
    title: "API + MCP detail",
    description: "When to use session routes, API keys, and MCP tooling.",
    state: "implemented",
  },
] as const;

export default function DocsIndexPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-5xl px-6 py-section-md">
        <p className="text-sm font-medium text-brand-700">Documentation</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Operator-grade docs with explicit boundaries
        </h1>
        <p className="mt-4 text-slate-600">
          These pages distinguish implemented behavior from staged capability,
          and mark where human review remains mandatory.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {docsCards.map((card) => (
            <article
              key={card.href}
              className="rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-elevated))] p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-slate-900">
                  <Link href={card.href} className="hover:underline">
                    {card.title}
                  </Link>
                </h2>
                <TruthBadge state={card.state} />
              </div>
              <p className="mt-2 text-sm text-slate-600">{card.description}</p>
            </article>
          ))}
        </div>
      </div>
    </MarketingSiteChrome>
  );
}
