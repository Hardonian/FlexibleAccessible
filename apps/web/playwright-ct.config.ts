import { defineConfig, devices } from '@playwright/experimental-ct-react';
import { resolve } from 'path';

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
  reporter: process.env.CI ? [['github'], ['html']] : [['list'], ['html', { open: 'on-failure' }]],
  use: {
    trace: 'on-first-retry',
    ctPort: 3100, // Port for the local dev server hosting the components
    ctViteConfig: {
      resolve: {
        alias: {
          // Mock Next.js specifics
          'next/image': resolve(__dirname, './playwright/mocks/next-image.tsx'),
          'next/link': resolve(__dirname, './playwright/mocks/next-link.tsx'),
          'next/navigation': resolve(__dirname, './playwright/mocks/next-navigation.ts'),
          'next/router': resolve(__dirname, './playwright/mocks/next-navigation.ts'), // For legacy pages router
          // Standardize path aliases (matching tsconfig.json)
          '@': resolve(__dirname, './src'),
        },
      },
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    // Mobile viewports for component responsiveness
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
});