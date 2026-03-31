import { prisma } from "@aros/db";
import { generateFix, validateFix } from "@aros/remediation";

export async function run(args: string[]) {
  const siteId = args.find((a) => !a.startsWith("--"));
  if (!siteId) {
    console.error(
      "Usage: aros fix <site-id> [--limit 20] [--approve-high-confidence]",
    );
    process.exit(1);
  }

  const limit = parseInt(args[args.indexOf("--limit") + 1] ?? "20");
  const autoApprove = args.includes("--approve-high-confidence");

  console.log(`[AROS] Generating fixes for site ${siteId}...`);

  const findings = await prisma.canonicalFinding.findMany({
    where: {
      siteId,
      status: "OPEN",
      remediationSuggestions: { none: {} },
    },
    include: { occurrences: { take: 1 } },
    take: limit,
  });

  console.log(
    `[AROS] Found ${findings.length} open findings without suggestions`,
  );

  let generated = 0;
  let autoApproved = 0;

  for (const finding of findings) {
    const occ = finding.occurrences[0];
    if (!occ) continue;

    const fix = generateFix({
      ruleId: finding.ruleId,
      elementHtml: occ.elementHtml,
      selector: occ.selector ?? "",
    });

    if (!fix) continue;

    const validation = validateFix(fix.suggestedCode);
    const shouldAutoApprove =
      autoApprove &&
      fix.confidence >= 0.8 &&
      validation.valid &&
      validation.warnings.length === 0;

    await prisma.remediationSuggestion.create({
      data: {
        canonicalFindingId: finding.id,
        type: fix.type as any,
        status: shouldAutoApprove
          ? "APPROVED"
          : validation.valid
            ? "VALIDATED"
            : "FAILED_VALIDATION",
        originalCode: occ.elementHtml,
        suggestedCode: fix.suggestedCode,
        rationale: fix.rationale,
        confidence: fix.confidence,
        validationResult: validation as any,
      },
    });

    generated++;
    if (shouldAutoApprove) autoApproved++;

    console.log(
      `  ${finding.ruleId}: ${fix.type} (confidence: ${Math.round(fix.confidence * 100)}%) ${shouldAutoApprove ? "✓ auto-approved" : ""}`,
    );
  }

  console.log(
    `\n[AROS] Generated ${generated} fixes, ${autoApproved} auto-approved`,
  );
}
