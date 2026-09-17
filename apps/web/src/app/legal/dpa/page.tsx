import type { Metadata } from "next";
import Link from "next/link";
import { MarketingSiteChrome } from "@/components/marketing/marketing-site-chrome";
import { PRODUCT_CONTACT_EMAIL, PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";
import { marketingSurfaceMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = marketingSurfaceMetadata(
  "Data Processing Agreement (DPA)",
  `Standard contractual terms and enterprise data protection addendum for ${PRODUCT_DISPLAY_NAME} under GDPR, UK GDPR, and CCPA.`,
  "/legal/dpa",
);

export default function DataProcessingAgreementPage() {
  return (
    <MarketingSiteChrome>
      <div className="mx-auto max-w-3xl px-6 py-section-md">
        <p className="text-sm font-medium text-brand-700">Legal &amp; Compliance</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          Data Processing Agreement (DPA)
        </h1>
        <p className="mt-4 text-slate-600">
          This Data Processing Agreement (&quot;DPA&quot;) governs the processing of
          personal data by {PRODUCT_DISPLAY_NAME} (&quot;Processor&quot;) on behalf of the customer
          organization subscribing to the service (&quot;Controller&quot;), in compliance with Article 28 of
          Regulation (EU) 2016/679 (GDPR), UK GDPR, and California Consumer Privacy Act (CCPA).
        </p>

        <ul className="mt-10 space-y-8 text-slate-700">
          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              1. Subject Matter, Scope &amp; Nature of Processing
            </h2>
            <div className="mt-2 text-sm leading-relaxed space-y-2">
              <p>
                <strong>Subject Matter:</strong> Provision of the {PRODUCT_DISPLAY_NAME} accessibility
                intelligence, headless crawling, defect clustering, and code remediation service.
              </p>
              <p>
                <strong>Duration:</strong> Duration of the customer subscription agreement plus required
                legal retention periods.
              </p>
              <p>
                <strong>Nature of Data:</strong> Customer employee login details (name, email, role) and public
                website DOM artifacts processed during accessibility audits.
              </p>
              <p>
                <strong>Categories of Data Subjects:</strong> Customer employees, authorized users, and
                end-users of Customer&apos;s public web surfaces.
              </p>
            </div>
          </li>

          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              2. Processor Obligations
            </h2>
            <ul className="mt-2 list-disc pl-5 space-y-2 text-sm leading-relaxed">
              <li>
                <strong>Processing on Documented Instructions:</strong> Processor shall process personal data solely in
                accordance with Controller&apos;s documented instructions, including with respect to international data transfers.
              </li>
              <li>
                <strong>Confidentiality:</strong> All personnel authorized to process Customer Data are bound by
                strict confidentiality obligations.
              </li>
              <li>
                <strong>Security Measures (Article 32):</strong> Processor maintains state-of-the-art technical and
                organizational measures including AES-256 encryption at rest, TLS 1.3 in transit, and AST-enforced tenant
                boundary isolation.
              </li>
              <li>
                <strong>Subprocessor Management:</strong> Controller grants general authorization to engage subprocessors
                listed in the Subprocessor Directory. Processor will notify Controller at least 30 days prior to changes.
              </li>
              <li>
                <strong>Data Subject Rights Assistance:</strong> Processor provides automated tooling enabling Controller
                to fulfill data subject requests (access, rectification, deletion, portability) within 72 hours.
              </li>
              <li>
                <strong>Breach Notification SLA:</strong> Processor shall notify Controller without undue delay, and in
                any event within <strong>48 hours</strong>, upon becoming aware of a confirmed personal data security breach.
              </li>
            </ul>
          </li>

          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              3. Data Deletion and Return
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              Upon termination of the primary agreement, Processor shall, at the choice of Controller, delete or return
              all Customer Personal Data within 30 calendar days, unless applicable law requires continued storage.
            </p>
          </li>

          <li>
            <h2 className="text-lg font-semibold text-slate-900">
              4. Governing Law &amp; Integration
            </h2>
            <p className="mt-2 text-sm leading-relaxed">
              This DPA is incorporated by reference into Customer&apos;s Master Services Agreement or online subscription registration.
            </p>
          </li>
        </ul>

        <p className="mt-12 text-sm text-slate-500">
          Questions or custom enterprise DPA requests:{" "}
          <a
            href={`mailto:${PRODUCT_CONTACT_EMAIL}`}
            className="font-medium text-brand-700 hover:underline"
          >
            {PRODUCT_CONTACT_EMAIL}
          </a>
          .{" "}
          <Link href="/legal/terms" className="font-medium text-brand-700 hover:underline">
            Terms of Service
          </Link>
          {" · "}
          <Link href="/legal/subprocessors" className="font-medium text-brand-700 hover:underline">
            Subprocessors
          </Link>
          {" · "}
          <Link href="/privacy" className="font-medium text-brand-700 hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </MarketingSiteChrome>
  );
}
