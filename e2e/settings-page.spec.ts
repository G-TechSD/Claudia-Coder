import { test, expect } from '@playwright/test';
import {
  waitForAppReady,
  setupConsoleErrorCheck,
} from './helpers';

const SCREENSHOT_DIR = '/home/bill/projects/claudia-admin/test-screenshots';

test.describe('Settings Page Tests', () => {
  test('should load settings page and interact with accordions', async ({ page }) => {
    const getErrors = setupConsoleErrorCheck(page);

    // Step 1: Navigate to /settings
    console.log('Step 1: Navigating to /settings...');
    await page.goto('/settings');
    await waitForAppReady(page);

    // Step 2: Take screenshot of initial view
    console.log('Step 2: Taking screenshot of initial view...');
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/settings-initial.png`,
      fullPage: true,
    });
    console.log('Screenshot saved: settings-initial.png');

    // Step 3: Expand "AI Providers" accordion
    console.log('Step 3: Looking for AI Providers accordion...');

    // Look for accordion trigger with "AI Providers" text
    const aiProvidersAccordion = page.locator('button:has-text("AI Providers"), [data-state] >> text=AI Providers').first();

    if (await aiProvidersAccordion.isVisible()) {
      console.log('Found AI Providers accordion, clicking...');
      await aiProvidersAccordion.click();
      await page.waitForTimeout(500); // Wait for animation

      // Step 4: Take screenshot after expanding AI Providers
      console.log('Step 4: Taking screenshot with AI Providers expanded...');
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/settings-ai-providers.png`,
        fullPage: true,
      });
      console.log('Screenshot saved: settings-ai-providers.png');
    } else {
      console.log('AI Providers accordion not found, taking current state screenshot...');
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/settings-ai-providers-not-found.png`,
        fullPage: true,
      });
    }

    // Step 5: Expand "Default Model" accordion
    console.log('Step 5: Looking for Default Model accordion...');

    const defaultModelAccordion = page.locator('button:has-text("Default Model"), [data-state] >> text=Default Model').first();

    if (await defaultModelAccordion.isVisible()) {
      console.log('Found Default Model accordion, clicking...');
      await defaultModelAccordion.click();
      await page.waitForTimeout(500); // Wait for animation

      // Step 6: Take screenshot after expanding Default Model
      console.log('Step 6: Taking screenshot with Default Model expanded...');
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/settings-default-model.png`,
        fullPage: true,
      });
      console.log('Screenshot saved: settings-default-model.png');
    } else {
      console.log('Default Model accordion not found, taking current state screenshot...');
      await page.screenshot({
        path: `${SCREENSHOT_DIR}/settings-default-model-not-found.png`,
        fullPage: true,
      });
    }

    // Step 7: Check for any errors or issues
    console.log('Step 7: Checking for console errors...');
    const errors = getErrors();

    if (errors.length > 0) {
      console.log('Console errors found:', errors);
    } else {
      console.log('No console errors found!');
    }

    // Take a final screenshot showing the full settings page
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/settings-final.png`,
      fullPage: true,
    });
    console.log('Screenshot saved: settings-final.png');

    // Report findings
    console.log('\n=== SETTINGS PAGE TEST RESULTS ===');
    console.log('Page URL:', page.url());
    console.log('Console errors:', errors.length);

    // Verify page loaded correctly (no hard failure if accordion missing)
    await expect(page.locator('body')).toBeVisible();
  });

  test('should explore all accordions on settings page', async ({ page }) => {
    const getErrors = setupConsoleErrorCheck(page);

    await page.goto('/settings');
    await waitForAppReady(page);

    // Find all accordion triggers
    const accordionTriggers = page.locator('[data-state="closed"], button[aria-expanded="false"]');
    const count = await accordionTriggers.count();

    console.log(`Found ${count} potential accordion triggers`);

    // Take screenshot of page structure
    await page.screenshot({
      path: `${SCREENSHOT_DIR}/settings-structure.png`,
      fullPage: true,
    });

    // Log all headings and buttons for debugging
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();
    console.log('Headings found:', headings);

    const buttons = await page.locator('button').allTextContents();
    console.log('Buttons found:', buttons.slice(0, 20)); // First 20 buttons

    const errors = getErrors();
    expect(errors.length).toBe(0);
  });
});
