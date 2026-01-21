import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  // 60 second timeout per test (AI operations take time)
  timeout: 60 * 1000,

  use: {
    // Base URL for tests - use CLAUDIA_TEST_URL env var or fallback to localhost with HTTPS
    baseURL: process.env.CLAUDIA_TEST_URL || 'https://localhost:3000',

    // Ignore HTTPS errors for self-signed certificates
    ignoreHTTPSErrors: true,

    // Capture screenshot on failure
    screenshot: 'only-on-failure',

    // Disable video recording to save resources
    video: 'off',

    // Collect trace on failure
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Run local dev server before tests if needed
  // Skip webServer if CLAUDIA_TEST_URL is set (server already running)
  webServer: process.env.CLAUDIA_TEST_URL ? undefined : {
    command: 'npm run claudia',
    url: 'https://localhost:3000',
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
