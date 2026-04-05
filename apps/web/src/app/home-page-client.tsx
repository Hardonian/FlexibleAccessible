"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  ClipboardCheck,
  FileBarChart,
  Layers,
  LineChart,
  Search,
  Wrench,
} from "lucide-react";
import { getPublicPlanCards } from "@/lib/public-packaging";
import {
  PRODUCT_CONTACT_EMAIL,
  PRODUCT_DISPLAY_NAME,
} from "@/lib/product-brand";
import {
  developerFeatures,
  homeFaqs,
  managedServices,
  productFeatures,
} from "@/lib/marketing-content";

const featureIcons = [
  Search,
  Layers,
  Bot,
  Wrench,
  ClipboardCheck,
  FileBarChart,
] as const;
const managedIcons = [Wrench, AlertTriangle, LineChart] as const;

export function HomePageClient() {
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
    <>
      <section
        className="border-b border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-elevated))]"
        aria-labelledby="hero-heading"
      >
        <div className="mx-auto max-w-7xl px-6 py-section-md md:py-section-lg">
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
              your agency or enterprise can stand behind. Source-first
              remediation—never overlay substitutes.
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

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className="btn-primary text-base px-6 py-3">
              Open private workspace
            </Link>
            <Link href="#pricing" className="btn-secondary text-base px-6 py-3">
              Compare plans
            </Link>
          </div>
        </div>
      </section>

      <section
        id="proof"
        className="mx-auto max-w-7xl px-6 py-section-lg"
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
                    className="mt-0.5 h-1.5 w-1.5 rounded-full bg-brand-600 shrink-0"
                    aria-hidden="true"
                  />
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
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
            <h3 className="text-lg font-semibold text-slate-900">
              Developer-first integration
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Use MCP-compatible tools, org-scoped API keys, or CLI for CI/CD
              pipelines.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-200">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Packages
              </p>
              <p className="mt-1 font-mono text-sm text-slate-700">
                @aros/mcp-server @aros/cli @aros/api-client
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        className="border-y border-[rgb(var(--color-border))] bg-brand-50/40 py-section-lg"
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
            {managedServices.map((service, i) => {
              const Icon = managedIcons[i] ?? Wrench;
              return (
                <article
                  key={service.title}
                  className="rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-elevated))] p-6 shadow-sm"
                >
                  <div className="mb-3 text-brand-700" aria-hidden="true">
                    <Icon className="h-8 w-8" strokeWidth={1.75} />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {service.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600">
                    {service.description}
                  </p>
                </article>
              );
            })}
          </div>
          <div className="mt-12 text-center">
            <a
              href={`mailto:${PRODUCT_CONTACT_EMAIL}?subject=Managed%20accessibility%20scope`}
              className="btn-primary px-8 py-3 text-base"
            >
              Talk to us about scope
            </a>
            <p className="mt-3 text-sm text-slate-500">
              Custom SOWs—procurement-friendly documentation on request
            </p>
          </div>
        </div>
      </section>

      <section className="border-y border-[rgb(var(--color-border))] bg-slate-50 py-12">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-2xl font-bold text-slate-900">
            Audit-ready from day one
          </h2>
          <p className="mt-4 max-w-2xl mx-auto text-slate-600">
            Evidence exports are designed for procurement reviews, legal QA, and
            compliance audits. Not a score—documented remediation activity with
            timestamps, screenshots, and owner assignment.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-8 text-sm">
            <div className="text-center">
              <p className="font-semibold text-slate-900">WCAG 2.1 AA</p>
              <p className="text-slate-500">Engine baseline</p>
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-900">Evidence-backed</p>
              <p className="text-slate-500">No score-only exports</p>
            </div>
            <div className="text-center">
              <p className="font-semibold text-slate-900">Tenant-isolated</p>
              <p className="text-slate-500">Enterprise-grade boundaries</p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="features"
        className="mx-auto max-w-7xl px-6 py-section-lg"
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
          {productFeatures.map((feature, i) => {
            const Icon = featureIcons[i] ?? Search;
            return (
              <article
                key={feature.title}
                className="card border-[rgb(var(--color-border))] transition-shadow hover:shadow-[var(--shadow-card-hover)]"
              >
                <div className="mb-3 text-brand-700" aria-hidden="true">
                  <Icon className="h-8 w-8" strokeWidth={1.75} />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section
        id="pricing"
        className="mx-auto max-w-7xl px-6 py-section-lg"
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
                    <span className="mt-0.5 text-brand-700" aria-hidden="true">
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
                {plan.tier === "FREE" ? "Create free workspace" : "Choose plan"}
              </Link>
            </div>
          ))}
        </div>
      </section>

      <section
        className="border-t border-[rgb(var(--color-border))] bg-slate-100/40 py-section-lg"
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
            {homeFaqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-elevated))] p-6 shadow-sm"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-slate-900">
                  <span>{faq.question}</span>
                  <span
                    className="shrink-0 text-slate-400 group-open:rotate-180 motion-reduce:transform-none transition-transform"
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
    </>
  );
}
