/**
 * Optional OpenID Connect (OIDC) enterprise SSO. When unset, routes stay disabled.
 */

import { getAppBaseUrl } from "@/lib/site-url";

export type OidcEnterpriseConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** If set, only emails under this domain may use SSO (e.g. acme.com). */
  emailDomain: string | null;
  /** Create user + default org on first successful SSO (mirrors self-serve signup shape). */
  jitSignup: boolean;
  /** Link IdP subject to an existing account with the same verified email (never overwrites passwordHash). */
  linkExistingByEmail: boolean;
};

function truthy(v: string | undefined): boolean {
  return v === "1" || v?.toLowerCase() === "true";
}

export function getOidcEnterpriseConfig(): OidcEnterpriseConfig | null {
  const issuer = process.env.OIDC_ISSUER?.trim().replace(/\/$/, "");
  const clientId = process.env.OIDC_CLIENT_ID?.trim();
  const clientSecret = process.env.OIDC_CLIENT_SECRET?.trim();
  if (!issuer || !clientId || !clientSecret) {
    return null;
  }

  const base =
    process.env.OIDC_REDIRECT_URI?.trim() ||
    `${getAppBaseUrl()}/api/auth/oidc/callback`;

  return {
    issuer,
    clientId,
    clientSecret,
    redirectUri: base,
    emailDomain: process.env.OIDC_EMAIL_DOMAIN?.trim().toLowerCase() || null,
    jitSignup: truthy(process.env.OIDC_JIT_SIGNUP),
    linkExistingByEmail: truthy(process.env.OIDC_LINK_EXISTING_EMAIL),
  };
}

export function emailAllowedForOidcDomain(
  email: string,
  domain: string | null,
): boolean {
  if (!domain) return true;
  const norm = email.trim().toLowerCase();
  const suffix = `@${domain.toLowerCase()}`;
  return norm.endsWith(suffix);
}
