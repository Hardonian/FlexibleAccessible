import { test, expect, type MountResult } from '@playwright/experimental-ct-react';
import type { Page } from '@playwright/test';
import { ExampleForm } from './example-form';
import AxeBuilder from '@axe-core/playwright';

test.use({ viewport: { width: 500, height: 600 } });

test.describe('ExampleForm', () => {
  test('should fill out and submit the form successfully', async ({ mount }: { mount: any }) => {
    const component = await mount(<ExampleForm />);

    // 1. Interacting with text inputs: Use `fill` targeting the associated label.
    // `fill` is preferred over `type` because it ensures the field is clear first.
    await component.getByLabel('Full Name').fill('Jane Doe');

    // 2. Interacting with selects: Use `selectOption` targeting the label.
    await component.getByLabel('Topic').selectOption('support');

    // 3. Interacting with checkboxes/radios: Use `check`.
    await component.getByLabel('Subscribe to our newsletter').check();

    // 4. Submitting: Target the button by its accessible role and name.
    await component.getByRole('button', { name: 'Submit' }).click();

    // 5. Verify intermediate state (optional but good for strict validation)
    await expect(component.getByRole('button', { name: 'Sending...' })).toBeDisabled();

    // 6. Verify the final outcome using ARIA roles for robust assertions
    const alert = component.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Your submission has been received.');
  });

  test('should not have automatically detectable accessibility violations', async ({ page, mount }) => {
    await mount(<ExampleForm />);
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});