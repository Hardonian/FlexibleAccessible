import type { Metadata } from "next";
import {
  PRODUCT_DISPLAY_NAME,
} from '@/lib/product-brand';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

const CALLOUT_FEATURES = [
  {
    title: "Full-site crawl, not spot checks",
    description: "Playwright-rendered pages — real accessibility trees, not HTML guesses.",
  },
  {
    title: "Clustered root causes",
    description: "Thousands of hits rolled into one component issue. Fix once, clear the blast radius.",
  },
  {
    title: "Structured evidence exports",
    description: "JSON / CSV audit trails for tickets, stakeholder reports, and remediation tracking.",
  },
  {
    title: "Deterministic triage priority",
    description: "Scoring based on impact, recurrence, and regression signals — not arbitrary AI scores.",
  },
] as const;

function ProductMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M14 2.5L4 7v7c0 5.5 4.3 10.7 10 12 5.7-1.3 10-6.5 10-12V7L14 2.5z"
        fill="currentColor"
        className="text-brand-600"
        opacity="0.15"
      />
      <path
        d="M14 2.5L4 7v7c0 5.5 4.3 10.7 10 12 5.7-1.3 10-6.5 10-12V7L14 2.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        className="text-brand-600"
      />
      <path
        d="M9.5 14l3 3 6-6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-brand-700"
      />
    </svg>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-[rgb(var(--color-canvas))]">
      <a
        href="#auth-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:rounded focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
      >
        Skip to main content
      </a>

      {/* Left panel — product callout (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col justify-between bg-slate-900 px-10 py-12 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-brand-600/10 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-brand-500/8 blur-3xl" />
        </div>

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/20 ring-1 ring-brand-500/30">
              <ProductMark className="h-6 w-6 text-brand-300" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[15px] font-semibold text-white tracking-tight">
                {PRODUCT_DISPLAY_NAME}
              </span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                Accessibility operations
              </span>
            </div>
          </div>

          {/* Headline */}
          <h2 className="text-3xl font-bold text-white leading-snug mb-3">
            Accessibility evidence,<br />
            <span className="text-brand-400">not just scores</span>
          </h2>
          <p className="text-sm text-slate-400 leading-relaxed mb-10 max-w-sm">
            Private workspaces add full-site crawls, deduplicated findings, review queues,
            and structured exports — bounded public scans only sample a few pages.
          </p>

          {/* Feature list */}
          <ul className="space-y-5" role="list">
            {CALLOUT_FEATURES.map((feat) => (
              <li key={feat.title} className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500/20 ring-1 ring-brand-500/30"
                  aria-hidden="true"
                >
                  {/* checkmark */}
                  <svg viewBox="0 0 10 10" className="h-3 w-3" fill="none" aria-hidden="true">
                    <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-brand-400" />
                  </svg>
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">{feat.title}</p>
                  <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{feat.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer note */}
        <p className="relative z-10 text-xs text-slate-500 leading-relaxed">
          Exports document testing and remediation activity. They are not a legal guarantee
          of WCAG conformance — some criteria require expert manual review.
        </p>
      </div>

      {/* Right panel — auth form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile-only branding */}
        <div className="mb-8 flex flex-col items-center text-center lg:hidden">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 ring-1 ring-brand-200">
            <ProductMark className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-brand-900">
            {PRODUCT_DISPLAY_NAME}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Accessibility operations platform
          </p>
        </div>

        <div className="w-full max-w-md">
          <main id="auth-content">{children}</main>
        </div>
      </div>
    </div>
  );
}
