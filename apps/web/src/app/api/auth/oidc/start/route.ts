import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { generateToken } from "@aros/shared";
import { getOidcEnterpriseConfig } from "@/lib/auth/oidc-env";
import { OIDC_PENDING_COOKIE, signOidcState } from "@/lib/auth/oidc-state";

export const dynamic = "force-dynamic";

const PENDING_MAX_AGE = 600;

/**
 * GET /api/auth/oidc/start?returnTo=/dashboard&login_hint=user@corp.com
 * Redirects to the enterprise IdP authorization endpoint.
 */
export async function GET(request: Request) {
  const cfg = getOidcEnterpriseConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "OIDC enterprise SSO is not configured on this deployment." },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const returnTo = searchParams.get("returnTo") || "/dashboard";
  const loginHint = searchParams.get("login_hint")?.trim() || null;

  const issuerUrl = new URL(cfg.issuer);
  const discoveryUrl = new URL(
    ".well-known/openid-configuration",
    issuerUrl.href.endsWith("/") ? issuerUrl.href : `${issuerUrl.href}/`,
  );

  let discovery: { authorization_endpoint?: string };
  try {
    const res = await fetch(discoveryUrl.href, { cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Could not load OIDC discovery document" },
        { status: 502 },
      );
    }
    discovery = (await res.json()) as { authorization_endpoint?: string };
  } catch {
    return NextResponse.json(
      { error: "OIDC discovery request failed" },
      { status: 502 },
    );
  }

  if (!discovery.authorization_endpoint) {
    return NextResponse.json(
      { error: "Invalid OIDC discovery: missing authorization_endpoint" },
      { status: 502 },
    );
  }

  const nonce = generateToken();
  const jwt = await signOidcState({ nonce, returnTo, emailHint: loginHint });

  const cookieStore = await cookies();
  cookieStore.set(OIDC_PENDING_COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: PENDING_MAX_AGE,
    path: "/",
  });

  const authUrl = new URL(discovery.authorization_endpoint);
  authUrl.searchParams.set("client_id", cfg.clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("redirect_uri", cfg.redirectUri);
  authUrl.searchParams.set("state", nonce);
  authUrl.searchParams.set("nonce", nonce);
  if (loginHint) {
    authUrl.searchParams.set("login_hint", loginHint);
  }

  return NextResponse.redirect(authUrl.href);
}
