import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const SCORE_COLORS: Record<
  string,
  { bg: string; text: string; label: string }
> = {
  good: { bg: "#dcfce7", text: "#166534", label: "Good" },
  fair: { bg: "#fef9c3", text: "#854d0e", label: "Needs Work" },
  poor: { bg: "#ffedd5", text: "#9a3412", label: "Poor" },
  critical: { bg: "#fee2e2", text: "#991b1b", label: "Critical" },
  none: { bg: "#f1f5f9", text: "#475569", label: "Not Scanned" },
};

function getScoreCategory(score: number | null): string {
  if (score === null) return "none";
  if (score >= 90) return "good";
  if (score >= 70) return "fair";
  if (score >= 50) return "poor";
  return "critical";
}

/**
 * GET /api/badge?domain=example.com
 * Returns an SVG accessibility score badge for embedding on any site.
 * Cache-Control: public, max-age=3600 (1 hour).
 *
 * Usage: <img src="https://aros.dev/api/badge?domain=example.com" alt="Accessibility Score" />
 */
/** Basic domain format validation – rejects obvious injection attempts. */
function isValidDomain(domain: string): boolean {
  if (domain.length > 253) return false;
  if (domain.includes("/") || domain.includes("\\") || domain.includes(" ")) return false;

  try {
    const parsed = new URL(`https://${domain}`);
    return Boolean(parsed.hostname && parsed.hostname.includes("."));
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const domain = searchParams.get("domain");

  if (!domain) {
    return new NextResponse("Missing domain parameter", { status: 400 });
  }

  if (!isValidDomain(domain)) {
    return new NextResponse("Invalid domain parameter", { status: 400 });
  }

  let score: number | null = null;
  let totalViolations = 0;

  try {
    const scan = await prisma.publicScanResult.findFirst({
      where: { domain, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: { score: true, totalViolations: true },
    });

    if (scan) {
      score = scan.score;
      totalViolations = scan.totalViolations;
    }
  } catch {
    // DB unavailable - render "not scanned" badge
  }

  const category = getScoreCategory(score);
  const colors = SCORE_COLORS[category];
  const scoreText = score !== null ? String(score) : "?";
  const statusText =
    score !== null
      ? `${score}/100 - ${totalViolations} issues`
      : "Scan at aros.dev";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="28" role="img" aria-label="Accessibility Score: ${statusText}">
  <title>Accessibility Score: ${statusText}</title>
  <rect width="200" height="28" rx="4" fill="${colors.bg}" stroke="${colors.text}" stroke-opacity="0.2" stroke-width="1"/>
  <text x="10" y="19" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="${colors.text}">A11y</text>
  <rect x="50" y="6" width="1" height="16" fill="${colors.text}" opacity="0.2"/>
  <text x="58" y="19" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="${colors.text}">${scoreText}</text>
  <text x="80" y="19" font-family="system-ui, -apple-system, sans-serif" font-size="11" fill="${colors.text}" opacity="0.7">${colors.label}</text>
</svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
