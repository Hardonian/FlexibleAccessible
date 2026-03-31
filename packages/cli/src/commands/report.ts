import { prisma } from "@aros/db";

export async function run(args: string[]) {
  const siteId = args.find((a) => !a.startsWith("--"));
  if (!siteId) {
    console.error("Usage: aros report <site-id> [--format json|csv]");
    process.exit(1);
  }

  const format = args.includes("--format")
    ? args[args.indexOf("--format") + 1]
    : "json";

  console.log(`[AROS] Generating conformance report for site ${siteId}...`);

  const findings = await prisma.canonicalFinding.findMany({
    where: { siteId },
    select: {
      ruleId: true,
      impact: true,
      status: true,
      wcagTags: true,
      occurrenceCount: true,
      description: true,
    },
  });

  const total = findings.length;
  const open = findings.filter(
    (f) => f.status === "OPEN" || f.status === "IN_PROGRESS",
  ).length;
  const resolved = findings.filter((f) =>
    ["RESOLVED", "MITIGATED", "FALSE_POSITIVE", "WONT_FIX"].includes(f.status),
  ).length;

  const report = {
    generatedAt: new Date().toISOString(),
    siteId,
    summary: {
      total,
      open,
      resolved,
      resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
      byImpact: {
        CRITICAL: findings.filter((f) => f.impact === "CRITICAL").length,
        SERIOUS: findings.filter((f) => f.impact === "SERIOUS").length,
        MODERATE: findings.filter((f) => f.impact === "MODERATE").length,
        MINOR: findings.filter((f) => f.impact === "MINOR").length,
      },
    },
    disclaimer:
      "Automated scanning detects approximately 30-40% of WCAG 2.2 criteria. Manual expert review is required for full conformance.",
  };

  if (format === "csv") {
    const headers = ["Metric", "Value"];
    const rows = [
      ["Total Findings", total],
      ["Open", open],
      ["Resolved", resolved],
      ["Resolution Rate", `${report.summary.resolutionRate}%`],
      ["Critical", report.summary.byImpact.CRITICAL],
      ["Serious", report.summary.byImpact.SERIOUS],
      ["Moderate", report.summary.byImpact.MODERATE],
      ["Minor", report.summary.byImpact.MINOR],
    ];
    console.log(
      [headers.join(","), ...rows.map((r) => r.join(","))].join("\n"),
    );
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
}
