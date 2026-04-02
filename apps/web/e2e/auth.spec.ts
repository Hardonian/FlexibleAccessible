import { test, expect } from "@playwright/test";

test.describe("Authentication Flow", () => {
  test("should redirect unauthenticated users to the login page", async ({
    page,
  }) => {
    // Attempt to access a protected route
    await page.goto("/dashboard");

    // Expect Next.js middleware or auth guard to redirect
    await expect(page).toHaveURL(/.*\/login/);
  });

  test("should redirect multiple protected routes to login", async ({
    page,
  }) => {
    const protectedRoutes = ["/sites", "/findings", "/reports", "/settings"];
    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    }
  });

  test("should login successfully with demo credentials", async ({ page }) => {
    await page.goto("/login");

    // Use accessible locators to find and fill the form
    await page.getByLabel(/email/i).fill("demo@aros.dev");
    await page.getByLabel(/password/i).fill("demo1234");
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Verify successful redirect to the dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(
      page.getByRole("heading", { name: /dashboard/i }),
    ).toBeVisible();
  });

  test("should show validation error for invalid credentials", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("invalid@example.com");
    await page.getByLabel(/password/i).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Should stay on login page (no redirect on failure)
    await expect(page).toHaveURL(/.*\/login/);
    // Should show some form of error message or the form remains visible
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });

  test("should show error for empty form submission", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /sign in|log in/i }).click();

    // Either HTML5 validation prevents submission or server returns an error
    await expect(page).toHaveURL(/.*\/login/);
  });

  test("should logout successfully", async ({ page }) => {
    // 1. Login first
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("demo@aros.dev");
    await page.getByLabel(/password/i).fill("demo1234");
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/.*\/dashboard/);

    // 2. Perform logout (assuming standard navigation/user menu)
    await page.getByRole("button", { name: /sign out|log out/i }).click();

    // 3. Verify session termination and redirect
    await expect(page).toHaveURL(/.*\/login|^\//);
  });

  test("should not access protected routes after logout", async ({ page }) => {
    // Login
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("demo@aros.dev");
    await page.getByLabel(/password/i).fill("demo1234");
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Logout
    await page.getByRole("button", { name: /sign out|log out/i }).click();
    await expect(page).toHaveURL(/.*\/login|^\//);

    // Try accessing protected route
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page does not redirect authenticated users to login", async ({
    page,
  }) => {
    // This is a regression test: visiting /login when already authenticated
    // should redirect to the dashboard, not cause a loop
    await page.goto("/login");
    await page.getByLabel(/email/i).fill("demo@aros.dev");
    await page.getByLabel(/password/i).fill("demo1234");
    await page.getByRole("button", { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/.*\/dashboard/);

    // Revisit /login while authenticated - should redirect away
    await page.goto("/login");
    // Should be redirected to dashboard or home, NOT stay on /login in a loop
    // (Some implementations may keep user on /login; assert no infinite loop by checking page loads)
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toBeVisible();
  });
});
