import { defineConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright config for visual-tests-fresh.spec.ts
 * No webServer - assumes app is already running at localhost:3002
 */
export default defineConfig({
  testDir: path.join(__dirname),
  testMatch: 'visual-tests-fresh.spec.ts',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:3002',
    screenshot: 'on',
    video: 'off',
    trace: 'off',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No webServer - app should already be running
});
