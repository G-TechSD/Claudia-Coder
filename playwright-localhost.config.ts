import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for localhost testing with self-signed certificates
 * Run with: xvfb-run npx playwright test --config=playwright-localhost.config.ts
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run tests sequentially for easier debugging
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report-localhost' }],
  ],

  // Longer timeouts for generation/build processes
  timeout: 180000, // 3 minutes per test
  expect: {
    timeout: 30000,
  },

  use: {
    baseURL: 'https://localhost:3000',

    // Accept self-signed certificates
    ignoreHTTPSErrors: true,

    // Screenshots and video for debugging
    screenshot: 'on',
    video: 'on',
    trace: 'on-first-retry',

    // Viewport
    viewport: { width: 1280, height: 720 },

    // Action timeouts
    actionTimeout: 30000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Additional Chrome flags for headless with self-signed certs
        launchOptions: {
          args: [
            '--ignore-certificate-errors',
            '--disable-web-security',
            '--allow-insecure-localhost',
          ],
        },
      },
    },
  ],

  // Don't start a dev server - assume it's already running
  // webServer: undefined,
});
