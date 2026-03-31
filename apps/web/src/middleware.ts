import { NextResponse } from 'next/server';


export function middleware() {
  // Create a response object to append headers to
  const response = NextResponse.next();

  // Define Content Security Policy
  // Note: Add external domains (like analytics, fonts, or external images) here as needed.
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com;
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