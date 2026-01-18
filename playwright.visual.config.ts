import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for visual tests - no webServer, uses existing running server
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',

  use: {
    // Base URL - default to localhost:3002 for visual tests
    baseURL: process.env.CLAUDIA_TEST_URL || 'http://localhost:3002',

    // Capture screenshot on failure
    screenshot: 'only-on-failure',

    // Record video
    video: 'on',

    // Collect trace on failure
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // NO webServer - assumes server is already running
});
