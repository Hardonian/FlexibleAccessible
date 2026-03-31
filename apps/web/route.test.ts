import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route';

// Mock the Next.js headers/cookies module
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

import { cookies } from 'next/headers';

describe('API Route: GET /api/example-cookie', () => {
  it('should read the authorization header and theme cookie', async () => {
    // Arrange: Mock the cookie store to return a specific value
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'dark' }),
    } as any);

    // Arrange: Pass headers directly into the NextRequest constructor
    const request = new NextRequest('http://localhost:3000/api/example-cookie', {
      headers: {
        'Authorization': 'Bearer test-token',
      },
    });

    // Act
    const response = await GET(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.theme).toBe('dark');
  });

  it('should return 401 if Authorization header is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/example-cookie'); // No headers
    const response = await GET(request);
    
    expect(response.status).toBe(401);
  });
});