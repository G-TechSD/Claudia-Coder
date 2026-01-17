import { Page, expect } from '@playwright/test';

/**
 * E2E Test Helpers for Claudia Coder
 * Provides utility functions for common test operations
 */

/**
 * Takes a screenshot with a descriptive name
 * Screenshots are saved to the test-results directory
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `test-results/screenshots/${name}-${timestamp}.png`,
    fullPage: true,
  });
}

/**
 * Waits for the app to be fully loaded and ready
 * Checks for key indicators that the app has finished initial rendering
 */
export async function waitForAppReady(page: Page): Promise<void> {
  // Wait for the sidebar to be visible (indicates app shell is loaded)
  await page.waitForSelector('aside', { state: 'visible', timeout: 30000 });

  // Wait for any loading spinners to disappear
  await page.waitForFunction(() => {
    const spinners = document.querySelectorAll('[class*="animate-spin"]');
    return spinners.length === 0;
  }, { timeout: 15000 }).catch(() => {
    // Ignore timeout - some pages may have persistent spinners
  });

  // Wait for network to be idle
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
    // Ignore timeout - some pages may have persistent connections
  });
}

/**
 * Collects and returns any console errors from the page
 * Useful for verifying no JavaScript errors occurred during test
 */
export async function collectConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  return errors;
}

/**
 * Sets up console error collection and returns a function to check errors
 * Call the returned function at the end of your test to verify no errors
 */
export function setupConsoleErrorCheck(page: Page): () => string[] {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      // Filter out known acceptable errors
      const text = msg.text();
      if (!isAcceptableError(text)) {
        errors.push(text);
      }
    }
  });

  page.on('pageerror', (error) => {
    errors.push(`Page error: ${error.message}`);
  });

  return () => errors;
}

/**
 * Checks if an error message is acceptable (expected in normal operation)
 */
function isAcceptableError(errorText: string): boolean {
  const acceptablePatterns = [
    /Failed to load resource.*favicon/i,
    /ResizeObserver loop/i,
    /Non-Error promise rejection/i,
    /hydration/i, // React hydration warnings in dev mode
    /401/i, // Auth errors are expected when not logged in
    /api\/health/i, // Health check errors are expected
    /Unauthorized/i, // Auth-related errors
    /N8N API/i, // n8n not available
    /Failed to fetch/i, // Network errors for external services
    /getAllProjects called without userId/i, // Expected when not logged in
    /server activities/i, // Server not available
    /NEXT_REDIRECT/i, // Next.js redirect errors
  ];

  return acceptablePatterns.some(pattern => pattern.test(errorText));
}

/**
 * Waits for navigation to complete after clicking a link
 */
export async function clickAndWaitForNavigation(
  page: Page,
  selector: string
): Promise<void> {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle' }),
    page.click(selector),
  ]).catch(async () => {
    // Fallback: just click and wait
    await page.click(selector);
    await page.waitForLoadState('networkidle');
  });
}

/**
 * Fills in a form field with proper clearing and typing
 */
export async function fillFormField(
  page: Page,
  selector: string,
  value: string
): Promise<void> {
  const input = page.locator(selector);
  await input.click();
  await input.fill(value);
}

/**
 * Waits for a toast notification to appear and optionally verifies its content
 */
export async function waitForToast(
  page: Page,
  expectedText?: string
): Promise<void> {
  const toastSelector = '[role="alert"], [data-sonner-toast], .toast';
  await page.waitForSelector(toastSelector, { timeout: 10000 });

  if (expectedText) {
    await expect(page.locator(toastSelector)).toContainText(expectedText);
  }
}

/**
 * Expands a collapsed sidebar section by clicking on it
 */
export async function expandSidebarSection(
  page: Page,
  sectionName: string
): Promise<void> {
  const sectionButton = page.locator(`aside button:has-text("${sectionName}")`);
  const isCollapsed = await sectionButton.locator('svg[class*="rotate"]').count() === 0;

  if (isCollapsed) {
    await sectionButton.click();
    // Wait for animation
    await page.waitForTimeout(300);
  }
}

/**
 * Navigates to a specific page using the sidebar
 */
export async function navigateViaSidebar(
  page: Page,
  itemText: string
): Promise<void> {
  // First expand relevant sections if needed
  const sidebarLink = page.locator(`aside a:has-text("${itemText}")`);

  // If not visible, try expanding sections
  if (!await sidebarLink.isVisible()) {
    const sections = ['Projects', 'Tools', 'Admin'];
    for (const section of sections) {
      await expandSidebarSection(page, section).catch(() => {});
    }
  }

  await sidebarLink.click();
  await waitForAppReady(page);
}

/**
 * Gets the base URL from environment or default
 */
export function getBaseUrl(): string {
  return process.env.CLAUDIA_TEST_URL || 'http://localhost:3000';
}
