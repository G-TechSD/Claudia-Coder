import { test, expect } from '@playwright/test';

test.describe('Direct Project Navigation', () => {
  test('capture project detail by clicking project name', async ({ page }) => {
    // Go to projects page
    await page.goto('http://localhost:3000/projects');
    await page.waitForTimeout(2000);

    // Click on the project title text (not the row link)
    await page.click('text=Claudia Coder');
    await page.waitForTimeout(2000);

    // Screenshot the project detail page
    await page.screenshot({
      path: 'test-results/screenshots/verify-project-detail.png',
      fullPage: true
    });
    console.log('Screenshot: Project detail captured');

    // Check URL to confirm we're on project page
    const url = page.url();
    console.log('Current URL:', url);
  });
});
