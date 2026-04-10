import { prisma } from "@/lib/db";
import type { AuthLoginMode, OrgSsoConfigStatus } from "@aros/db";

export interface OrgIdentitySnapshot {
  policy: {
    loginMode: AuthLoginMode;
    enforceVerifiedDomains: boolean;
    allowJitProvisioning: boolean;
    ssoConfigStatus: OrgSsoConfigStatus;
    ssoIssuerUrl: string | null;
    ssoEntryPoint: string | null;
    ssoMetadataUrl: string | null;
    scimBaseUrl: string | null;
    scimTokenLastRotatedAt: Date | null;
  };
  verifiedDomains: Array<{ id: string; domain: string; verifiedAt: Date | null }>;
  enforcementState: "open" | "restricted" | "misconfigured";
  statusSummary: string;
}

export async function getOrgIdentitySnapshot(organizationId: string): Promise<OrgIdentitySnapshot> {
  const [policy, verifiedDomains] = await Promise.all([
    prisma.organizationAuthPolicy.findUnique({ where: { organizationId } }),
    prisma.organizationVerifiedDomain.findMany({
      where: { organizationId },
      select: { id: true, domain: true, verifiedAt: true },
      orderBy: [{ verifiedAt: "desc" }, { domain: "asc" }],
    }),
  ]);

  const normalizedPolicy = {
    loginMode: policy?.loginMode ?? "PASSWORD_AND_SSO",
    enforceVerifiedDomains: policy?.enforceVerifiedDomains ?? false,
    allowJitProvisioning: policy?.allowJitProvisioning ?? false,
    ssoConfigStatus: policy?.ssoConfigStatus ?? "DISABLED",
    ssoIssuerUrl: policy?.ssoIssuerUrl ?? null,
    ssoEntryPoint: policy?.ssoEntryPoint ?? null,
    ssoMetadataUrl: policy?.ssoMetadataUrl ?? null,
    scimBaseUrl: policy?.scimBaseUrl ?? null,
    scimTokenLastRotatedAt: policy?.scimTokenLastRotatedAt ?? null,
  } as const;

  if (
    normalizedPolicy.enforceVerifiedDomains &&
    verifiedDomains.filter((d) => d.verifiedAt).length === 0
  ) {
    return {
      policy: normalizedPolicy,
      verifiedDomains,
      enforcementState: "misconfigured",
      statusSummary:
        "Domain enforcement is enabled, but no verified domains exist. Invites and strict policy checks should remain blocked until at least one domain is verified.",
    };
  }

  if (
    normalizedPolicy.loginMode === "SSO_ONLY" &&
    normalizedPolicy.ssoConfigStatus !== "CONFIGURED"
  ) {
    return {
      policy: normalizedPolicy,
      verifiedDomains,
      enforcementState: "misconfigured",
      statusSummary:
        "SSO-only login is selected, but enterprise SSO config is not fully configured.",
    };
  }

  if (
    normalizedPolicy.loginMode !== "PASSWORD_AND_SSO" ||
    normalizedPolicy.enforceVerifiedDomains
  ) {
    return {
      policy: normalizedPolicy,
      verifiedDomains,
      enforcementState: "restricted",
      statusSummary: "Organization login policy has enforced restrictions.",
    };
  }

  return {
    policy: normalizedPolicy,
    verifiedDomains,
    enforcementState: "open",
    statusSummary: "Password and SSO login are both allowed with no domain restrictions.",
  };
}

export function emailMatchesVerifiedDomains(email: string, domains: string[]): boolean {
  const domain = email.toLowerCase().split("@")[1] ?? "";
  return domains.map((d) => d.toLowerCase()).includes(domain);
}
