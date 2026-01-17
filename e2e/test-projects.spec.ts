import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = '/tmp/claudia-test-screenshots';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Configure to ignore HTTPS certificate errors
test.use({
  ignoreHTTPSErrors: true,
});

// Capture console errors
const consoleErrors: string[] = [];

test.describe('Project Detail Pages', () => {
  test.beforeEach(async ({ page }) => {
    // Listen for console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[Console Error] ${msg.text()}`);
        console.log(`[Console Error] ${msg.text()}`);
      }
    });

    // Listen for page errors
    page.on('pageerror', (error) => {
      consoleErrors.push(`[Page Error] ${error.message}`);
      console.log(`[Page Error] ${error.message}`);
    });
  });

  test('should navigate to projects and test project detail page', async ({ page }) => {
    // Step 1: Navigate to projects page
    console.log('Navigating to /projects...');
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Take screenshot of projects list
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '01-projects-list.png'),
      fullPage: true
    });
    console.log('Screenshot: projects list saved');

    // Step 2: Find and click on a project
    console.log('Looking for project cards/links...');

    // Wait for projects to load - look for common project card patterns
    const projectSelectors = [
      '[data-testid="project-card"]',
      '.project-card',
      '[href*="/projects/"]',
      'a[href*="/project"]',
      '.project-item',
      'tr[data-project-id]',
      '[role="row"] a',
      '.card a',
      'table tbody tr',
    ];

    let projectElement = null;
    for (const selector of projectSelectors) {
      const element = page.locator(selector).first();
      if (await element.count() > 0) {
        projectElement = element;
        console.log(`Found project element with selector: ${selector}`);
        break;
      }
    }

    if (!projectElement) {
      // Try to find any clickable link that might be a project
      const links = page.locator('a').filter({ hasText: /.+/ });
      const linkCount = await links.count();
      console.log(`Found ${linkCount} links on the page`);

      // Take screenshot showing what's available
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '02-no-projects-found.png'),
        fullPage: true
      });

      // Try clicking any link that looks like it could be a project
      for (let i = 0; i < Math.min(linkCount, 10); i++) {
        const href = await links.nth(i).getAttribute('href');
        if (href && (href.includes('project') || href.match(/\/[a-f0-9-]{36}/))) {
          projectElement = links.nth(i);
          console.log(`Found potential project link: ${href}`);
          break;
        }
      }
    }

    if (!projectElement) {
      console.log('No projects found on the page. Creating screenshot of current state.');
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, '02-page-state.png'),
        fullPage: true
      });

      // Log page content for debugging
      const pageContent = await page.content();
      console.log('Page title:', await page.title());

      // Still check for console errors
      if (consoleErrors.length > 0) {
        console.log('\n=== CONSOLE ERRORS FOUND ===');
        consoleErrors.forEach(err => console.log(err));
      }
      return;
    }

    // Click on the project
    await projectElement.click();
    await page.waitForLoadState('networkidle');

    // Take screenshot of project detail page
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '03-project-detail.png'),
      fullPage: true
    });
    console.log('Screenshot: project detail page saved');

    // Step 3: Test tabs if they exist
    console.log('Testing tabs...');
    const tabSelectors = [
      '[role="tab"]',
      '.tab',
      '[data-testid*="tab"]',
      'button[role="tab"]',
      '.tabs button',
      '.tab-list button',
    ];

    for (const selector of tabSelectors) {
      const tabs = page.locator(selector);
      const tabCount = await tabs.count();

      if (tabCount > 0) {
        console.log(`Found ${tabCount} tabs with selector: ${selector}`);

        for (let i = 0; i < tabCount; i++) {
          const tab = tabs.nth(i);
          const tabText = await tab.textContent();

          // Skip if tab text contains "delete" (case insensitive)
          if (tabText && tabText.toLowerCase().includes('delete')) {
            console.log(`Skipping delete tab: ${tabText}`);
            continue;
          }

          console.log(`Clicking tab ${i + 1}: ${tabText}`);
          await tab.click();
          await page.waitForTimeout(500); // Wait for tab content to load

          // Take screenshot of each tab
          const safeTabName = (tabText || `tab-${i}`).replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
          await page.screenshot({
            path: path.join(SCREENSHOT_DIR, `04-tab-${safeTabName}.png`),
            fullPage: true
          });
        }
        break;
      }
    }

    // Step 4: Test interactive buttons (excluding delete)
    console.log('Testing interactive buttons...');
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    console.log(`Found ${buttonCount} buttons`);

    const testedButtons: string[] = [];
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const buttonText = await button.textContent();
      const buttonClass = await button.getAttribute('class') || '';
      const buttonDisabled = await button.isDisabled();

      // Skip delete buttons
      if (buttonText && buttonText.toLowerCase().includes('delete')) {
        console.log(`Skipping delete button: ${buttonText}`);
        continue;
      }

      // Skip if button class indicates danger/delete
      if (buttonClass.toLowerCase().includes('delete') ||
          buttonClass.toLowerCase().includes('danger') ||
          buttonClass.toLowerCase().includes('destructive')) {
        console.log(`Skipping danger button: ${buttonText}`);
        continue;
      }

      // Skip disabled buttons
      if (buttonDisabled) {
        console.log(`Skipping disabled button: ${buttonText}`);
        continue;
      }

      // Only test visible buttons
      if (await button.isVisible()) {
        testedButtons.push(buttonText || 'unnamed');
        console.log(`Found interactive button: ${buttonText}`);
      }
    }

    // Step 5: Test dropdown menus if any
    console.log('Testing dropdowns...');
    const dropdownSelectors = [
      '[data-testid*="dropdown"]',
      '.dropdown',
      '[role="combobox"]',
      'select',
      '[data-radix-dropdown-menu-trigger]',
    ];

    for (const selector of dropdownSelectors) {
      const dropdowns = page.locator(selector);
      const dropdownCount = await dropdowns.count();

      if (dropdownCount > 0) {
        console.log(`Found ${dropdownCount} dropdowns with selector: ${selector}`);

        for (let i = 0; i < Math.min(dropdownCount, 3); i++) {
          const dropdown = dropdowns.nth(i);
          if (await dropdown.isVisible()) {
            console.log(`Testing dropdown ${i + 1}`);
            await dropdown.click();
            await page.waitForTimeout(300);

            await page.screenshot({
              path: path.join(SCREENSHOT_DIR, `05-dropdown-${i + 1}.png`),
              fullPage: true
            });

            // Close dropdown by pressing Escape
            await page.keyboard.press('Escape');
          }
        }
        break;
      }
    }

    // Step 6: Test expand/collapse elements
    console.log('Testing expandable elements...');
    const expandSelectors = [
      '[data-state="closed"]',
      '.accordion-trigger',
      '[aria-expanded="false"]',
      '.collapsible',
    ];

    for (const selector of expandSelectors) {
      const expandables = page.locator(selector);
      const expandCount = await expandables.count();

      if (expandCount > 0) {
        console.log(`Found ${expandCount} expandable elements`);

        for (let i = 0; i < Math.min(expandCount, 3); i++) {
          const element = expandables.nth(i);
          if (await element.isVisible()) {
            const text = await element.textContent();
            console.log(`Expanding: ${text?.substring(0, 50)}`);
            await element.click();
            await page.waitForTimeout(300);
          }
        }

        await page.screenshot({
          path: path.join(SCREENSHOT_DIR, '06-expanded-elements.png'),
          fullPage: true
        });
        break;
      }
    }

    // Final screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, '07-final-state.png'),
      fullPage: true
    });

    // Report console errors
    console.log('\n=== TEST COMPLETE ===');
    console.log(`Tested buttons: ${testedButtons.join(', ')}`);

    if (consoleErrors.length > 0) {
      console.log('\n=== CONSOLE ERRORS FOUND ===');
      consoleErrors.forEach(err => console.log(err));
    } else {
      console.log('\nNo console errors detected.');
    }
  });
});
