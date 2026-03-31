import { vi, describe, it, expect, beforeEach } from 'vitest';
import { middleware } from './middleware';
import { NextRequest } from 'next/server';

describe('Next.js Middleware', () => {
  beforeEach(() => {
    // Reset any in-memory state if necessary, though the middleware is largely stateless
    vi.useFakeTimers();
  });

  it('should add security headers to the response', () => {
    // Arrange
    const request = new NextRequest('https://example.com/');

    // Act
    const response = middleware(request);

    // Assert
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  it('should generate and apply a Content-Security-Policy with a nonce', () => {
    // Arrange
    const request = new NextRequest('https://example.com/');

    // Act
    const response = middleware(request);

    // Assert
    const csp = response.headers.get('Content-Security-Policy');
    expect(csp).toContain("script-src 'self' 'nonce-");
    expect(csp).toContain("'strict-dynamic'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('should pass the nonce in request headers for Next.js to use', () => {
    // Arrange
    const request = new NextRequest('https://example.com/');

    // Act
    // The middleware returns a new response with modified request headers
    const response = middleware(request);
    const newRequestHeaders = response.headers; // In this test setup, they are on the response for inspection

    // Assert
    const csp = newRequestHeaders.get('Content-Security-Policy');
    const nonceHeader = newRequestHeaders.get('x-nonce');

    expect(nonceHeader).toBeTruthy();
    expect(csp).toContain(`'nonce-${nonceHeader}'`);
  });

  // Note: A full rate-limiting test would be more complex due to the in-memory Map.
  // This is a simplified check.
  it('should return 429 if rate limit is exceeded for an auth route', () => {
    const request = new NextRequest('https://example.com/login');
    // Simulate 21 requests to trigger the rate limit
    for (let i = 0; i < 21; i++) {
      middleware(request);
    }
    const finalResponse = middleware(request);
    expect(finalResponse.status).toBe(429);
  });
});