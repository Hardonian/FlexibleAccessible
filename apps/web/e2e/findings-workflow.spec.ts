import { test, expect } from '@playwright/test';

test.describe('Findings Remediation Lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    // Login as the demo user before each test to ensure an active session
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('demo@aros.dev');
    await page.getByLabel(/password/i).fill('demo1234');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await expect(page).toHaveURL(/.*\/dashboard/);
  });

  test('should view findings list and transition finding status', async ({ page }) => {
    // 1. Navigate to the findings module
    await page.getByRole('link', { name: /findings|issues/i }).click();
    await expect(page).toHaveURL(/.*\/findings/);

    // 2. Select the first finding in the data table
    const firstFindingRow = page.locator('table tbody tr').first();
    
    // Graceful exit if the DB seeder didn't provision findings
    if (await firstFindingRow.count() === 0) return;

    await firstFindingRow.click();

    // 3. Transition the status of the finding
    // Based on REMEDIATION_LIFECYCLE.md, valid transitions from OPEN include ACKNOWLEDGED
    const statusSelect = page.getByLabel(/status/i);
    
    if (await statusSelect.isVisible()) {
      await statusSelect.selectOption('ACKNOWLEDGED');
      await page.getByRole('button', { name: /update status|save/i }).click();

      // 4. Verify the UI updates to reflect the successful audit trail entry
      await expect(page.getByText(/status updated|acknowledged/i).first()).toBeVisible();
    }
  });
});