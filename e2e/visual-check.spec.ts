import { test } from '@playwright/test';

test('capture settings and connections', async ({ page }) => {
  await page.goto('/settings');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/screenshots/settings-main.png', fullPage: true });
  
  // Look for connections tab
  const connectionsTab = page.getByRole('tab', { name: /connections/i });
  if (await connectionsTab.isVisible()) {
    await connectionsTab.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: 'test-results/screenshots/settings-connections.png', fullPage: true });
});

test('capture new project page', async ({ page }) => {
  await page.goto('/projects/new');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'test-results/screenshots/new-project.png', fullPage: true });
});
