import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { requireCanonicalOrgAccess } from "@/lib/server-org-boundary";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { generateVpatReport } from "@/lib/vpat/generator";
import { ApiError } from "@aros/shared";
import {
  createVpatReportRecord,
  findVpatSite,
  getOrganizationName,
} from "@/lib/reports/org-scoped-queries";
import { prisma } from "@/lib/db";
import {
  recordReportExportUsage,
  USAGE_METRIC_VPAT_EXPORT,
} from "@/lib/usage/report-export-usage";

/**
 * GET /api/reports/vpat?organizationId=xxx&siteId=yyy&format=json
 * Generate a VPAT (Voluntary Product Accessibility Template) report.
 * Supports JSON and CSV formats.
 */
export async function GET(request: Request) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const siteId = searchParams.get("siteId");
    const format = searchParams.get("format") ?? "json";

    if (!organizationId || !siteId) {
      return apiError(ApiError.badRequest("organizationId and siteId required"));
    }

    const ctx = await requireCanonicalOrgAccess(organizationId, "reports:export", {
      requirePaid: true,
    });

    const site = await findVpatSite(ctx, siteId);
    if (!site) {
      return apiError(ApiError.notFound("Site not found"));
    }

    const org = await getOrganizationName(ctx);
    const report = await generateVpatReport(siteId, organizationId, org?.name);

    await recordReportExportUsage(
      prisma,
      ctx.organizationId,
      USAGE_METRIC_VPAT_EXPORT,
      1,
    );

    if (format === "csv") {
      const header =
        "WCAG Criteria,Level,Conformance Status,Explanation,Open Findings\n";
      const rows = report.rows
        .map(
          (row) =>
            `"${row.criteria}","${row.level}","${row.conformanceStatus}","${row.explanation.replace(/"/g, '""')}","${row.findings.length}"`,
        )
        .join("\n");

      const csv = header + rows;

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="vpat-${site.domain}-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    await createVpatReportRecord(ctx, {
      siteId,
      siteName: site.name,
      report: report as unknown as object,
      summaryText: `${report.summary.supports} criteria supported, ${report.summary.partiallySupports} partially, ${report.summary.doesNotSupport} not supported`,
    });

    return apiSuccess(report);
  } catch (error) {
    return apiError(error);
  }
}
