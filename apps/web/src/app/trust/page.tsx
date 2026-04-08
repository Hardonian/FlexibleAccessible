import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";
import { CONFIDENCE_LABELS } from "@/lib/assurance-ladder";
import { getPublicPlanCards } from "@/lib/public-packaging";
import { TruthBadge } from "@/components/truth/truth-badge";

export const metadata: Metadata = marketingSurfaceMetadata(
  "Trust",
  `How ${PRODUCT_DISPLAY_NAME} handles evidence, automation limits, and buyer expectations—without fake compliance promises.`,
  "/trust",
);

export default function TrustPage() {
  const plans = getPublicPlanCards();

  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md">
        <p className="text-sm font-medium text-brand-700">Trust</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Evidence-first, scope-honest
        </h1>
        <p className="mt-4 text-slate-600">
          {PRODUCT_DISPLAY_NAME} is built for teams that need defensible
          accessibility operations: what was scanned, what failed, what changed,
          and what still needs human judgment.
        </p>

        <ul className="mt-10 space-y-8 text-slate-700">
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              What automation can and cannot do
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Automated checks surface many failures and regressions; they do not
              replace manual audit, assistive technology testing, or legal
              advice. We say so on every public sample and in-product where it
              matters.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              Public scans are intentionally bounded
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Instant scans sample a small number of pages with rate limits and
              expiry. They are for orientation and sharing signal—not a substitute
              for monitored coverage, history, exports, or private workspaces.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              AI is optional and review-gated
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Draft assist and the in-app copilot call configured LLM providers
              (Anthropic or OpenAI) when keys are present and your plan allows it;
              otherwise remediation falls back to rule-based suggestions and
              copilot returns an explicit unavailable state. Usage is bounded by
              plan limits and requires human review before exports or remediation
              workflows advance. There is no “autopilot compliance” story.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              Access and entitlements
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              API keys, crawl limits, and paid surfaces are enforced on the
              server. Client UI is not a security boundary for billing or
              organization data.
            </p>
          </li>
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              Accounts, email, and rate limits
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Password reset and production signup verification require outbound SMTP configured by the operator.
              Abuse-sensitive paths use Redis-backed limits when Redis is healthy; if Redis is down, the app falls back to
              per-process windows (see{" "}
              <Link href="/api/health?detailed=true" className="font-medium text-brand-700 hover:underline">
                detailed health
              </Link>{" "}
              and the in-app System page for live posture).
            </p>
          </li>
        </ul>



        <section className="mt-12">
          <h2 className="text-lg font-semibold text-slate-900">Confidence labels used in product and exports</h2>
          <p className="mt-2 text-sm text-slate-600">
            These labels are intentionally explicit so buyers can see what is machine detected,
            what is reviewed, and what is still uncertain.
          </p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-[rgb(var(--color-border))]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-4 py-3 font-semibold">Label</th>
                  <th className="px-4 py-3 font-semibold">Meaning</th>
                  <th className="px-4 py-3 font-semibold">Export posture</th>
                </tr>
              </thead>
              <tbody>
                {CONFIDENCE_LABELS.map((item) => (
                  <tr key={item.label} className="border-t border-[rgb(var(--color-border))] align-top">
                    <td className="px-4 py-3 font-medium text-slate-900">{item.label}</td>
                    <td className="px-4 py-3 text-slate-600">{item.meaning}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {item.safeForExternalProof ? "Public-safe proof" : "Internal/contract-bound only"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>


        <section className="mt-12">
          <h2 className="text-lg font-semibold text-slate-900">Procurement posture summary</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-700">
            <p><TruthBadge state="implemented" className="mr-2" />Organization-scoped access controls, audit logs, and server-side entitlement checks are implemented.</p>
            <p><TruthBadge state="environment_dependent" className="mr-2" />Email verification, Redis-backed limits, and object storage behavior depend on deployment configuration.</p>
            <p><TruthBadge state="staged" className="mr-2" />Procurement extras such as custom SLA language and enterprise IAM controls are contract/operator scoped, not implied by default.</p>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-lg font-semibold text-slate-900">Procurement FAQ</h2>
          <dl className="mt-4 space-y-4 text-sm text-slate-700">
            <div>
              <dt className="font-semibold text-slate-900">Does AROS guarantee legal compliance?</dt>
              <dd className="mt-1">No. The platform provides evidence, automation, and review workflow support. Legal/compliance determinations require qualified human review.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">What data is persisted?</dt>
              <dd className="mt-1">Workspace metadata, scan findings, remediation suggestions, review tasks, and audit events. Evidence storage mode depends on deployment object storage configuration.</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-900">Can teams export evidence?</dt>
              <dd className="mt-1">Yes. Reports and audit-log export routes exist with organization-scoped access and permission checks.</dd>
            </div>
          </dl>
        </section>
        <section className="mt-12">
          <h2 className="text-lg font-semibold text-slate-900">Commitments by service lane</h2>
          <p className="mt-2 text-sm text-slate-600">
            We only publish commitments that can be operationally bounded by plan or contract.
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {plans.map((plan) => (
              <article
                key={plan.tier}
                className="rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface-elevated))] p-4"
              >
                <h3 className="text-sm font-semibold text-slate-900">{plan.name}</h3>
                <ul className="mt-2 space-y-2 text-sm text-slate-600">
                  {plan.commitments.map((commitment) => (
                    <li key={commitment.heading}>
                      <span className="font-medium text-slate-800">{commitment.heading}:</span>{" "}
                      {commitment.detail}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <p className="mt-12 text-sm text-slate-500">
          For data handling and security practices, see{" "}
          <Link href="/security" className="font-medium text-brand-700 hover:underline">
            Security &amp; privacy
          </Link>
          ,{" "}
          <Link href="/privacy" className="font-medium text-brand-700 hover:underline">
            Privacy overview
          </Link>
          , and{" "}
          <Link href="/legal/subprocessors" className="font-medium text-brand-700 hover:underline">
            Subprocessors
          </Link>
          . For integration paths, see{" "}
          <Link href="/docs/api" className="font-medium text-brand-700 hover:underline">
            API &amp; integrations
          </Link>
          . For contact, see{" "}
          <Link href="/support" className="font-medium text-brand-700 hover:underline">
            Support
          </Link>
          .
        </p>
      </div>
    </MarketingSiteChrome>
  );
}
