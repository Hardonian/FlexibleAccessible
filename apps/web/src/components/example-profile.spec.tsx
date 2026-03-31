import { test, expect } from '@playwright/experimental-ct-react';
import { ExampleProfile } from './example-profile';

test.use({ viewport: { width: 500, height: 500 } });

test('should render profile and handle Next.js mocked modules', async ({ mount }) => {
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

  // 5. Interact with Next/Navigation mock
  // We click the button that calls `router.push`. It won't crash because we mocked it,
  // and the UI should just handle the click smoothly.
  await component.locator('button', { hasText: 'Account Settings' }).click();
});