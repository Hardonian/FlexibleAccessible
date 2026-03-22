import { test, expect } from '@playwright/test';

const DEMO_EMAIL = 'demo@aros.dev';
const DEMO_PASSWORD = 'demo1234';

test.describe('authentication', () => {
  test('sign in with seeded demo user reaches dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill(DEMO_EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByText(DEMO_EMAIL)).toBeVisible();
  });

  test('sign out returns to login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email address').fill(DEMO_EMAIL);
    await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible();
  });

  test('full signup creates org and lands on dashboard', async ({ page }) => {
    const suffix = `${Date.now()}`;
    const email = `e2e.user.${suffix}@example.test`;
    const orgName = `E2E Org ${suffix}`;

    await page.goto('/signup');
    await page.getByLabel('Full name').fill('E2E Tester');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('e2e-password-ok-8');
    await page.getByLabel('Organization name').fill(orgName);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText(orgName)).toBeVisible();
  });
});
