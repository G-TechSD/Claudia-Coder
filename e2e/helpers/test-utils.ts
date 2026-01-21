import { Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Claudia Flows E2E Test Utilities
 *
 * Shared helper functions for Claudia Coder E2E tests:
 * - Annotated screenshots with timestamps
 * - Waiting for AI processing to complete
 * - Common navigation patterns
 */

/**
 * Takes an annotated screenshot with timestamp
 * Screenshots are saved to test-results/screenshots/ with descriptive names
 *
 * @param page - Playwright page object
 * @param name - Descriptive name for the screenshot
 * @param annotation - Optional annotation text to add to filename
 * @returns Path to the saved screenshot
 */
export async function takeAnnotatedScreenshot(
  page: Page,
  name: string,
  annotation?: string
): Promise<string> {
  // Create timestamp in format: YYYY-MM-DD_HH-MM-SS
  const now = new Date();
  const timestamp = now.toISOString()
    .replace(/T/, '_')
    .replace(/:/g, '-')
    .replace(/\..+/, '');

  // Build filename with optional annotation
  const annotationPart = annotation ? `_${annotation.replace(/\s+/g, '-')}` : '';
  const filename = `${name}${annotationPart}_${timestamp}.png`;

  // Ensure screenshots directory exists
  const screenshotsDir = 'test-results/screenshots';
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const filepath = path.join(screenshotsDir, filename);

  await page.screenshot({
    path: filepath,
    fullPage: true,
  });

  console.log(`Screenshot saved: ${filepath}`);
  return filepath;
}

/**
 * Waits for AI processing to complete
 * Looks for common indicators that AI operations have finished:
 * - Loading spinners disappear
 * - Progress indicators complete
 * - Network becomes idle
 * - Specific completion selectors appear
 *
 * @param page - Playwright page object
 * @param options - Configuration options
 */
export async function waitForAIProcessing(
  page: Page,
  options: {
    timeout?: number;
    completionSelector?: string;
  } = {}
): Promise<void> {
  const { timeout = 60000, completionSelector } = options;

  // Wait for any loading spinners to disappear
  await page.waitForFunction(
    () => {
      const spinners = document.querySelectorAll(
        '[class*="animate-spin"], [class*="loading"], [data-loading="true"]'
      );
      return spinners.length === 0;
    },
    { timeout }
  ).catch(() => {
    console.log('Spinner wait timed out - continuing');
  });

  // Wait for any progress bars to complete or disappear
  await page.waitForFunction(
    () => {
      const progressBars = document.querySelectorAll('[role="progressbar"]');
      for (let i = 0; i < progressBars.length; i++) {
        const bar = progressBars[i];
        const value = bar.getAttribute('aria-valuenow');
        const max = bar.getAttribute('aria-valuemax') || '100';
        if (value && parseInt(value) < parseInt(max)) {
          return false;
        }
      }
      return true;
    },
    { timeout }
  ).catch(() => {
    console.log('Progress bar wait timed out - continuing');
  });

  // Wait for network to settle
  await page.waitForLoadState('networkidle', { timeout: timeout / 2 }).catch(() => {
    console.log('Network idle wait timed out - continuing');
  });

  // If a specific completion selector is provided, wait for it
  if (completionSelector) {
    await page.waitForSelector(completionSelector, {
      state: 'visible',
      timeout
    });
  }

  // Small buffer to ensure UI has updated
  await page.waitForTimeout(500);
}

/**
 * Navigates to a page and waits for it to be ready
 * Handles common navigation patterns in Claudia Coder
 *
 * @param page - Playwright page object
 * @param urlPath - URL path to navigate to (e.g., '/projects', '/settings')
 */
export async function navigateAndWait(page: Page, urlPath: string): Promise<void> {
  await page.goto(urlPath);

  // Wait for the app shell to load (sidebar indicates app is ready)
  await page.waitForSelector('aside', { state: 'visible', timeout: 30000 });

  // Wait for initial network activity to settle
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
    // Ignore timeout - some pages may have persistent connections
  });

  // Wait for any initial loading states to clear
  await page.waitForFunction(
    () => {
      const loadingElements = document.querySelectorAll('[class*="animate-spin"]');
      return loadingElements.length === 0;
    },
    { timeout: 10000 }
  ).catch(() => {
    // Ignore - some pages may have persistent loading indicators
  });
}

/**
 * Clicks a sidebar navigation item and waits for navigation
 *
 * @param page - Playwright page object
 * @param itemText - Text of the sidebar item to click
 */
export async function navigateViaSidebar(page: Page, itemText: string): Promise<void> {
  // Try to find and expand collapsed sections
  const sections = ['Projects', 'Tools', 'Admin'];
  for (const section of sections) {
    const sectionButton = page.locator(`aside button:has-text("${section}")`);
    if (await sectionButton.isVisible().catch(() => false)) {
      await sectionButton.click().catch(() => {});
      await page.waitForTimeout(300);
    }
  }

  // Click the navigation item
  const sidebarLink = page.locator(`aside a:has-text("${itemText}")`);
  await sidebarLink.click();

  // Wait for navigation to complete
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
}

/**
 * Opens the command palette (Cmd/Ctrl + K)
 *
 * @param page - Playwright page object
 */
export async function openCommandPalette(page: Page): Promise<void> {
  // Use keyboard shortcut to open command palette
  const isMac = process.platform === 'darwin';
  const modifier = isMac ? 'Meta' : 'Control';

  await page.keyboard.press(`${modifier}+k`);

  // Wait for command palette to appear
  await page.waitForSelector('[role="dialog"], [cmdk-dialog], [data-cmdk-root]', {
    state: 'visible',
    timeout: 5000,
  }).catch(() => {
    console.log('Command palette may not have opened');
  });
}

/**
 * Waits for a toast/notification to appear
 *
 * @param page - Playwright page object
 * @param expectedText - Optional text to verify in the toast
 */
export async function waitForToast(
  page: Page,
  expectedText?: string
): Promise<void> {
  const toastSelector = '[role="alert"], [data-sonner-toast], .toast, [class*="toast"]';
  await page.waitForSelector(toastSelector, { timeout: 10000 });

  if (expectedText) {
    await expect(page.locator(toastSelector)).toContainText(expectedText);
  }
}
