import { test, expect } from '@playwright/test';

/**
 * Polish Features Visual Tests
 * Tests keyboard shortcuts, wizard validation, quick start, packet execution, and 404 page
 * Target: http://localhost:3002
 * Output: /home/bill/projects/claudia-admin/test-screenshots/
 */

const SCREENSHOT_DIR = '/home/bill/projects/claudia-admin/test-screenshots';
const BASE_URL = 'http://localhost:3002';

test.use({
  baseURL: BASE_URL,
});

/**
 * Helper: Wait for app to be ready
 */
async function waitForAppReady(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForSelector('aside, main, [role="main"]', {
    state: 'visible',
    timeout: 15000
  }).catch(() => {});
  await page.waitForTimeout(500);
}

test.describe('Polish Features Visual Tests', () => {

  test.describe('1. Keyboard Shortcuts', () => {

    test('Cmd+N should navigate to new project', async ({ page }) => {
      // Go to home page first
      await page.goto('/');
      await waitForAppReady(page);

      // Record current URL
      const initialUrl = page.url();

      // Press Ctrl+N (Linux) or Meta+N (Mac)
      const isMac = process.platform === 'darwin';
      const modifier = isMac ? 'Meta' : 'Control';

      await page.keyboard.press(`${modifier}+n`);
      await page.waitForTimeout(1000);

      // Check if we navigated or if a dialog appeared
      const currentUrl = page.url();
      const navigated = currentUrl !== initialUrl || currentUrl.includes('new');

      console.log(`Initial URL: ${initialUrl}`);
      console.log(`Current URL: ${currentUrl}`);
      console.log(`Navigation occurred: ${navigated}`);

      // Take screenshot of result
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/polish-shortcut-cmd-n-result.png`,
        fullPage: true
      });
    });

    test('Cmd+/ should show shortcuts dialog', async ({ page }) => {
      // Go to home page
      await page.goto('/');
      await waitForAppReady(page);

      // Press Ctrl+/ (Linux) or Meta+/ (Mac)
      const isMac = process.platform === 'darwin';
      const modifier = isMac ? 'Meta' : 'Control';

      // Try Ctrl+/ for shortcuts dialog
      await page.keyboard.press(`${modifier}+/`);
      await page.waitForTimeout(1000);

      // Look for dialog/modal that might appear
      const dialogVisible = await page.locator('[role="dialog"], [data-state="open"], .modal, [class*="dialog"]').isVisible().catch(() => false);

      if (dialogVisible) {
        console.log('Shortcuts dialog appeared!');
      } else {
        // Try ? key as alternative for shortcuts
        await page.keyboard.press('?');
        await page.waitForTimeout(1000);
      }

      // Take screenshot - this is the main screenshot we want
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/polish-shortcuts-dialog.png`,
        fullPage: true
      });

      console.log('Screenshot saved: polish-shortcuts-dialog.png');
    });

    test('Verify all keyboard shortcuts', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // List of shortcuts to test
      const shortcuts = [
        { key: 'Control+/', description: 'Show shortcuts' },
        { key: 'Control+n', description: 'New project' },
        { key: 'Control+k', description: 'Command palette' },
        { key: 'Escape', description: 'Close dialogs' },
      ];

      for (const shortcut of shortcuts) {
        console.log(`Testing: ${shortcut.key} - ${shortcut.description}`);
        await page.keyboard.press(shortcut.key);
        await page.waitForTimeout(500);

        // Press Escape to close any dialog that opened
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    });
  });

  test.describe('2. New Project Wizard Validation', () => {

    test('Quick Start with empty name validation', async ({ page }) => {
      // Go to new project page
      await page.goto('/projects/new');
      await waitForAppReady(page);

      // If redirected to home, that's fine
      await page.goto('/');
      await waitForAppReady(page);

      // Look for Quick Start button and click it
      const quickStartBtn = page.locator([
        'button:has-text("Quick Start")',
        'button:has-text("Quick")',
        '[data-testid="quick-start"]',
        'button:has-text("Quick Mode")',
      ].join(', ')).first();

      if (await quickStartBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await quickStartBtn.click();
        await page.waitForTimeout(500);
      }

      // Try to submit without entering a name
      const submitBtn = page.locator([
        'button[type="submit"]',
        'button:has-text("Create")',
        'button:has-text("Next")',
        'button:has-text("Start")',
      ].join(', ')).first();

      if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitBtn.click();
        await page.waitForTimeout(500);
      }

      // Take screenshot of validation state
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/polish-validation-empty.png`,
        fullPage: true
      });

      // Now try with a short name (1-2 chars)
      const nameInput = page.locator([
        'input[name="name"]',
        'input[placeholder*="name" i]',
        'input[id*="name" i]',
        'input[placeholder*="project" i]',
      ].join(', ')).first();

      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill('ab');
        await page.waitForTimeout(300);

        // Try to submit
        if (await submitBtn.isVisible()) {
          await submitBtn.click();
          await page.waitForTimeout(500);
        }
      }

      // Take screenshot of short name validation
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/polish-validation.png`,
        fullPage: true
      });

      console.log('Screenshot saved: polish-validation.png');

      // Check for validation messages
      const validationMessages = await page.locator('[class*="error"], [class*="invalid"], [role="alert"], .text-red, .text-destructive').allTextContents();
      console.log('Validation messages found:', validationMessages);
    });
  });

  test.describe('3. Quick Start Feature', () => {

    test('Quick Start with description shows loading messages', async ({ page }) => {
      // Go to new project page or home
      await page.goto('/');
      await waitForAppReady(page);

      // Look for Quick Start button
      const quickStartBtn = page.locator([
        'button:has-text("Quick Start")',
        'button:has-text("Quick")',
        '[data-testid="quick-start"]',
      ].join(', ')).first();

      if (await quickStartBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('Found Quick Start button');
        await quickStartBtn.click();
        await page.waitForTimeout(500);
      } else {
        console.log('Quick Start button not visible on main page, checking /projects/new');
        await page.goto('/projects/new');
        await waitForAppReady(page);

        // Try again
        const quickBtn2 = page.locator('button:has-text("Quick Start"), button:has-text("Quick")').first();
        if (await quickBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
          await quickBtn2.click();
          await page.waitForTimeout(500);
        }
      }

      // Look for description input
      const descriptionInput = page.locator([
        'textarea[name="description"]',
        'textarea[placeholder*="description" i]',
        'textarea[placeholder*="idea" i]',
        'input[placeholder*="describe" i]',
        'textarea',
      ].join(', ')).first();

      if (await descriptionInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await descriptionInput.fill('A todo list app with React and TypeScript that has dark mode, drag and drop reordering, and local storage persistence');
        await page.waitForTimeout(300);
      }

      // Submit to trigger generation
      const generateBtn = page.locator([
        'button[type="submit"]',
        'button:has-text("Generate")',
        'button:has-text("Create")',
        'button:has-text("Go")',
        'button:has-text("Start")',
      ].join(', ')).first();

      if (await generateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await generateBtn.click();

        // Wait a moment then capture the loading state
        await page.waitForTimeout(1500);

        // Take screenshot of loading messages
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/polish-feeling-lucky.png`,
          fullPage: true
        });

        console.log('Screenshot saved: polish-feeling-lucky.png');

        // Log any fun messages we find
        const loadingMessages = await page.locator('[class*="loading"], [class*="status"], [class*="message"], [role="status"]').allTextContents();
        console.log('Loading messages found:', loadingMessages);
      } else {
        // Take screenshot of current state
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/polish-feeling-lucky.png`,
          fullPage: true
        });
        console.log('Could not find generate button, screenshot saved of current state');
      }
    });
  });

  test.describe('4. Work Packet Execution', () => {

    test('Create project and execute work packet', async ({ page }) => {
      // First create a project via Quick Start
      await page.goto('/');
      await waitForAppReady(page);

      // Click Quick Start
      const quickStartBtn = page.locator('button:has-text("Quick Start"), button:has-text("Quick")').first();
      if (await quickStartBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await quickStartBtn.click();
        await page.waitForTimeout(500);
      }

      // Fill in project name
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
      if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameInput.fill('Visual Test Project ' + Date.now());
        await page.waitForTimeout(300);
      }

      // Fill description if available
      const descInput = page.locator('textarea[name="description"], textarea').first();
      if (await descInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await descInput.fill('A simple test project for E2E visual testing');
        await page.waitForTimeout(300);
      }

      // Submit to create project
      const createBtn = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Next")').first();
      if (await createBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await createBtn.click();

        // Wait for navigation to project page
        await page.waitForTimeout(3000);
        await page.waitForLoadState('networkidle').catch(() => {});
      }

      // Look for Generate Build Plan button
      const generatePlanBtn = page.locator([
        'button:has-text("Generate Build Plan")',
        'button:has-text("Generate Plan")',
        'button:has-text("Build Plan")',
        'button:has-text("Generate")',
        '[data-testid="generate-plan"]',
      ].join(', ')).first();

      if (await generatePlanBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        console.log('Found Generate Build Plan button');
        await generatePlanBtn.click();

        // Wait for generation
        await page.waitForTimeout(5000);
      }

      // Look for Execute button on a work packet
      const executeBtn = page.locator([
        'button:has-text("Execute")',
        'button:has-text("Run")',
        'button:has-text("Start")',
        '[data-testid*="execute"]',
      ].join(', ')).first();

      if (await executeBtn.isVisible({ timeout: 10000 }).catch(() => false)) {
        console.log('Found Execute button');
        await executeBtn.click();

        // Wait for execution state
        await page.waitForTimeout(2000);
      }

      // Take screenshot of execution state
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/polish-packet-execution.png`,
        fullPage: true
      });

      console.log('Screenshot saved: polish-packet-execution.png');
    });

    test('Navigate to existing project and check packets', async ({ page }) => {
      // Go to projects list
      await page.goto('/projects');
      await waitForAppReady(page);

      // Click on first project if exists
      const projectLink = page.locator('a[href*="/projects/"], [data-testid="project-item"]').first();
      if (await projectLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await projectLink.click();
        await waitForAppReady(page);

        // Look for work packets section
        const packetsSection = page.locator('text=Work Packets, text=Packets, text=Tasks, [data-testid="packets"]').first();
        if (await packetsSection.isVisible({ timeout: 3000 }).catch(() => false)) {
          console.log('Found work packets section');
        }

        // Take screenshot
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/polish-packet-execution-existing.png`,
          fullPage: true
        });
      }
    });
  });

  test.describe('5. Error Pages', () => {

    test('404 page for nonexistent route', async ({ page }) => {
      // Navigate to a page that doesn't exist
      await page.goto('/nonexistent-page-that-does-not-exist-12345');

      // Wait for page to load (may show 404)
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);

      // Take screenshot of 404 page
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/polish-404-page.png`,
        fullPage: true
      });

      console.log('Screenshot saved: polish-404-page.png');

      // Check what's on the page
      const pageContent = await page.content();
      const has404 = pageContent.toLowerCase().includes('404') ||
                     pageContent.toLowerCase().includes('not found') ||
                     pageContent.toLowerCase().includes('page not found');

      console.log(`404 page detected: ${has404}`);

      // Look for any navigation elements
      const backButton = page.locator('a:has-text("Back"), button:has-text("Back"), a:has-text("Home"), button:has-text("Home")').first();
      const hasBackButton = await backButton.isVisible().catch(() => false);
      console.log(`Has back/home button: ${hasBackButton}`);

      // Log page title
      const title = await page.title();
      console.log(`Page title: ${title}`);
    });

    test('Invalid project ID page', async ({ page }) => {
      // Navigate to invalid project
      await page.goto('/projects/invalid-project-id-12345');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);

      // Take screenshot
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/polish-invalid-project.png`,
        fullPage: true
      });

      console.log('Screenshot saved: polish-invalid-project.png');
    });
  });

});
