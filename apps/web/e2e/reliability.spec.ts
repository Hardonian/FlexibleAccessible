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

test.describe('reliability surfaces', () => {
  test('system page lists core service rows from live health', async ({ page }) => {
    await signInAsDemo(page);
    await page.goto('/system');
    await expect(page.getByRole('heading', { name: /system & core services/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /first-run/i })).toBeVisible();
    await expect(page.getByTestId('platform-recheck-button')).toBeVisible();

    const list = page.getByTestId('core-services-list');
    await expect(list).toBeVisible();
    const articles = list.locator('article[data-service-id]');
    await expect(articles).toHaveCount(await articles.count());
    expect(await articles.count()).toBeGreaterThan(0);

    await expect(list.locator('[data-service-id="database"]')).toBeVisible();
    await expect(list.locator('[data-service-id="worker-runtime"]')).toBeVisible();
  });

  test('dashboard renders org overview without error when platform is healthy', async ({ page }) => {
    await signInAsDemo(page);
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText(/overview for/i)).toBeVisible();
    const res = await page.goto('/dashboard');
    expect(res?.status()).toBeLessThan(500);
  });

  test('findings page distinguishes empty org data from hard failure when DB is up', async ({ page }) => {
    await signInAsDemo(page);
    await page.goto('/findings');
    await expect(page.getByRole('heading', { name: 'Findings' })).toBeVisible();
    await expect(page.getByText(/accessibility issues found/i)).toBeVisible();
    await expect(page.getByText(/findings unavailable/i)).not.toBeVisible();
  });
});
