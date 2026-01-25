import { test, expect } from '@playwright/test';
import {
  waitForAppReady,
  takeScreenshot,
  setupConsoleErrorCheck,
  navigateViaSidebar,
} from './helpers';

test.describe('App Loading Tests', () => {
  test.describe('Homepage', () => {
    test('should load the homepage without errors', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      // Navigate to homepage
      await page.goto('/');
      await waitForAppReady(page);

      // Take screenshot for verification
      await takeScreenshot(page, 'homepage-loaded');

      // Verify page title or key content
      await expect(page).toHaveTitle(/Claudia/i);

      // Check for critical console errors
      const errors = getErrors();
      expect(errors.length).toBe(0);
    });

    test('should display the sidebar', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Verify sidebar is visible
      const sidebar = page.locator('aside');
      await expect(sidebar).toBeVisible();

      // Verify Claudia Coder branding is present
      await expect(sidebar.locator('text=Claudia Coder')).toBeVisible();

      await takeScreenshot(page, 'sidebar-visible');
    });

    test('should have no JavaScript errors on initial load', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/');
      await waitForAppReady(page);

      // Wait a bit more to catch any delayed errors
      await page.waitForTimeout(2000);

      const errors = getErrors();

      // Log any errors found for debugging
      if (errors.length > 0) {
        console.log('Console errors found:', errors);
      }

      expect(errors).toEqual([]);
    });
  });

  test.describe('Main Navigation', () => {
    test('should navigate to Projects page', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Click on Projects link in sidebar
      await navigateViaSidebar(page, 'Projects');

      // Verify we're on the projects page
      await expect(page).toHaveURL(/\/projects/);

      await takeScreenshot(page, 'projects-page');
    });

    test('should navigate to Dashboard from sidebar', async ({ page }) => {
      await page.goto('/projects');
      await waitForAppReady(page);

      // Navigate back to dashboard
      await navigateViaSidebar(page, 'Dashboard');

      // Should be at root
      await expect(page).toHaveURL(/\/$/);

      await takeScreenshot(page, 'dashboard-from-sidebar');
    });

    // Skipped: Business Ideas is in "upcomingFeaturesItems" which is commented out in sidebar
    test.skip('should navigate to Business Ideas page', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      await navigateViaSidebar(page, 'Business Ideas');

      await expect(page).toHaveURL(/\/business-ideas/);

      await takeScreenshot(page, 'business-ideas-page');
    });

    test('should navigate to Voice page', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      await navigateViaSidebar(page, 'Voice');

      await expect(page).toHaveURL(/\/voice/);

      await takeScreenshot(page, 'voice-page');
    });

    test('should navigate to Claude Code page', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Expand Tools section if needed
      const toolsSection = page.locator('aside button:has-text("Tools")');
      if (await toolsSection.isVisible()) {
        await toolsSection.click();
        await page.waitForTimeout(300);
      }

      await navigateViaSidebar(page, 'Claude Code');

      await expect(page).toHaveURL(/\/claude-code/);

      await takeScreenshot(page, 'claude-code-page');
    });
  });

  test.describe('Sidebar Functionality', () => {
    test('should have collapsible navigation sections', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Find the Projects section toggle
      const projectsSection = page.locator('aside button:has-text("Projects")');
      await expect(projectsSection).toBeVisible();

      // Find the Tools section toggle
      const toolsSection = page.locator('aside button:has-text("Tools")');
      await expect(toolsSection).toBeVisible();

      await takeScreenshot(page, 'collapsible-sections');
    });

    test('should toggle sidebar sections', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      const toolsSection = page.locator('aside button:has-text("Tools")');

      // Click to toggle
      await toolsSection.click();
      await page.waitForTimeout(300);

      // Take screenshot of toggled state
      await takeScreenshot(page, 'sidebar-toggled');
    });

    test('should display Trash link at bottom of sidebar', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      const trashLink = page.locator('aside a:has-text("Trash")');
      await expect(trashLink).toBeVisible();

      await takeScreenshot(page, 'trash-link-visible');
    });

    test('should display command palette hint', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Look for the search/command button
      const searchButton = page.locator('aside button:has-text("Search")');
      await expect(searchButton).toBeVisible();

      await takeScreenshot(page, 'search-button-visible');
    });
  });

  test.describe('Error Handling', () => {
    test('should handle 404 pages gracefully', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      // Navigate to a non-existent page
      const response = await page.goto('/non-existent-page-12345');

      // Should show some error page or redirect
      // The app might handle this differently
      await takeScreenshot(page, '404-page');

      // Should not have critical JS errors even on 404
      const errors = getErrors();
      // Filter out expected 404-related errors
      const criticalErrors = errors.filter(e => !e.includes('404'));
      expect(criticalErrors.length).toBe(0);
    });
  });
});
