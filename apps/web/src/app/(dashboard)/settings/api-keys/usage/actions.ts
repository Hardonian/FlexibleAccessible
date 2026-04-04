"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { requireOrgAccess } from "@/lib/auth-guard";
import { hasPermission } from "@aros/config";
import { getOrgUsageSummary, checkQuotaThreshold } from "@/lib/mcp-billing";

interface UsageDataResult {
  success: boolean;
  error?: string;
  data?: {
    summary: Awaited<ReturnType<typeof getOrgUsageSummary>>;
    quota: Awaited<ReturnType<typeof checkQuotaThreshold>>;
  };
}

/**
 * Server action to fetch MCP usage data for a given time period.
 * Used by the usage dashboard to update data when changing time ranges.
 */
export async function getMcpUsageDataAction(
  formData: FormData,
): Promise<UsageDataResult> {
  const organizationId = (formData.get("organizationId") as string) ?? "";
  const daysRaw = (formData.get("days") as string) ?? "30";
  const days = parseInt(daysRaw, 10);

  if (!organizationId) {
    return { success: false, error: "Organization ID is required" };
  }

  if (isNaN(days) || days < 1 || days > 365) {
    return { success: false, error: "Invalid day range" };
  }

  // Permission check - require integrations:read permission
  const ctx = await requireOrgAccess(organizationId);
  if (!hasPermission(ctx.role, "integrations:view")) {
    return {
      success: false,
      error: "You don't have permission to view API usage data",
    };
  }

  try {
    const [summary, quota] = await Promise.all([
      getOrgUsageSummary(organizationId, days),
      checkQuotaThreshold(organizationId),
    ]);

    return {
      success: true,
      data: { summary, quota },
    };
  } catch (error) {
    console.error("[usage actions] Failed to fetch usage data:", error);
    return {
      success: false,
      error: "Failed to fetch usage data. Please try again.",
    };
  }
}

/**
 * Revalidate the usage page cache.
 * Can be called after actions that might affect usage data.
 */
export async function revalidateUsagePage(
  organizationId: string,
): Promise<void> {
  const ctx = await requireOrgAccess(organizationId);
  if (!hasPermission(ctx.role, "integrations:manage")) {
    return;
  }

  revalidatePath("/settings/api-keys/usage");
}
