import { test, expect } from '@playwright/test';

test.describe('Rebuild Verification Screenshots', () => {
  test('capture verification screenshots', async ({ page }) => {
    // 1. Go to settings page
    await page.goto('http://localhost:3000/settings');

    // 2. Wait 3 seconds for load
    await page.waitForTimeout(3000);

    // 3. Click on Connections in sidebar navigation
    await page.click('text=Connections');
    await page.waitForTimeout(2000);

    // 4. Screenshot as "verify-settings-connections.png"
    await page.screenshot({
      path: 'test-results/screenshots/verify-settings-connections.png',
      fullPage: true
    });
    console.log('Screenshot 1: Settings Connections page captured');

    // 5. Go to projects page
    await page.goto('http://localhost:3000/projects');

    // 6. Wait 2 seconds
    await page.waitForTimeout(2000);

    // Screenshot the projects list first
    await page.screenshot({
      path: 'test-results/screenshots/verify-projects-list.png',
      fullPage: true
    });
    console.log('Screenshot: Projects list captured');

    // 7. Look for a project card in the main content area (not sidebar)
    const projectCard = page.locator('.grid a[href^="/projects/"], main a[href^="/projects/"]').first();
    const cardCount = await projectCard.count();

    if (cardCount > 0) {
      await projectCard.click();

      // 8. Wait 2 seconds
      await page.waitForTimeout(2000);

      // 9. Try to click on "AI Models" or "Models" tab if it exists
      const modelsTab = page.locator('text=AI Models, text=Models').first();
      const tabCount = await modelsTab.count();
      if (tabCount > 0) {
        await modelsTab.click();
        await page.waitForTimeout(1000);
      }

      // 10. Screenshot as "verify-project-models.png"
      await page.screenshot({
        path: 'test-results/screenshots/verify-project-models.png',
        fullPage: true
      });
      console.log('Screenshot 2: Project page captured');
    } else {
      console.log('No project cards found on projects page');
    }

    // 11. Go to new project page
    await page.goto('http://localhost:3000/projects/new');

    // 12. Wait 2 seconds
    await page.waitForTimeout(2000);

    // 13. Screenshot as "verify-new-project.png"
    await page.screenshot({
      path: 'test-results/screenshots/verify-new-project.png',
      fullPage: true
    });
    console.log('Screenshot 3: New Project page captured');

    console.log('All verification screenshots captured successfully!');
  });
});
