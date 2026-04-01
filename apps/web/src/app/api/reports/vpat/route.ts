import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { requireOrgAccess } from "@/lib/auth-guard";
import { apiSuccess, apiError } from "@/lib/api-utils";
import { ApiError } from "@aros/shared";
import { generateVpatReport } from "@/lib/vpat/generator";
import { runOrgScopedQuery } from "@/lib/route-data-boundary";

/**
 * GET /api/reports/vpat?organizationId=xxx&siteId=yyy&format=json
 * Generate a VPAT (Voluntary Product Accessibility Template) report.
 * Supports JSON and CSV formats.
 */
export async function GET(request: Request) {
  try {
    const user = await requireSession();
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const siteId = searchParams.get("siteId");
    const format = searchParams.get("format") ?? "json";

    if (!organizationId || !siteId) {
      return apiError({
        message: "organizationId and siteId required",
        code: "BAD_REQUEST",
      });
    }

    const ctx = await requireOrgAccess(organizationId, "reports:export");

    const result = await runOrgScopedQuery(ctx, async (orgId) => {
      const site = await prisma.site.findFirst({
        where: {
          id: siteId,
          workspace: { organizationId: orgId },
        },
      });

      if (!site) return { error: "Site not found", code: 404 };

      const org = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { name: true },
      });

      const report = await generateVpatReport(siteId, orgId, org?.name);

      if (format === "csv") {
        return { report, site, format: "csv" };
      }

      // Store as Report record
      await prisma.report.create({
        data: {
          siteId,
          type: "VPAT",
          title: `VPAT Report - ${site.name}`,
          content: report as unknown as object,
          summary: `${report.summary.supports} criteria supported, ${report.summary.partiallySupports} partially, ${report.summary.doesNotSupport} not supported`,
        },
      });

      return { report };
    });

    if (!result.ok) {
      return apiError({ message: result.message, code: "INTERNAL_SERVER_ERROR" });
    }

    const { data } = result;

    if ("error" in data) {
      return apiError({ message: data.error, code: data.code === 404 ? "NOT_FOUND" : "BAD_REQUEST" });
    }

    if ("format" in data && data.format === "csv") {
      const { report, site } = data;
      const header =
        "WCAG Criteria,Level,Conformance Status,Explanation,Open Findings\n";
      const rows = report.rows
        .map(
          (r) =>
            `"${r.criteria}","${r.level}","${r.conformanceStatus}","${r.explanation.replace(/"/g, '""')}","${r.findings.length}"`,
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

    return apiSuccess(data.report);
  } catch (error) {
    return apiError(error);
  }
}
