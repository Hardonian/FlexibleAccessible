"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getPublicPlanCards } from "@/lib/public-packaging";
import {
  PRODUCT_DISPLAY_NAME,
  PRODUCT_LEGAL_LINE,
  PRODUCT_TAGLINE,
} from "@/lib/product-brand";

const developerFeatures = [
  "MCP server with 20+ tools for IDE-native workflows",
  "Scoped API keys with organization boundaries enforced server-side",
  "CLI for CI gates and diff-friendly scan output",
  "Webhooks when crawls complete—wire into your own runbooks",
  "Same engine as the product UI—no mystery “AI score” API",
];

const managedServices = [
  {
    icon: "\u{1F6E0}",
    title: "Program setup & playbooks",
    description:
      "We help you define scan scope, severity policy, export templates, and stakeholder reporting rhythms so the work stays accountable.",
  },
  {
    icon: "\u{1F6A8}",
    title: "Remediation partnership",
    description:
      "Engineers pair with your team on high-impact clusters—PRs, CMS patterns, and design-system fixes—not widget overlays.",
  },
  {
    icon: "\u{1F4C8}",
    title: "Ongoing operations",
    description:
      "Scheduled scans, regression alerts, and evidence packs for leadership—priced as a service, not shelf-ware.",
  },
];

const faqs = [
  {
    question: "How is this different from another “AI accessibility” checker?",
    answer:
      "FlexibleAccessible is built as an operations surface: browser-accurate crawling, clustered findings so you fix root causes, review queues, exports, and API/MCP hooks. Where AI appears, it is bounded—draft suggestions with confidence and human review—not a black-box compliance promise.",
  },
  {
    question: "How is this different from accessibility overlays?",
    answer:
      "Overlays inject third-party widgets that do not repair underlying code and are widely rejected by the disability community. This product is source-first: fix HTML, CSS, ARIA, and components where they belong.",
  },
  {
    question: "Do you guarantee WCAG or legal compliance?",
    answer:
      "No. Automated testing covers a fraction of WCAG. We surface evidence and workflow state; manual testing by experts and users with disabilities remains essential for any serious conformance claim.",
  },
  {
    question: "What does the free instant scan include?",
    answer:
      "A bounded public sample of pages with clear limitations—enough to see signal, not a substitute for full-site monitoring, private workspaces, history, or exports. Upgrade for the complete operator workflow.",
  },
];

export default function HomePage() {
  const plans = getPublicPlanCards();
  const [scanDomain, setScanDomain] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const router = useRouter();

  const handleInstantScan = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!scanDomain.trim()) return;

      setScanning(true);
      setScanError("");

      try {
        const res = await fetch("/api/public-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain: scanDomain.trim() }),
        });

        const json = await res.json();

        if (!res.ok) {
          if (res.status === 429) {
            setScanError(
              json.error?.message ??
                "Please wait before scanning this domain again.",
            );
          } else {
            setScanError(
              json.error?.message ?? "Failed to start scan. Please try again.",
            );
          }
          return;
        }

        if (json.data?.resultsUrl) {
          router.push(json.data.resultsUrl);
        }
      } catch {
        setScanError("Network error. Please try again.");
      } finally {
        setScanning(false);
      }
    },
    [scanDomain, router],
  );

  return (
    <div className="min-h-screen bg-[rgb(var(--color-canvas))] text-slate-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-lg focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-brand-400"
      >
        Skip to main content
      </a>

      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-sm supports-[backdrop-filter]:bg-white/75">
        <nav
          className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-4"
          aria-label="Main"
        >
          <Link
            href="/"
            className="group flex flex-col leading-tight focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 rounded-md"
          >
            <span className="text-lg font-semibold tracking-tight text-brand-800">
              {PRODUCT_DISPLAY_NAME}
            </span>
            <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700">
              {PRODUCT_TAGLINE}
            </span>
          </Link>
          <div className="hidden items-center gap-8 sm:flex">
            <Link
              href="#proof"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Proof &amp; workflow
            </Link>
            <Link
              href="#pricing"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Plans
            </Link>
            <Link
              href="/docs/api"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Integrations
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Sign in
            </Link>
            <Link href="/signup" className="btn-primary">
              Start workspace
            </Link>
          </div>
          <Link href="/signup" className="btn-primary sm:hidden">
            Start
          </Link>
        </nav>
      </header>

      <main id="main">
        <section
          className="relative overflow-hidden border-b border-slate-200/60 bg-gradient-to-b from-white to-[rgb(var(--color-canvas))]"
          aria-labelledby="hero-heading"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            aria-hidden="true"
          >
            <div className="absolute -left-24 top-0 h-72 w-72 rounded-full bg-brand-200/40 blur-3xl" />
            <div className="absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-teal-200/30 blur-3xl" />
          </div>
          <div className="relative mx-auto max-w-7xl px-6 py-20 md:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-brand-800">
                Accessibility operations platform
              </p>
              <h1
                id="hero-heading"
                className="mt-4 text-4xl font-bold leading-tight tracking-tight text-slate-900 md:text-5xl md:leading-tight"
              >
                Prove accessibility progress—don&apos;t just publish a score
              </h1>
              <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
                Continuous scans, clustered issues, review trails, and exports
                your agency or enterprise can stand behind. Built for teams who
                ship fixes in code—not overlays.
              </p>
            </div>

            <form
              onSubmit={handleInstantScan}
              className="mx-auto mt-12 max-w-xl"
              aria-label="Instant public accessibility scan"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                <label htmlFor="scan-domain" className="sr-only">
                  URL or domain to scan
                </label>
                <input
                  id="scan-domain"
                  type="text"
                  value={scanDomain}
                  onChange={(e) => setScanDomain(e.target.value)}
                  placeholder="example.com or https://…"
                  className="input flex-1 text-base"
                  disabled={scanning}
                  autoComplete="url"
                  required
                />
                <button
                  type="submit"
                  className="btn-primary px-6 py-3 text-base whitespace-nowrap sm:shrink-0"
                  disabled={scanning}
                >
                  {scanning ? "Starting…" : "Run public scan"}
                </button>
              </div>
              {scanError && (
                <p className="mt-3 text-sm text-red-700" role="alert">
                  {scanError}
                </p>
              )}
              <p className="mt-3 text-center text-sm text-slate-500">
                No account needed. Sample depth and rate limits apply—see results
                for caveats.
              </p>
            </form>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link href="/signup" className="btn-secondary text-base px-6 py-3">
                Open private workspace
              </Link>
              <Link
                href="#pricing"
                className="text-sm font-semibold text-brand-800 underline-offset-4 hover:underline"
              >
                Compare plans
              </Link>
            </div>
          </div>
        </section>

        <section
          className="border-b border-slate-200/80 bg-white py-16"
          aria-labelledby="anti-overlay-heading"
        >
          <div className="mx-auto max-w-4xl px-6 text-center">
            <h2
              id="anti-overlay-heading"
              className="text-2xl font-bold text-slate-900"
            >
              Source-first. Never an overlay substitute.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-slate-600">
              {PRODUCT_DISPLAY_NAME} helps you remediate in templates,
              components, and repositories. We do not sell runtime patches that
              pretend away accessibility debt.
            </p>
          </div>
        </section>

        <section
          id="proof"
          className="mx-auto max-w-7xl px-6 py-24"
          aria-labelledby="developer-lane-heading"
        >
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <h2
                id="developer-lane-heading"
                className="text-3xl font-bold text-slate-900"
              >
                Built for builders and operators
              </h2>
              <p className="mt-4 text-slate-600">
                Wire scans into how your team already works—IDE, CI, ticketing,
                and internal tools. Entitlements and org boundaries are enforced
                on the server, not buried in client UI.
              </p>
              <ul className="mt-8 space-y-3">
                {developerFeatures.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 font-mono text-sm text-brand-700"
                      aria-hidden="true"
                    >
                      &gt;
                    </span>
                    <span className="text-slate-700">{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link href="/docs/api" className="btn-secondary">
                  Integration guide
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-1 font-semibold text-brand-800 underline-offset-4 hover:underline"
                >
                  Get API access on paid plans
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-6 font-mono text-sm text-slate-300 shadow-lg">
              <pre className="whitespace-pre text-[13px] leading-relaxed">{`# MCP (IDE-native)
npx @aros/mcp-server

# Authenticated API (org-scoped keys)
curl -H "Authorization: Bearer $API_KEY" \\
  $BASE_URL/api/...

# CLI / CI
npx @aros/cli scan --site example.com`}</pre>
              <p className="mt-4 border-t border-slate-800 pt-4 text-xs text-slate-500">
                Package names stay @aros/*; the product you use is{" "}
                {PRODUCT_DISPLAY_NAME}.
              </p>
            </div>
          </div>
        </section>

        <section
          className="border-y border-slate-200/80 bg-brand-50/40 py-24"
          aria-labelledby="managed-heading"
        >
          <div className="mx-auto max-w-7xl px-6">
            <div className="mb-12 text-center">
              <h2
                id="managed-heading"
                className="text-3xl font-bold text-slate-900"
              >
                Managed accessibility operations
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
                When you want outcomes without hiring a full internal program
                overnight—we embed with your release cadence and evidence
                requirements.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {managedServices.map((service) => (
                <article
                  key={service.title}
                  className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="mb-3 text-2xl" aria-hidden="true">
                    {service.icon}
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {service.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {service.description}
                  </p>
                </article>
              ))}
            </div>
            <div className="mt-12 text-center">
              <Link
                href="mailto:sales@aros.dev"
                className="btn-primary px-8 py-3 text-base"
              >
                Talk to us about scope
              </Link>
              <p className="mt-3 text-sm text-slate-500">
                Custom SOWs—procurement-friendly documentation on request
              </p>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="mx-auto max-w-7xl px-6 py-24"
          aria-labelledby="how-heading"
        >
          <h2
            id="how-heading"
            className="mb-4 text-center text-3xl font-bold text-slate-900"
          >
            How it works
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-slate-600">
            A recurring loop—scan, cluster, triage, prove—so accessibility stays
            legible to engineering, design, and legal stakeholders.
          </p>
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <article
                key={feature.title}
                className="card border-slate-200/90 transition-shadow hover:shadow-md"
              >
                <div className="mb-3 text-2xl" aria-hidden="true">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section
          className="border-y border-slate-200/80 bg-slate-100/50 py-16"
          aria-labelledby="beliefs-heading"
        >
          <div className="mx-auto max-w-4xl px-6">
            <h2
              id="beliefs-heading"
              className="mb-8 text-center text-2xl font-bold text-slate-900"
            >
              What we will not pretend
            </h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="card">
                <h3 className="mb-2 font-semibold text-slate-900">
                  No magic compliance button
                </h3>
                <p className="text-sm text-slate-600">
                  Automation finds many failures; it cannot certify your product
                  for every WCAG success criterion. We are explicit about scope.
                </p>
              </div>
              <div className="card">
                <h3 className="mb-2 font-semibold text-slate-900">
                  Native HTML first
                </h3>
                <p className="text-sm text-slate-600">
                  Prefer semantic elements over ARIA sprawl. The best fix is often
                  the smallest change that removes entire classes of bugs.
                </p>
              </div>
              <div className="card">
                <h3 className="mb-2 font-semibold text-slate-900">
                  Human review is a feature
                </h3>
                <p className="text-sm text-slate-600">
                  AI-assisted drafts stay in review queues with rationale and
                  confidence—exports and PRs reflect human decisions.
                </p>
              </div>
              <div className="card">
                <h3 className="mb-2 font-semibold text-slate-900">
                  Evidence you can attach
                </h3>
                <p className="text-sm text-slate-600">
                  Reports and exports are designed for procurement and
                  post-incident review—not vanity dashboards.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section
          id="pricing"
          className="mx-auto max-w-7xl px-6 py-24"
          aria-labelledby="pricing-heading"
        >
          <h2
            id="pricing-heading"
            className="mb-4 text-center text-3xl font-bold text-slate-900"
          >
            Plans
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-slate-600">
            Free public scans invite you in; paid tiers unlock private workspaces,
            history, automation, and API access—enforced server-side.
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`card flex flex-col ${plan.highlighted ? "ring-2 ring-brand-600 ring-offset-2" : ""}`}
              >
                <h3 className="text-lg font-semibold text-slate-900">
                  {plan.name}
                </h3>
                <p className="mt-2">
                  <span className="text-3xl font-bold text-slate-900">
                    ${plan.priceMonthly}
                  </span>
                  {plan.priceMonthly > 0 && (
                    <span className="text-slate-500">/mo</span>
                  )}
                </p>
                <ul className="mt-4 flex-1 space-y-2" role="list">
                  {plan.bullets.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2 text-sm text-slate-600"
                    >
                      <span
                        className="mt-0.5 text-brand-700"
                        aria-hidden="true"
                      >
                        &#10003;
                      </span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className={`mt-6 inline-flex w-full justify-center ${
                    plan.highlighted ? "btn-primary" : "btn-secondary"
                  }`}
                  aria-label={`Get started with ${plan.name} plan`}
                >
                  {plan.tier === "FREE" ? "Try instant scan" : "Choose plan"}
                </Link>
              </div>
            ))}
          </div>
        </section>

        <section
          className="border-t border-slate-200/80 bg-slate-100/40 py-24"
          aria-labelledby="faq-heading"
        >
          <div className="mx-auto max-w-4xl px-6">
            <h2
              id="faq-heading"
              className="mb-12 text-center text-3xl font-bold text-slate-900"
            >
              Questions
            </h2>
            <div className="space-y-4">
              {faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="group rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900">
                    <span>{faq.question}</span>
                    <span
                      className="shrink-0 text-slate-400 group-open:rotate-180 motion-reduce:transition-none transition-transform"
                      aria-hidden="true"
                    >
                      &#9662;
                    </span>
                  </summary>
                  <p className="mt-4 leading-relaxed text-slate-600">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">
              {PRODUCT_DISPLAY_NAME}
            </p>
            <p className="mt-1 max-w-md text-xs text-slate-500">
              {PRODUCT_LEGAL_LINE}
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-sm text-slate-500">
            <Link href="/login" className="hover:text-slate-800">
              Sign in
            </Link>
            <Link href="/signup" className="hover:text-slate-800">
              Create account
            </Link>
            <Link href="/docs/api" className="hover:text-slate-800">
              Docs
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    icon: "\u{1F50D}",
    title: "Browser-accurate crawling",
    description:
      "Playwright renders like users’ browsers—CSR, SSR, and real accessibility trees—so findings match what ships.",
  },
  {
    icon: "\u{1F9E9}",
    title: "Clustered root causes",
    description:
      "Roll thousands of page hits into one component-level issue. Triage once, clear the blast radius with intent.",
  },
  {
    icon: "\u{1F916}",
    title: "Bounded assist, not autopilot",
    description:
      "Draft fixes with rationale and confidence where enabled. Nothing ships as “AI magic”—review and export are explicit gates.",
  },
  {
    icon: "\u{1F527}",
    title: "Fixes in your repo",
    description:
      "Map to source, open GitHub PRs, or export patches—so remediation lives in version control.",
  },
  {
    icon: "\u{1F4CB}",
    title: "Review & accountability",
    description:
      "Queues for what automation cannot judge: copy, context, keyboard flows, and assistive-tech nuance.",
  },
  {
    icon: "\u{1F4CA}",
    title: "Evidence for stakeholders",
    description:
      "Exports and report artifacts meant for agencies, execs, and procurement—not a single green score.",
  },
];
