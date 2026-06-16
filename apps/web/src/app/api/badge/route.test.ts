import { expect, test, vi, describe, beforeEach } from 'vitest';
import { GET } from './route';
import * as validity from '@/lib/public-scan/validity';

vi.mock('@/lib/public-scan/validity', () => ({
  getLatestValidPublicScanForDomain: vi.fn(),
}));

describe('GET /api/badge', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test('Missing domain parameter', async () => {
    const req = new Request('http://localhost/api/badge');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  test('Invalid domain parameter', async () => {
    const req = new Request('http://localhost/api/badge?domain=invalid/domain');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  test('Valid domain, score returned', async () => {
    const mockValidity = vi.mocked(validity.getLatestValidPublicScanForDomain);
    mockValidity.mockResolvedValue({ score: 85, totalViolations: 10 } as any);

    const req = new Request('http://localhost/api/badge?domain=example.com');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const text = await res.text();
    expect(text).toContain('85/100');
  });

  test('Valid domain, score not found', async () => {
    const mockValidity = vi.mocked(validity.getLatestValidPublicScanForDomain);
    mockValidity.mockRejectedValue(new Error('Not found'));

    const req = new Request('http://localhost/api/badge?domain=example.com');
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  test('Includes security headers', async () => {
    const req = new Request('http://localhost/api/badge?domain=example.com');
    const res = await GET(req);

    expect(res.headers.get('Content-Security-Policy')).toBe("default-src 'none'; style-src 'unsafe-inline'; sandbox;");
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
  });

  test('Escapes malicious domain parameter in origin header', async () => {
    // If domain has quotes, wait, validDomain rejects spaces, slashes, etc.
    const req = new Request('http://localhost/api/badge?domain=example.com');
    const res = await GET(req);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
  });
});
