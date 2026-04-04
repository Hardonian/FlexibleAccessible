import {
  getLatestValidPublicScanForDomain,
  getPublicScanEvidenceState,
  type PublicEvidenceState,
} from "@/lib/public-scan/validity";
import { Metadata } from "next";
import { PublicScanResults } from "./public-scan-results";
import { getAppBaseUrl } from "@/lib/site-url";
import { PRODUCT_DISPLAY_NAME } from "@/lib/product-brand";

interface PageProps {
  params: Promise<{ domain: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);

  const scan = await getLatestValidPublicScanForDomain(decoded, {
    requireCompleted: true,
  });
  const hasCurrentEvidence =
    Boolean(scan) && getPublicScanEvidenceState(scan) === "valid";
  const score = hasCurrentEvidence ? scan!.score! : 0;
  const totalViolations = hasCurrentEvidence ? scan!.totalViolations : 0;
  const title = hasCurrentEvidence
    ? `Public scan sample: ${decoded}`
    : `Public scan: ${decoded} (no current evidence)`;
  const description = hasCurrentEvidence
    ? `Sampled automated scan on ${decoded}: ${totalViolations} issues found in up to 5 pages (severity breakdown in the report). Not a WCAG conformance guarantee.`
    : `No current, unexpired public scan evidence for ${decoded}. Run a new instant scan from ${PRODUCT_DISPLAY_NAME} for fresh automated results.`;
  const base = getAppBaseUrl();
  const ogPath = `/api/og?domain=${encodeURIComponent(decoded)}`;
  const ogUrl = new URL(ogPath, base).toString();
  const pagePath = `/scan/${encodeURIComponent(decoded)}`;
  const pageUrl = new URL(pagePath, base).toString();

  return {
    title,
    description,
    alternates: {
      canonical: pagePath,
    },
    openGraph: {
      title,
      description,
      url: pageUrl,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogUrl],
    },
  };
}

export default async function PublicScanPage({ params }: PageProps) {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);

  const scan = await getLatestValidPublicScanForDomain(decoded, {
    requireCompleted: false,
  });
  const evidenceState: PublicEvidenceState | null = scan
    ? getPublicScanEvidenceState(scan)
    : null;

  return (
    <PublicScanResults
      domain={decoded}
      initialScan={
        scan
          ? {
              id: scan.id,
              domain: scan.domain,
              status: scan.status,
              evidenceState,
              score: scan.score,
              totalViolations: scan.totalViolations,
              criticalCount: scan.criticalCount,
              seriousCount: scan.seriousCount,
              moderateCount: scan.moderateCount,
              minorCount: scan.minorCount,
              pagesScanned: scan.pagesScanned,
              violations: scan.violations as Record<string, unknown>[] | null,
              createdAt: scan.createdAt.toISOString(),
              completedAt: scan.completedAt?.toISOString() ?? null,
              expiresAt: scan.expiresAt?.toISOString() ?? null,
            }
          : null
      }
    />
  );
}
