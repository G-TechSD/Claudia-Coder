import { test, expect } from '@playwright/test';

test.describe('Final Rebuild Verification', () => {
  test('capture AI Services and project detail', async ({ page }) => {
    // 1. Go to settings page - AI Services tab (default)
    await page.goto('http://localhost:3000/settings');
    await page.waitForTimeout(3000);

    // Screenshot AI Services tab to see local servers
    await page.screenshot({
      path: 'test-results/screenshots/verify-ai-services.png',
      fullPage: true
    });
    console.log('Screenshot: AI Services tab captured');

    // 2. Go directly to a project page
    await page.goto('http://localhost:3000/projects');
    await page.waitForTimeout(2000);

    // Click on the first project row (not sidebar)
    const projectRow = page.locator('main').locator('a[href*="/projects/"]').first();
    await projectRow.click();
    await page.waitForTimeout(2000);

    // Screenshot the project detail page
    await page.screenshot({
      path: 'test-results/screenshots/verify-project-detail.png',
      fullPage: true
    });
    console.log('Screenshot: Project detail captured');

    // Try to find and click AI Models tab
    const modelsLink = page.locator('text=AI Models').first();
    if (await modelsLink.count() > 0) {
      await modelsLink.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: 'test-results/screenshots/verify-project-models.png',
        fullPage: true
      });
      console.log('Screenshot: Project AI Models captured');
    }

    console.log('Final verification complete!');
  });
});
