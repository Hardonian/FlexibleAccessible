import { test, expect } from '@playwright/test';

const DEMO_EMAIL = 'demo@aros.dev';
const DEMO_PASSWORD = 'demo1234';

async function signInAsDemo(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(DEMO_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

test.describe('findings evidence workflow', () => {
  test('list, detail, remediation control, summary API', async ({ page }) => {
    await signInAsDemo(page);

    await page.goto('/findings');
    await expect(page.getByRole('heading', { name: 'Findings' })).toBeVisible();

    const firstFinding = page.locator('a[href^="/findings/"]').first();
    const count = await firstFinding.count();
    test.skip(count === 0, 'No seeded findings in database');

    await firstFinding.click();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const statusSelect = page.locator('#status-select');
    await expect(statusSelect).toBeVisible();
    await statusSelect.selectOption('ACKNOWLEDGED');
    await page.getByRole('button', { name: 'Apply status & note' }).click();
    await expect(page).toHaveURL(/\/findings\/[^/]+$/);
    await expect(page.getByText('Remediation history')).toBeVisible();

    const summaryStatus = await page.evaluate(async () => {
      const r = await fetch('/api/findings/summary', { credentials: 'include' });
      return { ok: r.ok, status: r.status };
    });
    expect(summaryStatus.ok).toBe(true);
    expect(summaryStatus.status).toBe(200);
  });
});
