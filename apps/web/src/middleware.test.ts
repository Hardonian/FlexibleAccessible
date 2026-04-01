import { describe, it, expect } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

describe('Next.js Middleware', () => {
  it('adds baseline security headers', () => {
    const response = middleware(new NextRequest('https://example.com/'));

    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=');
  });

  it('sets a nonce-bearing content security policy', () => {
    const response = middleware(new NextRequest('https://example.com/'));
    const csp = response.headers.get('Content-Security-Policy');

    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('marks private dashboard routes as no-store', () => {
    const response = middleware(new NextRequest('https://example.com/dashboard'));

    expect(response.headers.get('Cache-Control')).toBe(
      'private, no-store, max-age=0, must-revalidate',
    );
    expect(response.headers.get('Vary')).toBe('Cookie');
  });

  it('allows marketing pages to be publicly cacheable', () => {
    const response = middleware(new NextRequest('https://example.com/'));

    expect(response.headers.get('Cache-Control')).toContain('public');
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=900');
  });

  it('keeps public scan result pages cacheable but short-lived', () => {
    const response = middleware(new NextRequest('https://example.com/scan/example.com'));

    expect(response.headers.get('Cache-Control')).toContain('public');
    expect(response.headers.get('Cache-Control')).toContain('s-maxage=60');
  });
});
