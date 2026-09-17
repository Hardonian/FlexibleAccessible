import type { Metadata } from "next";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata(
  "Google & FOSS Developer Tools",
  "Integrating AROS with Google Lighthouse, Lighthouse CI (LHCI), Chrome DevTools Protocol, and FOSS accessibility runners.",
  "/docs/google-and-foss",
);

export default function DocsGoogleAndFossPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-4xl px-6 py-section-md space-y-8 text-slate-800">
        <div>
          <p className="text-sm font-medium text-brand-700">Integrations</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
            Google & FOSS Developer Tools
          </h1>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            AROS natively connects with existing Google web developer tools and open-source accessibility runners,
            eliminating vendor lock-in and allowing your engineering team to adopt automated accessibility without disrupting existing CI/CD pipelines.
          </p>
        </div>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            1. Google Lighthouse & Lighthouse CI (LHCI)
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            AROS includes a zero-config <code>.lighthouserc.json</code> configuration and programmatic parser in <code>@aros/integrations</code>.
            Teams running Lighthouse in GitHub Actions, GitLab CI, or Vercel can ingest JSON reports directly into AROS canonical findings.
          </p>
          <div className="rounded-lg bg-slate-900 p-4 text-xs font-mono text-slate-100 overflow-x-auto">
            <pre>{`import { parseLighthouseReport, exportToLighthouseAssertions } from "@aros/integrations";

// 1. Ingest LHR from Google Lighthouse runner
const findings = parseLighthouseReport(lighthouseResult);

// 2. Export strict LHCI assertions for CI threshold gates
const assertion = exportToLighthouseAssertions(findings);
console.log("Lighthouse a11y score:", assertion.score);`}</pre>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            2. Google Chrome DevTools Protocol (CDP)
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            All detected violations map to standard Google Chrome DevTools <code>Audits.InspectorIssue</code> schemas.
            Engineers can export findings directly into Chrome DevTools &apos;Issues&apos; panel or inspect elements matching the Chromium Accessibility Object Model (AOM).
          </p>
          <div className="rounded-lg bg-slate-900 p-4 text-xs font-mono text-slate-100 overflow-x-auto">
            <pre>{`import { exportToChromeDevToolsIssues } from "@aros/integrations";

const devToolsIssues = exportToChromeDevToolsIssues(findings);
// Inspectable directly within Chrome DevTools "Issues" tab`}</pre>
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            3. FOSS Pa11y & Axe-Core CLI
          </h2>
          <p className="text-sm leading-relaxed text-slate-600">
            Legacy accessibility suites using Pa11y, HTML_CodeSniffer, or Axe CLI can ingest results into AROS with a 1-line adapter,
            automatically clustering violations into 80/20 component roots.
          </p>
          <div className="rounded-lg bg-slate-900 p-4 text-xs font-mono text-slate-100 overflow-x-auto">
            <pre>{`import { parsePa11yReport } from "@aros/integrations";

const canonicalDefects = parsePa11yReport(pa11yJsonOutput);`}</pre>
          </div>
        </section>

        <div className="rounded-xl border border-brand-200 bg-brand-50 p-6 text-sm text-brand-900">
          <h3 className="font-semibold text-brand-950">Plug-and-Play Workflow</h3>
          <p className="mt-1">
            Download our root <code>.lighthouserc.json</code> or run <code>npm run verify:closure</code> to validate all developer tool integrations locally before production deployment.
          </p>
        </div>
      </div>
    </MarketingSiteChrome>
  );
}
