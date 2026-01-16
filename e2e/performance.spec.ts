import { test, expect } from '@playwright/test';

test.describe('Page Load Performance', () => {
  const pages = [
    { name: 'Home', url: '/' },
    { name: 'Projects', url: '/projects' },
    { name: 'Voice', url: '/voice' },
    { name: 'Settings', url: '/settings' },
  ];

  for (const page of pages) {
    test(`${page.name} should load within 5 seconds`, async ({ page: browserPage }) => {
      const start = Date.now();
      await browserPage.goto(`http://localhost:3000${page.url}`);
      await browserPage.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - start;

      console.log(`${page.name} loaded in ${loadTime}ms`);
      expect(loadTime).toBeLessThan(5000);
    });
  }
});
