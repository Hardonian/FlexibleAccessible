import { test, expect } from '@playwright/test';

test.describe('API Health Endpoints', () => {
  
  // This test hits the public, unauthenticated health check endpoint.
  test('GET /api/health should return a ready status', async ({ request }) => {
    const response = await request.get('/api/health');
    
    expect(response.ok()).toBeTruthy();
    
    const body = await response.json();
    expect(body).toHaveProperty('status', 'ready');
    expect(body).toHaveProperty('timestamp');
    // Ensure no sensitive data is leaked
    expect(body).not.toHaveProperty('db');
    expect(body).not.toHaveProperty('redis');
  });

  // This test requires authentication, which is handled by `global-setup.mjs`
  // It hits the detailed, authenticated platform health endpoint.
  test('GET /api/org/{orgId}/platform/health should return detailed status for authenticated users', async ({ request }) => {
    // Note: The organizationId would typically come from the logged-in user's context.
    // For this test, we'll assume a known ID from the seeded demo data.
    const organizationId = 'org_2i3f7a7a7a7a7a7a7a7a7a7a7a'; // Replace with actual demo org ID if different

    const response = await request.get(`/api/org/${organizationId}/platform/health`);

    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('status', 'ready');
    expect(body).toHaveProperty('services');
    expect(Array.isArray(body.services)).toBe(true);
    const dbService = body.services.find((s: any) => s.name === 'PostgreSQL');
    expect(dbService).toBeDefined();
    expect(dbService.status).toBe('ready');
  });
});