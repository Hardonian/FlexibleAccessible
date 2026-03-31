import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-slate-200">
        <nav
          className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between"
          aria-label="Main"
        >
          <Link href="/" className="text-xl font-bold text-brand-600">
            AROS
          </Link>
          <div className="hidden sm:flex items-center gap-6">
            <Link
              href="#features"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Features
            </Link>
            <Link
              href="#pricing"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="text-sm text-slate-600 hover:text-slate-900"
            >
              Sign In
            </Link>
            <Link href="/signup" className="btn-primary">
              Get Started
            </Link>
          </div>
          <Link href="/signup" className="btn-primary sm:hidden">
            Get Started
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 py-24 text-center">
        <h1 className="text-5xl font-bold text-slate-900 leading-tight max-w-3xl mx-auto">
          Accessibility remediation at the source level
        </h1>
        <p className="mt-6 text-xl text-slate-500 max-w-2xl mx-auto">
          Discover, scan, cluster, and fix accessibility issues with
          browser-accurate scanning, component-level root cause analysis, and
          AI-assisted remediation suggestions.
        </p>
        <div className="mt-8 flex items-center justify-center gap-4">
          <Link href="/signup" className="btn-primary text-base px-6 py-3">
            Start Free Trial
          </Link>
          <Link href="#features" className="btn-secondary text-base px-6 py-3">
            Learn More
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-400">
          No credit card required. Free plan includes 1 site and 50 pages.
        </p>
      </section>

      {/* Anti-Overlay Statement */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="text-2xl font-bold text-slate-900">
            Source-first remediation. Not an overlay.
          </h2>
          <p className="mt-4 text-slate-600 max-w-2xl mx-auto">
            AROS helps development teams fix accessibility issues in source
            code, templates, and components. We do not inject widgets, overlays,
            or runtime patches. Real accessibility requires fixing the
            underlying code.
          </p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-6 py-24">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
          How AROS Works
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature) => (
            <article key={feature.title} className="card">
              <div className="text-2xl mb-3" aria-hidden="true">{feature.icon}</div>
              <h3 className="text-lg font-semibold text-slate-900">{feature.title}</h3>
              <p className="mt-2 text-sm text-slate-500">{feature.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Honest Positioning */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-8">
            What We Believe
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="card">
              <h3 className="font-semibold text-slate-900 mb-2">
                No guaranteed compliance
              </h3>
              <p className="text-sm text-slate-500">
                Automated tools can detect many issues but cannot verify all
                WCAG criteria. Human review remains essential for full
                conformance.
              </p>
            </div>
            <div className="card">
              <h3 className="font-semibold text-slate-900 mb-2">
                Native HTML over ARIA
              </h3>
              <p className="text-sm text-slate-500">
                We prioritize suggestions that use semantic HTML elements over
                ARIA attributes. The best accessibility fix is often the
                simplest one.
              </p>
            </div>
            <div className="card">
              <h3 className="font-semibold text-slate-900 mb-2">
                Human-in-the-loop
              </h3>
              <p className="text-sm text-slate-500">
                AI suggestions are drafts. Every fix requires review before
                export. Low-confidence suggestions route to human review queues.
              </p>
            </div>
            <div className="card">
              <h3 className="font-semibold text-slate-900 mb-2">
                Evidence, not claims
              </h3>
              <p className="text-sm text-slate-500">
                We provide evidence of testing and remediation efforts. We do
                not make unsubstantiated legal compliance claims.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-7xl px-6 py-24">
        <h2 className="text-3xl font-bold text-slate-900 text-center mb-12">
          Pricing
        </h2>
        <div className="grid md:grid-cols-4 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`card ${plan.highlighted ? "ring-2 ring-brand-600" : ""}`}
            >
              <h3 className="text-lg font-semibold text-slate-900">
                {plan.name}
              </h3>
              <p className="mt-2">
                <span className="text-3xl font-bold text-slate-900">
                  ${plan.price}
                </span>
                {plan.price > 0 && <span className="text-slate-500">/mo</span>}
              </p>
              <ul className="mt-4 space-y-2" role="list">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className="text-sm text-slate-600 flex items-start gap-2"
                  >
                    <span className="text-green-500 mt-0.5" aria-hidden="true">
                      &#10003;
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className={`mt-6 w-full inline-flex justify-center ${
                  plan.highlighted ? 'btn-primary' : 'btn-secondary'
                }`}
                aria-label={`Get started with ${plan.name} plan`}
              >
                Get Started
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8">
        <div className="mx-auto max-w-7xl px-6 flex items-center justify-between">
          <p className="text-sm text-slate-400">
            AROS - Accessibility Remediation OS
          </p>
          <div className="flex gap-6 text-sm text-slate-400">
            <Link href="/login" className="hover:text-slate-600">
              Sign In
            </Link>
            <Link href="/signup" className="hover:text-slate-600">
              Sign Up
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
    title: "Browser-Accurate Scanning",
    description:
      "Playwright-based crawling renders pages like a real browser, capturing CSR/SSR content, accessibility trees, and screenshots.",
  },
  {
    icon: "\u{1F9E9}",
    title: "Component Clustering",
    description:
      'Instead of 10,000 page-level findings, see "Header nav button issue appears on 1,842 pages." Fix once, resolve everywhere.',
  },
  {
    icon: "\u{1F916}",
    title: "AI-Assisted Remediation",
    description:
      "Get contextual fix suggestions with rationale and confidence scores. Native HTML fixes preferred over ARIA patches.",
  },
  {
    icon: "\u{1F527}",
    title: "Source-Level Fixes",
    description:
      "Map findings to source code, templates, and components. Export patches, create GitHub PRs, or copy snippets.",
  },
  {
    icon: "\u{1F4CB}",
    title: "Review Workflows",
    description:
      "Route non-automatable criteria to human review queues. Alt text, content clarity, keyboard flows, screen reader checks.",
  },
  {
    icon: "\u{1F4CA}",
    title: "Evidence Reporting",
    description:
      "Generate evidence-grade reports with before/after snapshots, reviewer sign-offs, timestamps, and audit trails.",
  },
];

const plans = [
  {
    name: "Free",
    price: 0,
    highlighted: false,
    features: [
      "1 site",
      "50 pages/crawl",
      "3 scans/month",
      "1 seat",
      "Basic scanning",
    ],
  },
  {
    name: "Starter",
    price: 49,
    highlighted: false,
    features: [
      "3 sites",
      "200 pages/crawl",
      "10 scans/month",
      "3 seats",
      "Component clustering",
      "AI suggestions",
    ],
  },
  {
    name: "Professional",
    price: 149,
    highlighted: true,
    features: [
      "10 sites",
      "1,000 pages/crawl",
      "50 scans/month",
      "10 seats",
      "Review workflows",
      "Evidence reports",
      "Jira integration",
    ],
  },
  {
    name: "Enterprise",
    price: 499,
    highlighted: false,
    features: [
      "100 sites",
      "10,000 pages/crawl",
      "Unlimited scans",
      "100 seats",
      "SSO",
      "Custom integrations",
      "SLA",
    ],
  },
];
