import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should redirect unauthenticated users to the login page', async ({ page }) => {
    // Attempt to access a protected route
    await page.goto('/dashboard');
    
    // Expect Next.js middleware or auth guard to redirect
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('should login successfully with demo credentials', async ({ page }) => {
    await page.goto('/login');
    
    // Use accessible locators to find and fill the form
    await page.getByLabel(/email/i).fill('demo@aros.dev');
    await page.getByLabel(/password/i).fill('demo1234');
    await page.getByRole('button', { name: /sign in|log in/i }).click();

    // Verify successful redirect to the dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    // 1. Login first
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('demo@aros.dev');
    await page.getByLabel(/password/i).fill('demo1234');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/.*\/dashboard/);

    // 2. Perform logout (assuming standard navigation/user menu)
    await page.getByRole('button', { name: /sign out|log out/i }).click();

    // 3. Verify session termination and redirect
    await expect(page).toHaveURL(/.*\/login|^\/$/);
  });
});