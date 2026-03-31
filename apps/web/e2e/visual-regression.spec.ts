import { test, expect } from '@playwright/test';

test.describe('Visual Regression Testing', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure a consistent viewport size for visual baselines
    await page.setViewportSize({ width: 1280, height: 800 });
    
    // Authenticate with the demo user
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('demo@aros.dev');
    await page.getByLabel(/password/i).fill('demo1234');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test('Dashboard UI remains pixel-perfect', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    
    // Take a screenshot, masking out potentially dynamic data elements
    // like timestamps or animated charts to prevent flaky visual regressions.
    await expect(page).toHaveScreenshot('dashboard-baseline.png', {
      fullPage: true,
      mask: [
        page.locator('time'), 
        page.locator('[data-test-id="dynamic-chart"]')
      ],
    });
  });

  test('Findings UI remains pixel-perfect', async ({ page }) => {
    await page.goto('/findings');
    await expect(page.getByRole('heading', { name: 'Findings' })).toBeVisible();
    await expect(page).toHaveScreenshot('findings-baseline.png', {
      fullPage: true,
    });
  });
});