import { test, expect } from '@playwright/test';
import {
  takeAnnotatedScreenshot,
  navigateAndWait
} from './helpers/test-utils';

/**
 * Claudia Flows E2E Tests
 *
 * Test infrastructure for Claudia Coder with helpers for:
 * - Annotated screenshots with timestamps
 * - Waiting for AI processing to complete
 * - Common navigation patterns
 */

// ============================================================================
// TEST SUITE
// ============================================================================

test.describe('Claudia Flows - E2E Tests', () => {
  test.describe('Basic Page Loading', () => {
    test('should load the home page successfully', async ({ page }) => {
      // Navigate to the home page
      await navigateAndWait(page, '/');

      // Take an annotated screenshot
      await takeAnnotatedScreenshot(page, 'homepage', 'initial-load');

      // Verify the page has loaded by checking for key elements
      await expect(page).toHaveTitle(/Claudia/i);

      // Verify the sidebar is visible (indicates app shell loaded)
      const sidebar = page.locator('aside');
      await expect(sidebar).toBeVisible();

      // Verify Claudia Coder branding
      await expect(page.locator('text=Claudia Coder')).toBeVisible();

      // Take final screenshot
      await takeAnnotatedScreenshot(page, 'homepage', 'verified');
    });
  });
});
