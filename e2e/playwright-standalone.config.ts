import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: path.join(__dirname),
  fullyParallel: true,
  retries: 0,
  workers: 1,
  reporter: 'list',

  use: {
    baseURL: process.env.CLAUDIA_TEST_URL || 'http://localhost:3002',
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'off',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // No webServer - assumes server is already running
});
