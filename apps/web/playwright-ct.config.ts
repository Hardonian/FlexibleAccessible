import { defineConfig, devices } from '@playwright/experimental-ct-react';

/**
 * Playwright Component Testing Configuration
 * This runs tests against isolated React components in a real browser.
 */
export default defineConfig({
  testDir: './src', // Assumes components live in src/
  testMatch: /.*\.spec\.tsx?/, // Matches *.spec.tsx files
  snapshotDir: './__snapshots__',
  timeout: 10 * 1000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    trace: 'on-first-retry',
    ctPort: 3100, // Port for the local dev server hosting the components
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Add Firefox/Webkit here later if needed
  ],
});