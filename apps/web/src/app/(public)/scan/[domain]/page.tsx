import { prisma } from "@/lib/db";
import { Metadata } from "next";
import { PublicScanResults } from "./public-scan-results";

interface PageProps {
  params: Promise<{ domain: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { domain } = await params;
  const decoded = decodeURIComponent(domain);

  const scan = await prisma.publicScanResult.findFirst({
    where: { domain: decoded, status: "COMPLETED", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  const score = scan?.score ?? 0;
  const total = scan?.totalViolations ?? 0;
  const title = `Accessibility Report: ${decoded} (Score: ${score})`;
  const description = `Found ${total} accessibility issues on ${decoded}. Scan powered by AROS - source-level accessibility remediation.`;
  const ogUrl = `/api/og?domain=${encodeURIComponent(decoded)}&score=${score}&critical=${scan?.criticalCount ?? 0}&serious=${scan?.seriousCount ?? 0}&moderate=${scan?.moderateCount ?? 0}&minor=${scan?.minorCount ?? 0}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
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

  const scan = await prisma.publicScanResult.findFirst({
    where: { domain: decoded, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <PublicScanResults
      domain={decoded}
      initialScan={
        scan
          ? {
              id: scan.id,
              domain: scan.domain,
              status: scan.status,
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
            }
          : null
      }
    />
  );
}
