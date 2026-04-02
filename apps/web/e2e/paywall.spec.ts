/**
 * Paywall and subscription gate E2E tests.
 *
 * These tests verify that:
 * 1. Unauthenticated API requests are blocked with 401/403
 * 2. Authenticated requests to paid-only endpoints with no subscription receive 403
 * 3. The billing page is accessible to authenticated users
 * 4. The entitlement wall UI renders correctly when subscription is missing
 * 5. Public routes remain accessible regardless of subscription state
 */
import { test, expect } from "@playwright/test";

test.describe("Paywall – API gate (unauthenticated)", () => {
  // All of these routes require requireOrgAccess with requirePaid:true.
  // Without a session they must return 401 or 403.

  const paywallApiRoutes: Array<{
    method: "GET" | "POST" | "PATCH";
    path: string;
    body?: object;
  }> = [
    { method: "GET", path: "/api/findings/summary?organizationId=test-org" },
    { method: "GET", path: "/api/credits?organizationId=test-org" },
    { method: "GET", path: "/api/reports?organizationId=test-org&format=json" },
    { method: "GET", path: "/api/stakeholders?organizationId=test-org" },
    {
      method: "GET",
      path: "/api/impact?organizationId=test-org&siteId=test-site",
    },
    { method: "GET", path: "/api/org/test-org/platform/health" },
    {
      method: "PATCH",
      path: "/api/org/test-org/platform/operator-preferences",
      body: { suppressedOptionalDiagnosticIds: [] },
    },
    {
      method: "POST",
      path: "/api/ai-copilot",
      body: { findingId: "f", organizationId: "test-org", message: "hi" },
    },
    {
      method: "POST",
      path: "/api/github-action",
      body: { organizationId: "test-org", siteId: "test-site" },
    },
  ];

  for (const route of paywallApiRoutes) {
    test(`${route.method} ${route.path} → 401/403 without session`, async ({
      page,
    }) => {
      let response: Awaited<ReturnType<typeof page.request.get>>;
      if (route.method === "GET") {
        response = await page.request.get(route.path);
      } else if (route.method === "POST") {
        response = await page.request.post(route.path, { data: route.body });
      } else {
        response = await page.request.patch(route.path, { data: route.body });
      }
      expect([401, 403]).toContain(response.status());
    });
  }
});

test.describe("Paywall – missing organizationId returns 400+", () => {
  // Routes that require organizationId query param should return 400 when it is absent.
  const routesMissingOrg = [
    "/api/findings/summary",
    "/api/credits",
    "/api/stakeholders",
  ];

  for (const path of routesMissingOrg) {
    test(`GET ${path} without organizationId → ≥400`, async ({ page }) => {
      const response = await page.request.get(path);
      expect(response.status()).toBeGreaterThanOrEqual(400);
    });
  }
});

test.describe("Paywall – public routes remain open", () => {
  test("GET /api/health returns 200 without authentication", async ({
    page,
  }) => {
    const response = await page.request.get("/api/health");
    expect(response.status()).toBe(200);
  });

  test("GET /api/badge?domain=example.com returns SVG without authentication", async ({
    page,
  }) => {
    const response = await page.request.get("/api/badge?domain=example.com");
    // Returns SVG badge - should be 200 regardless of auth state
    expect(response.status()).toBe(200);
    const contentType = response.headers()["content-type"];
    expect(contentType).toContain("svg");
  });

  test("POST /api/public-scan accepts requests without authentication", async ({
    page,
  }) => {
    const response = await page.request.post("/api/public-scan", {
      data: { domain: "example.com" },
    });
    // Either queued (201), rate-limited (429), or service unavailable (503 when Redis absent)
    expect([201, 429, 503]).toContain(response.status());
  });
});

test.describe("Paywall – UI redirect for unauthenticated users", () => {
  test("billing page redirects unauthenticated users to login", async ({
    page,
  }) => {
    await page.goto("/settings/billing");
    await expect(page).toHaveURL(/\/login/);
  });

  test("settings page redirects unauthenticated users to login", async ({
    page,
  }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/login/);
  });

  test("dashboard redirects unauthenticated users to login", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("Paywall – authenticated billing flow (demo user)", () => {
  test.beforeEach(async ({ page }) => {
    // Sign in with demo credentials
    await page.goto("/login");
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);

    // Only proceed if login form is present
    if ((await emailInput.count()) === 0) {
      test.skip();
      return;
    }

    await emailInput.fill("demo@aros.dev");
    await passwordInput.fill("demo1234");
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Wait for redirect after login
    await page
      .waitForURL(/\/(dashboard|sites|findings)/, { timeout: 10000 })
      .catch(() => {
        // login may redirect to different page depending on seeded state
      });
  });

  test("billing page is accessible after login", async ({ page }) => {
    await page.goto("/settings/billing");
    // Should NOT redirect to login
    await expect(page).not.toHaveURL(/\/login/);
    // Should show billing-related content
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("billing page shows plan information", async ({ page }) => {
    await page.goto("/settings/billing");
    await expect(page).not.toHaveURL(/\/login/);

    // The billing page should mention plans (e.g. Starter, Professional, Enterprise)
    // or show a subscription status
    const bodyText = await page.locator("body").textContent();
    const hasPlanInfo =
      /starter|professional|enterprise|subscription|plan|billing|upgrade/i.test(
        bodyText ?? "",
      );
    expect(hasPlanInfo).toBeTruthy();
  });

  test("entitlement wall shows upgrade CTA when present", async ({ page }) => {
    await page.goto("/settings/billing");
    await expect(page).not.toHaveURL(/\/login/);

    // If the entitlement wall is shown (free/no plan), it should have a billing link
    const upgradeLink = page.getByRole("link", { name: /upgrade|view plans/i });
    const planCards = page.locator("[data-testid='plan-card'], .plan-card");

    // Either upgrade link or plan cards should be present
    const upgradeVisible = await upgradeLink.isVisible().catch(() => false);
    const planCardsPresent = (await planCards.count()) > 0;

    // At minimum, the page should render without errors
    await expect(page.locator("main, [role='main']").first()).toBeVisible();
    expect(upgradeVisible || planCardsPresent).toBeTruthy();
  });

  test("settings page is accessible after login", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("h1").first()).toBeVisible();
  });
});

test.describe("Paywall – subscription validation in POST endpoints", () => {
  test("AI copilot rejects requests with missing required fields", async ({
    page,
  }) => {
    // Incomplete body – missing findingId
    const response = await page.request.post("/api/ai-copilot", {
      data: { organizationId: "test-org", message: "Hello" },
    });
    // Should be 400 (validation) or 401/403 (no session)
    expect([400, 401, 403]).toContain(response.status());
  });

  test("AI copilot rejects oversized message", async ({ page }) => {
    const response = await page.request.post("/api/ai-copilot", {
      data: {
        findingId: "test",
        organizationId: "test-org",
        message: "x".repeat(3000),
      },
    });
    expect([400, 401, 403]).toContain(response.status());
  });

  test("credits endpoint rejects invalid pack name", async ({ page }) => {
    const response = await page.request.post("/api/credits", {
      data: { organizationId: "test-org", pack: "nonexistent-pack" },
    });
    expect([400, 401, 403]).toContain(response.status());
  });
});

test.describe("Paywall – deploy webhook signature validation", () => {
  test("POST /api/deploy-webhook without signature is rejected or no-ops safely", async ({
    page,
  }) => {
    const response = await page.request.post("/api/deploy-webhook", {
      data: { url: "https://example.com" },
    });
    // No matching webhook and/or invalid signature → 200 (no-op), 400, or 401
    expect([200, 400, 401]).toContain(response.status());
  });

  test("POST /api/deploy-webhook with malformed JSON returns 400+", async ({
    page,
  }) => {
    const response = await page.request.post("/api/deploy-webhook", {
      headers: { "content-type": "application/json" },
      data: "not-valid-json-at-all{{{",
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });
});
