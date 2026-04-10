-- Enterprise identity policy foundation (truthful partial SSO readiness + domain controls)
CREATE TYPE "AuthLoginMode" AS ENUM ('PASSWORD_AND_SSO', 'SSO_ONLY', 'PASSWORD_ONLY');
CREATE TYPE "OrgSsoConfigStatus" AS ENUM ('DISABLED', 'INCOMPLETE', 'CONFIGURED');

CREATE TABLE "organization_auth_policies" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "loginMode" "AuthLoginMode" NOT NULL DEFAULT 'PASSWORD_AND_SSO',
  "enforceVerifiedDomains" BOOLEAN NOT NULL DEFAULT false,
  "allowJitProvisioning" BOOLEAN NOT NULL DEFAULT false,
  "ssoConfigStatus" "OrgSsoConfigStatus" NOT NULL DEFAULT 'DISABLED',
  "ssoIssuerUrl" TEXT,
  "ssoEntryPoint" TEXT,
  "ssoMetadataUrl" TEXT,
  "scimBaseUrl" TEXT,
  "scimTokenLastRotatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_auth_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_auth_policies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "organization_auth_policies_organizationId_key" ON "organization_auth_policies"("organizationId");

CREATE TABLE "organization_verified_domains" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "verifiedAt" TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_verified_domains_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "organization_verified_domains_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "organization_verified_domains_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "organization_verified_domains_organizationId_domain_key" ON "organization_verified_domains"("organizationId", "domain");
CREATE INDEX "organization_verified_domains_organizationId_verifiedAt_idx" ON "organization_verified_domains"("organizationId", "verifiedAt");
CREATE INDEX "organization_verified_domains_createdByUserId_idx" ON "organization_verified_domains"("createdByUserId");
