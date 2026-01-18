import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    // Base URL for tests - use CLAUDIA_TEST_URL env var or fallback to localhost
    baseURL: process.env.CLAUDIA_TEST_URL || 'http://localhost:3000',
    
    // Capture screenshot on failure
    screenshot: 'only-on-failure',
    
    // Record video for all tests
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

  // Run local dev server before tests if needed
  // Skip webServer if CLAUDIA_TEST_URL is set (server already running)
  webServer: process.env.CLAUDIA_TEST_URL ? undefined : {
    command: 'npm run claudia',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
