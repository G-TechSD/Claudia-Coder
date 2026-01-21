import { test, expect } from '@playwright/test';

test('screenshot multiple screens', async ({ page }) => {
  // Dashboard (root page)
  await page.goto('https://localhost:3000/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/screenshots/dashboard.png', fullPage: true });

  // Projects list
  await page.goto('https://localhost:3000/projects', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/screenshots/projects-list.png', fullPage: true });

  // Settings
  await page.goto('https://localhost:3000/settings', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/screenshots/settings.png', fullPage: true });

  // Click on first project to get project detail
  await page.goto('https://localhost:3000/projects', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  // Find and click a project link (the title is a link)
  const projectLink = page.locator('a[href^="/projects/"]:not([href="/projects/new"]):not([href="/projects/trash"])').first();
  if (await projectLink.count() > 0) {
    await projectLink.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/screenshots/project-detail.png', fullPage: true });
  }

  // New project page
  await page.goto('https://localhost:3000/projects/new', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test-results/screenshots/new-project.png', fullPage: true });
});
