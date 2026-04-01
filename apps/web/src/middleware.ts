import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PRIVATE_PAGE_PREFIXES = [
  "/dashboard",
  "/sites",
  "/findings",
  "/clusters",
  "/remediation",
  "/reviews",
  "/reports",
  "/settings",
  "/system",
];

const PUBLIC_API_PREFIXES = [
  "/api/public-scan",
  "/api/health",
  "/api/badge",
  "/api/og",
  "/api/webhooks/stripe",
  "/api/deploy-webhook",
];

function isPrivatePage(pathname: string) {
  return PRIVATE_PAGE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function isPublicMarketingPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/offline"
  );
}

function isPublicScanPath(pathname: string) {
  return pathname.startsWith("/scan/");
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const nonce = crypto.randomUUID().replace(/-/g, "");

  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://*.stripe.com;
    font-src 'self' data:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    frame-src 'self' https://js.stripe.com;
    connect-src 'self' https://api.stripe.com${process.env.NODE_ENV === "development" ? " ws: wss:" : ""};
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-pathname", pathname);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");

  if (request.nextUrl.protocol === "https:") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  if (
    isPrivatePage(pathname) ||
    (pathname.startsWith("/api/") && !isPublicApi(pathname))
  ) {
    response.headers.set(
      "Cache-Control",
      "private, no-store, max-age=0, must-revalidate",
    );
    response.headers.set("Vary", "Cookie");
    return response;
  }

  if (isPublicMarketingPath(pathname)) {
    response.headers.set(
      "Cache-Control",
      "public, max-age=0, s-maxage=900, stale-while-revalidate=3600",
    );
    return response;
  }

  if (isPublicScanPath(pathname)) {
    response.headers.set(
      "Cache-Control",
      "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|workbox-.*\\.js|fallback-.*\\.js).*)",
  ],
};
