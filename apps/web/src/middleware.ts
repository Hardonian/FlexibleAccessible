import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Generate a strict cryptographic nonce for inline scripts
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // Define Content Security Policy
  // 'strict-dynamic' allows dynamically created scripts from trusted sources
  // 'unsafe-eval' is conditionally included only for Next.js HMR in development
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data: https://*.stripe.com;
    font-src 'self' data:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    frame-src 'self' https://js.stripe.com;
    upgrade-insecure-requests;
  `.replace(/\s{2,}/g, ' ').trim(); // Compress whitespace for a cleaner header payload

  // Next.js needs the CSP header on the request object to inject nonces into SSR rendered scripts
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Apply Security Headers
  response.headers.set('Content-Security-Policy', cspHeader);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  
  return response;
}

// Only run middleware on actual document/API routes, skipping Next.js static assets
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest).*)',
  ],
};