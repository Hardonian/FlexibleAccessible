import { test, expect } from '@playwright/test';

test.describe('marketing smoke', () => {
  test('home page loads with honest product positioning', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Accessibility remediation');
    await expect(page.getByText(/not an overlay/i)).toBeVisible();
  });

  test('login page is reachable', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible();
  });
});
