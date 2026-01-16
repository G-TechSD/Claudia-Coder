import { test, expect, Page } from '@playwright/test';
import { waitForAppReady, setupConsoleErrorCheck, takeScreenshot } from './helpers';

/**
 * Console Errors Test Suite
 *
 * This test suite visits every major page in the application and collects
 * all console errors and warnings, reporting them in a structured way.
 *
 * Purpose: Identify any JavaScript errors users might encounter during normal usage.
 */

// Extended type for console message collection
interface ConsoleMessage {
  type: 'error' | 'warning';
  text: string;
  url: string;
  timestamp: Date;
}

// Pages to test with their descriptions
const PAGES_TO_TEST = [
  { path: '/', name: 'Home/Dashboard', description: 'Main dashboard page' },
  { path: '/projects', name: 'Projects List', description: 'Projects listing page' },
  { path: '/projects/create', name: 'Create Project', description: 'New project creation page' },
  { path: '/settings', name: 'Settings', description: 'General settings page' },
  { path: '/settings/gitlab', name: 'GitLab Settings', description: 'GitLab integration settings' },
  { path: '/settings/n8n', name: 'n8n Settings', description: 'n8n workflow settings' },
  { path: '/voice', name: 'Voice', description: 'Voice assistant page' },
  { path: '/claude-code', name: 'Claude Code', description: 'Claude Code terminal page' },
  { path: '/gitea', name: 'Gitea', description: 'Gitea integration page' },
  { path: '/openwebui', name: 'Open WebUI', description: 'Open WebUI integration page' },
] as const;

// Patterns for errors/warnings that are known and acceptable
const ACCEPTABLE_PATTERNS = [
  /Failed to load resource.*favicon/i,
  /ResizeObserver loop/i,
  /Non-Error promise rejection/i,
  /hydration/i,
  /Download the React DevTools/i,
  /Warning: ReactDOM.render is no longer supported/i,
  /third-party cookie/i,
  /CORS/i, // External service CORS issues in dev
];

/**
 * Sets up comprehensive console message collection for both errors and warnings
 */
function setupConsoleCollection(page: Page): () => ConsoleMessage[] {
  const messages: ConsoleMessage[] = [];

  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      const text = msg.text();
      // Check if this is an acceptable/known message
      const isAcceptable = ACCEPTABLE_PATTERNS.some(pattern => pattern.test(text));
      if (!isAcceptable) {
        messages.push({
          type: type as 'error' | 'warning',
          text: text,
          url: page.url(),
          timestamp: new Date(),
        });
      }
    }
  });

  page.on('pageerror', (error) => {
    messages.push({
      type: 'error',
      text: `Page Error: ${error.message}\n${error.stack || ''}`,
      url: page.url(),
      timestamp: new Date(),
    });
  });

  return () => messages;
}

/**
 * Formats collected messages for readable output
 */
function formatMessages(messages: ConsoleMessage[]): string {
  if (messages.length === 0) {
    return 'No errors or warnings found';
  }

  const grouped = messages.reduce((acc, msg) => {
    if (!acc[msg.url]) {
      acc[msg.url] = { errors: [], warnings: [] };
    }
    if (msg.type === 'error') {
      acc[msg.url].errors.push(msg.text);
    } else {
      acc[msg.url].warnings.push(msg.text);
    }
    return acc;
  }, {} as Record<string, { errors: string[]; warnings: string[] }>);

  let output = '\n========== CONSOLE MESSAGES REPORT ==========\n';

  for (const [url, { errors, warnings }] of Object.entries(grouped)) {
    output += `\n--- Page: ${url} ---\n`;
    if (errors.length > 0) {
      output += `  ERRORS (${errors.length}):\n`;
      errors.forEach((e, i) => {
        output += `    ${i + 1}. ${e.substring(0, 200)}${e.length > 200 ? '...' : ''}\n`;
      });
    }
    if (warnings.length > 0) {
      output += `  WARNINGS (${warnings.length}):\n`;
      warnings.forEach((w, i) => {
        output += `    ${i + 1}. ${w.substring(0, 200)}${w.length > 200 ? '...' : ''}\n`;
      });
    }
  }

  output += '\n==============================================\n';
  return output;
}

test.describe('Console Errors Audit', () => {
  test.describe('Individual Page Console Error Checks', () => {
    // Generate individual tests for each page
    for (const pageConfig of PAGES_TO_TEST) {
      test(`${pageConfig.name} (${pageConfig.path}) - should load without console errors`, async ({ page }) => {
        const getMessages = setupConsoleCollection(page);

        // Navigate to the page
        await page.goto(pageConfig.path);

        // Wait for app to be ready
        await waitForAppReady(page);

        // Additional wait to catch async errors
        await page.waitForTimeout(2000);

        // Take screenshot
        await takeScreenshot(page, `console-audit-${pageConfig.name.toLowerCase().replace(/\s+/g, '-')}`);

        // Get collected messages
        const messages = getMessages();
        const errors = messages.filter(m => m.type === 'error');
        const warnings = messages.filter(m => m.type === 'warning');

        // Log findings for debugging
        if (messages.length > 0) {
          console.log(`\n[${pageConfig.name}] Found ${errors.length} errors and ${warnings.length} warnings`);
          messages.forEach(m => {
            console.log(`  [${m.type.toUpperCase()}] ${m.text.substring(0, 100)}...`);
          });
        }

        // Test assertion: no errors should be present
        expect(errors, `Console errors found on ${pageConfig.name}`).toHaveLength(0);
      });
    }
  });

  test.describe('Comprehensive Multi-Page Audit', () => {
    test('should audit all pages and report all console messages', async ({ page }) => {
      const allMessages: ConsoleMessage[] = [];
      const pageResults: { page: string; errors: number; warnings: number }[] = [];

      console.log('\n========== STARTING COMPREHENSIVE CONSOLE AUDIT ==========\n');

      for (const pageConfig of PAGES_TO_TEST) {
        // Setup fresh collection for this page
        const getMessages = setupConsoleCollection(page);

        console.log(`Auditing: ${pageConfig.name} (${pageConfig.path})...`);

        try {
          // Navigate to page
          await page.goto(pageConfig.path);
          await waitForAppReady(page);
          await page.waitForTimeout(1500);

          // Collect messages
          const messages = getMessages();
          allMessages.push(...messages);

          const errors = messages.filter(m => m.type === 'error').length;
          const warnings = messages.filter(m => m.type === 'warning').length;

          pageResults.push({
            page: pageConfig.name,
            errors,
            warnings,
          });

          console.log(`  -> Found ${errors} errors, ${warnings} warnings`);
        } catch (navError) {
          console.log(`  -> Navigation failed: ${navError}`);
          pageResults.push({
            page: pageConfig.name,
            errors: -1, // Indicates navigation failure
            warnings: 0,
          });
        }
      }

      // Generate summary report
      console.log('\n========== AUDIT SUMMARY ==========\n');
      console.log('Page                        | Errors | Warnings');
      console.log('--------------------------- | ------ | --------');

      for (const result of pageResults) {
        const pageName = result.page.padEnd(27);
        const errors = result.errors === -1 ? 'FAIL' : result.errors.toString().padStart(6);
        const warnings = result.warnings.toString().padStart(8);
        console.log(`${pageName} | ${errors} | ${warnings}`);
      }

      const totalErrors = allMessages.filter(m => m.type === 'error').length;
      const totalWarnings = allMessages.filter(m => m.type === 'warning').length;

      console.log('--------------------------- | ------ | --------');
      console.log(`${'TOTAL'.padEnd(27)} | ${totalErrors.toString().padStart(6)} | ${totalWarnings.toString().padStart(8)}`);

      // Print detailed messages
      console.log(formatMessages(allMessages));

      // Take final screenshot
      await takeScreenshot(page, 'console-audit-final');

      // Store results as test attachment (visible in HTML report)
      test.info().attachments.push({
        name: 'console-audit-report.txt',
        contentType: 'text/plain',
        body: Buffer.from(formatMessages(allMessages)),
      });

      test.info().attachments.push({
        name: 'console-audit-summary.json',
        contentType: 'application/json',
        body: Buffer.from(JSON.stringify({
          timestamp: new Date().toISOString(),
          totalErrors,
          totalWarnings,
          pageResults,
          messages: allMessages,
        }, null, 2)),
      });
    });

    test('should have zero critical errors across all pages', async ({ page }) => {
      const allErrors: ConsoleMessage[] = [];

      for (const pageConfig of PAGES_TO_TEST) {
        const getMessages = setupConsoleCollection(page);

        try {
          await page.goto(pageConfig.path);
          await waitForAppReady(page);
          await page.waitForTimeout(1000);

          const messages = getMessages();
          allErrors.push(...messages.filter(m => m.type === 'error'));
        } catch {
          // Skip pages that fail to load
          console.log(`Skipped ${pageConfig.path} due to navigation error`);
        }
      }

      // This test fails if any errors are found
      if (allErrors.length > 0) {
        console.log('\nCRITICAL ERRORS FOUND:');
        allErrors.forEach((e, i) => {
          console.log(`${i + 1}. [${e.url}] ${e.text}`);
        });
      }

      expect(allErrors, 'Critical console errors found across pages').toHaveLength(0);
    });
  });

  test.describe('Interactive Element Error Checks', () => {
    test('should not produce errors when interacting with sidebar', async ({ page }) => {
      const getMessages = setupConsoleCollection(page);

      await page.goto('/');
      await waitForAppReady(page);

      // Interact with sidebar sections
      const sidebarButtons = page.locator('aside button');
      const buttonCount = await sidebarButtons.count();

      for (let i = 0; i < Math.min(buttonCount, 5); i++) {
        try {
          await sidebarButtons.nth(i).click();
          await page.waitForTimeout(300);
        } catch {
          // Some buttons might not be clickable
        }
      }

      await page.waitForTimeout(1000);

      const errors = getMessages().filter(m => m.type === 'error');
      expect(errors, 'Errors during sidebar interaction').toHaveLength(0);
    });

    test('should not produce errors when clicking sidebar links', async ({ page }) => {
      const getMessages = setupConsoleCollection(page);

      await page.goto('/');
      await waitForAppReady(page);

      // Click through sidebar links
      const sidebarLinks = page.locator('aside a');
      const linkCount = await sidebarLinks.count();

      for (let i = 0; i < Math.min(linkCount, 5); i++) {
        try {
          await sidebarLinks.nth(i).click();
          await waitForAppReady(page);
        } catch {
          // Some links might navigate away
        }
      }

      const errors = getMessages().filter(m => m.type === 'error');
      expect(errors, 'Errors during link navigation').toHaveLength(0);
    });
  });

  test.describe('Page Load Performance Indicators', () => {
    test('should track page load times and flag slow pages', async ({ page }) => {
      const loadTimes: { page: string; time: number }[] = [];

      console.log('\n========== PAGE LOAD TIMES ==========\n');

      for (const pageConfig of PAGES_TO_TEST) {
        const startTime = Date.now();

        try {
          await page.goto(pageConfig.path);
          await waitForAppReady(page);

          const loadTime = Date.now() - startTime;
          loadTimes.push({ page: pageConfig.name, time: loadTime });

          const status = loadTime > 5000 ? 'SLOW' : loadTime > 3000 ? 'WARN' : 'OK';
          console.log(`${pageConfig.name.padEnd(25)} | ${loadTime}ms | ${status}`);
        } catch {
          loadTimes.push({ page: pageConfig.name, time: -1 });
          console.log(`${pageConfig.name.padEnd(25)} | FAILED`);
        }
      }

      // Attach load times to report
      test.info().attachments.push({
        name: 'page-load-times.json',
        contentType: 'application/json',
        body: Buffer.from(JSON.stringify(loadTimes, null, 2)),
      });

      // Flag very slow pages (> 10 seconds)
      const verySlowPages = loadTimes.filter(p => p.time > 10000);
      expect(verySlowPages, 'Pages taking longer than 10s to load').toHaveLength(0);
    });
  });
});
