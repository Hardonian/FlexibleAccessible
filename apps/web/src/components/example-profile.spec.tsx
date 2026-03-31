import { test, expect } from '@playwright/experimental-ct-react';
import { ExampleProfile } from './example-profile';
import AxeBuilder from '@axe-core/playwright';

test.use({ viewport: { width: 500, height: 500 } });

test('should render profile and handle Next.js mocked modules', async ({ page, mount }) => {
  // 1. Mount the React component in a real browser
  const component = await mount(
    <ExampleProfile name="Jane Doe" avatarUrl="/test-avatar.png" />
  );

  // 2. Verify Next/Image mock (renders as a standard img tag)
  const img = component.locator('img');
  await expect(img).toHaveAttribute('src', '/test-avatar.png');
  await expect(img).toHaveAttribute('alt', "Jane Doe's avatar");

  // 3. Verify Next/Link mock (renders as a standard a tag)
  const link = component.locator('a', { hasText: 'Sign out' });
  await expect(link).toHaveAttribute('href', '/logout');

  // 4. Verify text content
  await expect(component).toContainText('Jane Doe');

  // Prepare to capture the router.push call from our custom mock
  const pushPromise = page.evaluate(() => {
    return new Promise((resolve) => {
      window.addEventListener('mock-router-push', (e: any) => resolve(e.detail), { once: true });
    });
  });

  // 5. Interact with Next/Navigation mock
  await component.locator('button', { hasText: 'Account Settings' }).click();

  // 6. Assert router.push was called with correct arguments
  const pushedUrl = await pushPromise;
  expect(pushedUrl).toBe('/settings');
});

test('should not have any automatically detectable accessibility issues', async ({ page, mount }) => {
  await mount(<ExampleProfile name="Jane Doe" avatarUrl="/test-avatar.png" />);
  
  const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});