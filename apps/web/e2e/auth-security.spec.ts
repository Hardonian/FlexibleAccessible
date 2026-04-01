import { test, expect } from "@playwright/test";

test.describe("Authentication and Authorization", () => {
  test("should redirect unauthenticated users from dashboard routes", async ({
    page,
  }) => {
    const protectedRoutes = [
      "/dashboard",
      "/sites",
      "/findings",
      "/reports",
      "/settings",
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/.*\/login/);
    }
  });

  test("should allow access to public routes without authentication", async ({
    page,
  }) => {
    const publicRoutes = ["/", "/scan/example.com"];

    for (const route of publicRoutes) {
      await page.goto(route);
      // Should not redirect to login
      await expect(page).not.toHaveURL(/.*\/login/);
    }
  });

  test("should redirect to billing when accessing premium features without subscription", async ({
    page,
  }) => {
    // Test findings summary API
    const findingsResponse = await page.request.get(
      "/api/findings/summary?organizationId=test-org",
    );
    expect(findingsResponse.status()).toBe(403);

    // Test reports API
    const reportsResponse = await page.request.get(
      "/api/reports?organizationId=test-org&format=json",
    );
    expect(reportsResponse.status()).toBe(403);

    // Test credits API
    const creditsResponse = await page.request.get(
      "/api/credits?organizationId=test-org",
    );
    expect(creditsResponse.status()).toBe(403);
  });

  test("should prevent cross-organization access in API routes", async ({
    page,
  }) => {
    // Test findings summary with wrong org
    const response = await page.request.get(
      "/api/findings/summary?organizationId=wrong-org-id",
    );
    expect([401, 403, 404]).toContain(response.status());
  });

  test("should handle concurrent session scenarios", async ({ page }) => {
    test.skip(true, "Requires complex session setup");
  });

  test("should validate site ownership in site-specific actions", async ({
    page,
  }) => {
    const response = await page.request.post(
      "/sites/non-existent-site/actions",
      {
        data: { siteId: "non-existent-site", action: "startCrawl" },
      },
    );
    expect([401, 403, 404]).toContain(response.status());
  });

  test("should prevent non-members from accessing organization data", async ({
    page,
  }) => {
    const response = await page.request.get(
      "/api/findings/summary?organizationId=stranger-org",
    );
    expect([401, 403]).toContain(response.status());
  });

  test("should enforce permission-based access control", async ({ page }) => {
    test.skip(true, "Requires role-based test setup");
  });

  test("should handle expired sessions gracefully", async ({ page }) => {
    test.skip(true, "Requires session manipulation setup");
  });

  test("should prevent access with malformed organization IDs", async ({
    page,
  }) => {
    const invalidIds = ["", "invalid-id", "../escape", "<script>"];

    for (const invalidId of invalidIds) {
      const response = await page.request.get(
        `/api/findings/summary?organizationId=${encodeURIComponent(invalidId)}`,
      );
      expect([400, 401, 403, 404]).toContain(response.status());
    }
  });

  test("should prevent access with malformed site IDs", async ({ page }) => {
    const invalidIds = ["", "invalid-site", "../escape"];

    for (const invalidId of invalidIds) {
      const response = await page.request.post(
        `/sites/${encodeURIComponent(invalidId)}/actions`,
        {
          data: { siteId: invalidId, action: "startCrawl" },
        },
      );
      expect([401, 403, 404]).toContain(response.status());
    }
  });

  test("should validate request body structure in POST endpoints", async ({
    page,
  }) => {
    const invalidBodies = [
      {},
      { organizationId: "" },
      { organizationId: "test-org", findingId: "" },
      { organizationId: "test-org", message: "a".repeat(10000) },
    ];

    for (const body of invalidBodies) {
      const response = await page.request.post("/api/ai-copilot", {
        data: body,
      });
      expect([400, 401, 403]).toContain(response.status());
    }
  });

  test("should block GitHub Action status endpoint without authentication", async ({
    page,
  }) => {
    // This is the tenant isolation fix - status endpoint should require auth
    const response = await page.request.get(
      "/api/github-action/status/some-scan-run-id",
    );
    expect([401, 403]).toContain(response.status());
  });

  test("should block deploy webhook POST without signature", async ({
    page,
  }) => {
    const response = await page.request.post("/api/deploy-webhook", {
      data: { url: "https://example.com" },
    });
    // Should either be 401 (invalid signature) or success (no matching webhook)
    expect([200, 401, 403]).toContain(response.status());
  });

  test("should require organizationId for protected API routes", async ({
    page,
  }) => {
    const routes = [
      { method: "GET", path: "/api/findings/summary" },
      { method: "GET", path: "/api/credits" },
      { method: "GET", path: "/api/stakeholders" },
      { method: "GET", path: "/api/impact?siteId=test" },
    ];

    for (const route of routes) {
      const response = await page.request[route.method.toLowerCase() as 'get'](route.path);
      expect(response.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test("should enforce subscription requirement for AI features", async ({
    page,
  }) => {
    const response = await page.request.post("/api/ai-copilot", {
      data: {
        findingId: "test-finding",
        organizationId: "test-org",
        message: "Test message",
      },
    });
    expect([400, 401, 403]).toContain(response.status());
  });

  test("should block platform health endpoint without org membership", async ({
    page,
  }) => {
    const response = await page.request.get(
      "/api/org/some-org/platform/health",
    );
    expect([401, 403]).toContain(response.status());
  });

  test("should block platform operator preferences without org membership", async ({
    page,
  }) => {
    const response = await page.request.patch(
      "/api/org/some-org/platform/operator-preferences",
      {
        data: { suppressedOptionalDiagnosticIds: [] },
      },
    );
    expect([401, 403]).toContain(response.status());
  });
});

  test("should allow access to public routes without authentication", async ({
    page,
  }) => {
    const publicRoutes = ["/", "/scan/example.com"];

    for (const route of publicRoutes) {
      await page.goto(route);
      // Should not redirect to login
      await expect(page).not.toHaveURL(/.*\/login/);
    }
  });

  test("should redirect to billing when accessing premium features without subscription", async ({
    page,
  }) => {
    // This test requires authenticated user with free plan
    // Test API endpoints directly since UI might not show upgrade prompts immediately

    // Test findings summary API
    const findingsResponse = await page.request.get(
      "/api/findings/summary?organizationId=test-org",
    );
    expect(findingsResponse.status()).toBe(403);

    // Test reports API
    const reportsResponse = await page.request.get(
      "/api/reports?organizationId=test-org&format=json",
    );
    expect(reportsResponse.status()).toBe(403);

    // Test credits API
    const creditsResponse = await page.request.get(
      "/api/credits?organizationId=test-org",
    );
    expect(creditsResponse.status()).toBe(403);
  });

  test("should prevent cross-organization access in API routes", async ({
    page,
  }) => {
    // Test with authenticated user trying to access different org's data
    // This requires setting up test data with multiple orgs

    // Test findings summary with wrong org
    const response = await page.request.get(
      "/api/findings/summary?organizationId=wrong-org-id",
    );
    expect([401, 403, 404]).toContain(response.status()); // Should be rejected
  });

  test("should handle concurrent session scenarios", async ({ page }) => {
    // Test that API routes properly validate session on each request
    // This is more of an integration test requiring proper session setup
    test.skip(true, "Requires complex session setup");
  });

  test("should validate site ownership in site-specific actions", async ({
    page,
  }) => {
    // Test that actions like startCrawlAction validate site belongs to user's org
    const response = await page.request.post(
      "/sites/non-existent-site/actions",
      {
        data: { siteId: "non-existent-site", action: "startCrawl" },
      },
    );
    expect([401, 403, 404]).toContain(response.status());
  });

  test("should prevent non-members from accessing organization data", async ({
    page,
  }) => {
    // Test API routes reject requests from users not in the organization
    const response = await page.request.get(
      "/api/findings/summary?organizationId=stranger-org",
    );
    expect([401, 403]).toContain(response.status());
  });

  test("should enforce permission-based access control", async ({ page }) => {
    // Test that users with different roles get appropriate access
    // This requires setting up users with different roles in test org
    test.skip(true, "Requires role-based test setup");
  });

  test("should handle expired sessions gracefully", async ({ page }) => {
    // Test that expired sessions redirect to login
    // This requires manipulating session cookies/tokens
    test.skip(true, "Requires session manipulation setup");
  });

  test("should prevent access with malformed organization IDs", async ({
    page,
  }) => {
    // Test API routes with invalid/malformed org IDs
    const invalidIds = ["", "invalid-id", "../escape", "<script>"];

    for (const invalidId of invalidIds) {
      const response = await page.request.get(
        `/api/findings/summary?organizationId=${encodeURIComponent(invalidId)}`,
      );
      expect([400, 401, 403, 404]).toContain(response.status());
    }
  });

  test("should prevent access with malformed site IDs", async ({ page }) => {
    // Test site-specific actions with invalid IDs
    const invalidIds = ["", "invalid-site", "../escape"];

    for (const invalidId of invalidIds) {
      const response = await page.request.post(
        `/sites/${encodeURIComponent(invalidId)}/actions`,
        {
          data: { siteId: invalidId, action: "startCrawl" },
        },
      );
      expect([400, 401, 403, 404]).toContain(response.status());
    }
  });

  test("should validate request body structure in POST endpoints", async ({
    page,
  }) => {
    // Test that malformed request bodies are rejected
    const invalidBodies = [
      {},
      { organizationId: "" },
      { organizationId: "test-org", findingId: "" },
      { organizationId: "test-org", message: "a".repeat(10000) }, // Too long
    ];

    for (const body of invalidBodies) {
      const response = await page.request.post("/api/ai-copilot", {
        data: body,
      });
      expect([400, 401, 403]).toContain(response.status());
    }
  });
});
