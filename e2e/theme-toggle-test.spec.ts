import { test, expect } from '@playwright/test';

test.describe('Theme Toggle Tests', () => {
  test('capture theme toggle screenshots', async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
    await page.waitForTimeout(2000);

    // Screenshot 1: Dark mode (current/default)
    await page.screenshot({
      path: 'test-screenshots/theme-dark.png',
      fullPage: true
    });
    console.log('Captured dark mode screenshot');

    // Find and click theme toggle in sidebar
    // Look for theme toggle button - usually has sun/moon icon or "theme" text
    const themeToggle = page.locator('[data-testid="theme-toggle"], button:has-text("theme"), [aria-label*="theme"], [aria-label*="Theme"], .theme-toggle, button:has([class*="sun"]), button:has([class*="moon"])').first();

    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await page.waitForTimeout(1000);

      // Screenshot 2: Light mode
      await page.screenshot({
        path: 'test-screenshots/theme-light.png',
        fullPage: true
      });
      console.log('Captured light mode screenshot');

      // Click again for system mode
      await themeToggle.click();
      await page.waitForTimeout(1000);

      // Screenshot 3: System mode indicator
      await page.screenshot({
        path: 'test-screenshots/theme-system.png',
        fullPage: true
      });
      console.log('Captured system mode screenshot');
    } else {
      // Try alternative selectors
      console.log('Theme toggle not found with primary selectors, trying alternatives...');

      // Look in sidebar area
      const sidebar = page.locator('aside, nav, [class*="sidebar"], [class*="Sidebar"]').first();
      const sidebarThemeBtn = sidebar.locator('button').filter({ hasText: /dark|light|theme|system/i }).first();

      if (await sidebarThemeBtn.isVisible()) {
        await sidebarThemeBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'test-screenshots/theme-light.png', fullPage: true });

        await sidebarThemeBtn.click();
        await page.waitForTimeout(1000);
        await page.screenshot({ path: 'test-screenshots/theme-system.png', fullPage: true });
      } else {
        // Take screenshot of sidebar to see what's available
        console.log('Could not find theme toggle, capturing sidebar for inspection');
        await page.screenshot({ path: 'test-screenshots/sidebar-inspection.png', fullPage: true });
      }
    }
  });
});
