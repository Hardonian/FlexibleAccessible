"use server";

import { revalidatePath } from "next/cache";
import { requireOrgAccess } from "@/lib/auth-guard";
import { prisma } from "@/lib/db";
import { runOrgScopedQuery } from "@/lib/route-data-boundary";
import type { AuthLoginMode, OrgSsoConfigStatus } from "@aros/db";

interface ActionState {
  success: boolean;
  error: string | null;
}

const DOMAIN_REGEX = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function normalizeUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return `${url.protocol}//${url.host}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export async function updateIdentityPolicyAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const loginMode = String(formData.get("loginMode") ?? "PASSWORD_AND_SSO") as AuthLoginMode;
  const enforceVerifiedDomains = formData.get("enforceVerifiedDomains") === "on";
  const allowJitProvisioning = formData.get("allowJitProvisioning") === "on";
  const ssoConfigStatus = String(formData.get("ssoConfigStatus") ?? "DISABLED") as OrgSsoConfigStatus;

  const ssoIssuerUrl = normalizeUrl(String(formData.get("ssoIssuerUrl") ?? ""));
  const ssoEntryPoint = normalizeUrl(String(formData.get("ssoEntryPoint") ?? ""));
  const ssoMetadataUrl = normalizeUrl(String(formData.get("ssoMetadataUrl") ?? ""));
  const scimBaseUrl = normalizeUrl(String(formData.get("scimBaseUrl") ?? ""));

  if (!organizationId) return { success: false, error: "Organization is required." };

  const ctx = await requireOrgAccess(organizationId, "org:manage");

  if (loginMode === "SSO_ONLY" && ssoConfigStatus !== "CONFIGURED") {
    return {
      success: false,
      error: "SSO-only mode requires SSO status set to configured.",
    };
  }

  const writeRes = await runOrgScopedQuery(ctx, async (orgId) => {
    const policy = await prisma.organizationAuthPolicy.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        loginMode,
        enforceVerifiedDomains,
        allowJitProvisioning,
        ssoConfigStatus,
        ssoIssuerUrl,
        ssoEntryPoint,
        ssoMetadataUrl,
        scimBaseUrl,
      },
      update: {
        loginMode,
        enforceVerifiedDomains,
        allowJitProvisioning,
        ssoConfigStatus,
        ssoIssuerUrl,
        ssoEntryPoint,
        ssoMetadataUrl,
        scimBaseUrl,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: ctx.user.id,
        action: "auth_policy:update",
        entityType: "organization_auth_policy",
        entityId: policy.id,
        metadata: {
          loginMode,
          enforceVerifiedDomains,
          allowJitProvisioning,
          ssoConfigStatus,
          hasIssuer: Boolean(ssoIssuerUrl),
          hasEntryPoint: Boolean(ssoEntryPoint),
          hasMetadataUrl: Boolean(ssoMetadataUrl),
          hasScimBaseUrl: Boolean(scimBaseUrl),
        },
      },
    });
  });

  if (!writeRes.ok) return { success: false, error: writeRes.message };

  revalidatePath("/settings/identity");
  revalidatePath("/settings/members");
  return { success: true, error: null };
}

export async function addVerifiedDomainAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const domainRaw = String(formData.get("domain") ?? "").trim().toLowerCase();
  const markVerified = formData.get("markVerified") === "on";

  if (!organizationId) return { success: false, error: "Organization is required." };
  if (!DOMAIN_REGEX.test(domainRaw)) return { success: false, error: "Enter a valid domain (example.com)." };

  const ctx = await requireOrgAccess(organizationId, "org:manage");
  const result = await runOrgScopedQuery(ctx, async (orgId) => {
    const record = await prisma.organizationVerifiedDomain.upsert({
      where: {
        organizationId_domain: {
          organizationId: orgId,
          domain: domainRaw,
        },
      },
      create: {
        organizationId: orgId,
        domain: domainRaw,
        createdByUserId: ctx.user.id,
        verifiedAt: markVerified ? new Date() : null,
      },
      update: {
        verifiedAt: markVerified ? new Date() : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        userId: ctx.user.id,
        action: "auth_policy:domain_upsert",
        entityType: "organization_verified_domain",
        entityId: record.id,
        metadata: { domain: domainRaw, verified: Boolean(record.verifiedAt) },
      },
    });
  });

  if (!result.ok) return { success: false, error: result.message };
  revalidatePath("/settings/identity");
  return { success: true, error: null };
}

export async function removeVerifiedDomainAction(formData: FormData): Promise<void> {
  const organizationId = String(formData.get("organizationId") ?? "");
  const domainId = String(formData.get("domainId") ?? "");
  if (!organizationId || !domainId) return;

  const ctx = await requireOrgAccess(organizationId, "org:manage");
  await runOrgScopedQuery(ctx, async (orgId) => {
    const deleted = await prisma.organizationVerifiedDomain.deleteMany({
      where: { id: domainId, organizationId: orgId },
    });

    if (deleted.count > 0) {
      await prisma.auditLog.create({
        data: {
          organizationId: orgId,
          userId: ctx.user.id,
          action: "auth_policy:domain_remove",
          entityType: "organization_verified_domain",
          entityId: domainId,
        },
      });
    }
  });

  revalidatePath("/settings/identity");
}
