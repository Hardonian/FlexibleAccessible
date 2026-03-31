import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from './route'; // Assuming your actual health route is here

// 1. Mock the core-services orchestrator functions
vi.mock('@aros/core-services', () => ({
  collectPlatformHealth: vi.fn(),
  toPublicHealthSummary: vi.fn(),
}));

import { collectPlatformHealth, toPublicHealthSummary } from '@aros/core-services';

describe('API Route: GET /api/health', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should return 200 OK when the platform orchestrator reports ready', async () => {
    // Arrange: Simulate a healthy platform state
    vi.mocked(collectPlatformHealth).mockResolvedValue({} as any);
    vi.mocked(toPublicHealthSummary).mockReturnValue({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });

    const request = new NextRequest('http://localhost:3000/api/health');

    // Act
    const response = await GET(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.status).toBe('ready');
    expect(collectPlatformHealth).toHaveBeenCalledOnce();
    expect(toPublicHealthSummary).toHaveBeenCalledOnce();
  });

  it('should return 503 Service Unavailable when the platform is degraded or unavailable', async () => {
    // Arrange: Simulate a missing database or failed Redis connection
    vi.mocked(collectPlatformHealth).mockResolvedValue({} as any);
    vi.mocked(toPublicHealthSummary).mockReturnValue({
      status: 'unavailable',
      timestamp: new Date().toISOString(),
    });

    const request = new NextRequest('http://localhost:3000/api/health');

    // Act
    const response = await GET(request);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(503);
    expect(data.status).toBe('unavailable');
  });
});