import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/session";
import { getOidcEnterpriseConfig, emailAllowedForOidcDomain } from "@/lib/auth/oidc-env";
import { OIDC_PENDING_COOKIE, verifyOidcState } from "@/lib/auth/oidc-state";
import { provisionUserFromOidc } from "@/lib/auth/oidc-provisioning";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cfg = getOidcEnterpriseConfig();
  if (!cfg) {
    return NextResponse.redirect(new URL("/login?oidc=disabled", request.url).href);
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error_description") || url.searchParams.get("error");

  const cookieStore = await cookies();
  const pending = cookieStore.get(OIDC_PENDING_COOKIE)?.value;
  cookieStore.delete(OIDC_PENDING_COOKIE);

  if (err) {
    return NextResponse.redirect(
      new URL(
        `/login?oidc=error&message=${encodeURIComponent(err)}`,
        request.url,
      ).href,
    );
  }

  if (!code || !state || !pending) {
    return NextResponse.redirect(
      new URL("/login?oidc=error&message=missing_code_or_state", request.url).href,
    );
  }

  const payload = await verifyOidcState(pending);
  if (!payload || payload.nonce !== state) {
    return NextResponse.redirect(
      new URL("/login?oidc=error&message=invalid_state", request.url).href,
    );
  }

  const issuerUrl = new URL(cfg.issuer);
  const discoveryHref = new URL(
    ".well-known/openid-configuration",
    issuerUrl.href.endsWith("/") ? issuerUrl.href : `${issuerUrl.href}/`,
  ).href;

  let discovery: {
    token_endpoint?: string;
    jwks_uri?: string;
    issuer?: string;
  };
  try {
    const res = await fetch(discoveryHref);
    if (!res.ok) {
      return NextResponse.redirect(
        new URL("/login?oidc=error&message=discovery_failed", request.url).href,
      );
    }
    discovery = (await res.json()) as typeof discovery;
  } catch {
    return NextResponse.redirect(
      new URL("/login?oidc=error&message=discovery_failed", request.url).href,
    );
  }

  if (!discovery.token_endpoint || !discovery.jwks_uri) {
    return NextResponse.redirect(
      new URL("/login?oidc=error&message=bad_discovery", request.url).href,
    );
  }

  const tokenRes = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: cfg.redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(
      new URL("/login?oidc=error&message=token_exchange_failed", request.url).href,
    );
  }

  const tokens = (await tokenRes.json()) as { id_token?: string };
  if (!tokens.id_token) {
    return NextResponse.redirect(
      new URL("/login?oidc=error&message=no_id_token", request.url).href,
    );
  }

  const JWKS = createRemoteJWKSet(new URL(discovery.jwks_uri));
  let idClaims: import("jose").JWTPayload;
  try {
    const { payload: claims } = await jwtVerify(tokens.id_token, JWKS, {
      issuer: discovery.issuer ?? cfg.issuer,
      audience: cfg.clientId,
    });
    idClaims = claims;
  } catch {
    return NextResponse.redirect(
      new URL("/login?oidc=error&message=id_token_invalid", request.url).href,
    );
  }

  if (idClaims.nonce !== state) {
    return NextResponse.redirect(
      new URL("/login?oidc=error&message=nonce_mismatch", request.url).href,
    );
  }

  const emailRaw =
    (typeof idClaims.email === "string" && idClaims.email) ||
    (typeof idClaims.preferred_username === "string" &&
    idClaims.preferred_username.includes("@")
      ? idClaims.preferred_username
      : null);

  if (!emailRaw) {
    return NextResponse.redirect(
      new URL(
        "/login?oidc=error&message=id_token_missing_email",
        request.url,
      ).href,
    );
  }

  const email = emailRaw.trim().toLowerCase();
  if (!emailAllowedForOidcDomain(email, cfg.emailDomain)) {
    return NextResponse.redirect(
      new URL("/login?oidc=error&message=email_domain_not_allowed", request.url).href,
    );
  }

  const name =
    typeof idClaims.name === "string"
      ? idClaims.name
      : typeof idClaims.given_name === "string"
        ? idClaims.given_name
        : null;

  const sub = typeof idClaims.sub === "string" ? idClaims.sub : "";
  if (!sub) {
    return NextResponse.redirect(
      new URL("/login?oidc=error&message=id_token_missing_sub", request.url).href,
    );
  }

  const expectedIssuer = (discovery.issuer ?? cfg.issuer).replace(/\/$/, "");

  try {
    const { userId } = await provisionUserFromOidc(
      prisma,
      {
        email,
        name,
        issuer: expectedIssuer,
        subject: sub,
      },
      {
        jitSignup: cfg.jitSignup,
        linkExistingByEmail: cfg.linkExistingByEmail,
      },
    );

    await createSession(userId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "provision_failed";
    return NextResponse.redirect(
      new URL(`/login?oidc=error&message=${encodeURIComponent(msg)}`, request.url).href,
    );
  }

  const safeReturn =
    payload.returnTo.startsWith("/") && !payload.returnTo.startsWith("//")
      ? payload.returnTo
      : "/dashboard";

  return NextResponse.redirect(new URL(safeReturn, request.url).href);
}
