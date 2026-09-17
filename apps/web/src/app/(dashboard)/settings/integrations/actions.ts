"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getRoutePlatformTruth } from "@/lib/platform-truth-cache";
import { resolveDashboardOrgMembership, runOrgScopedQuery } from "@/lib/route-data-boundary";
import { hasPermission } from "@aros/config";
import { randomBytes } from "crypto";

export async function createIntegrationAction(formData: FormData) {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind !== "ok" || !hasPermission(orgRes.role, "integrations:manage")) {
    throw new Error("Unauthorized to configure integrations");
  }

  const type = formData.get("type") as "GITHUB" | "JIRA" | "SLACK" | "WEBHOOK";
  const name = (formData.get("name") as string)?.trim();
  const targetUrl = (formData.get("targetUrl") as string)?.trim();

  if (!type || !name) {
    throw new Error("Integration type and name are required");
  }

  await runOrgScopedQuery(orgRes, async (orgId) => {
    return prisma.integrationConnection.create({
      data: {
        organizationId: orgId,
        type,
        name,
        config: {
          targetUrl: targetUrl || undefined,
          configuredBy: user.email,
          configuredAt: new Date().toISOString(),
        },
        isActive: true,
      },
    });
  });

  revalidatePath("/settings/integrations");
  revalidatePath("/settings");
}

export async function toggleIntegrationAction(formData: FormData) {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind !== "ok" || !hasPermission(orgRes.role, "integrations:manage")) {
    throw new Error("Unauthorized to configure integrations");
  }

  const id = formData.get("id") as string;

  await runOrgScopedQuery(orgRes, async (orgId) => {
    const connection = await prisma.integrationConnection.findFirst({
      where: { id, organizationId: orgId },
    });

    if (!connection) {
      throw new Error("Integration connection not found");
    }

    return prisma.integrationConnection.update({
      where: { id },
      data: { isActive: !connection.isActive },
    });
  });

  revalidatePath("/settings/integrations");
  revalidatePath("/settings");
}

export async function deleteIntegrationAction(formData: FormData) {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind !== "ok" || !hasPermission(orgRes.role, "integrations:manage")) {
    throw new Error("Unauthorized to configure integrations");
  }

  const id = formData.get("id") as string;

  await runOrgScopedQuery(orgRes, async (orgId) => {
    return prisma.integrationConnection.deleteMany({
      where: { id, organizationId: orgId },
    });
  });

  revalidatePath("/settings/integrations");
  revalidatePath("/settings");
}

export async function createDeployWebhookAction(formData: FormData) {
  const user = await requireSession();
  const platformTruth = await getRoutePlatformTruth();
  const orgRes = await resolveDashboardOrgMembership(user.id, platformTruth);

  if (orgRes.kind !== "ok" || !hasPermission(orgRes.role, "integrations:manage")) {
    throw new Error("Unauthorized to configure webhooks");
  }

  const siteId = formData.get("siteId") as string;
  const source = formData.get("source") as "VERCEL" | "NETLIFY" | "GITHUB_DEPLOY" | "CUSTOM";
  const branchesRaw = (formData.get("branches") as string)?.trim() ?? "";
  const branches = branchesRaw
    ? branchesRaw.split(",").map((b) => b.trim()).filter(Boolean)
    : [];

  if (!siteId || !source) {
    throw new Error("Site and source are required");
  }

  const secret = `aros_wh_${randomBytes(24).toString("hex")}`;

  await runOrgScopedQuery(orgRes, async (orgId) => {
    return prisma.deployWebhook.create({
      data: {
        siteId,
        organizationId: orgId,
        source,
        secret,
        branches,
        isActive: true,
      },
    });
  });

  revalidatePath("/settings/integrations");
}
