"use server";

import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { resolveDashboardOrgMembership } from "@/lib/route-data-boundary";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";

export async function generateReportAction(formData: FormData) {
  const user = await requireSession();
  const siteId = (formData.get("siteId") as string) || "";
  const format = (formData.get("format") as string) || "json";

  const platformTruth = await getRoutePlatformTruth();
  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind !== "ok") {
    redirect("/reports?report_error=no_org");
  }

  const params = new URLSearchParams({
    format,
    organizationId: orgRes.organizationId,
  });
  if (siteId) {
    params.set("siteId", siteId);
  }

  redirect(`/api/reports?${params.toString()}`);
}
