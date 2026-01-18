/**
 * Playwright script to capture settings page screenshots
 * Run with: npx playwright test e2e/settings-provider-screenshot.ts --headed
 * Or: node -e "require('./e2e/settings-provider-screenshot.ts')" (after ts compilation)
 */

import { chromium, Browser, Page } from 'playwright';

const SCREENSHOTS_DIR = 'test-results/screenshots';

async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `${SCREENSHOTS_DIR}/${name}.png`,
    fullPage: true,
  });
  console.log(`Screenshot saved: ${SCREENSHOTS_DIR}/${name}.png`);
}

async function main() {
  console.log('Starting Playwright script for settings page screenshots...\n');

  let browser: Browser | null = null;

  try {
    // Launch browser
    browser = await chromium.launch({
      headless: true, // Set to false to see the browser
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true, // Allow self-signed certificates
    });

    const page = await context.newPage();

    // 1. Go to settings page
    console.log('1. Navigating to https://localhost:3000/settings...');
    await page.goto('https://localhost:3000/settings');

    // 2. Wait for page to load (3 seconds as requested)
    console.log('2. Waiting 3 seconds for page to load...');
    await page.waitForTimeout(3000);

    // Also wait for sidebar to be visible (app shell loaded)
    await page.waitForSelector('aside', { state: 'visible', timeout: 10000 }).catch(() => {
      console.log('   Note: Sidebar not found, continuing anyway...');
    });

    // 3. Take full page screenshot (shows default view)
    console.log('3. Taking full page screenshot (settings-default-provider-closed)...');
    await takeScreenshot(page, 'settings-default-provider-closed');

    // 4. Find and click the "Default AI Provider" dropdown
    console.log('4. Looking for Default AI Provider dropdown...');

    // The dropdown is a Select component with a trigger button
    // Look for the label text first to locate the section
    const defaultProviderSection = page.locator('text=Default AI Provider').first();

    if (await defaultProviderSection.isVisible()) {
      console.log('   Found "Default AI Provider" label');

      // Find the select trigger (button) near the Default AI Provider label
      // The SelectTrigger is typically a button with role="combobox"
      const selectTrigger = page.locator('[role="combobox"]').first();

      // Alternative selectors to try
      const alternateSelectors = [
        'button:has-text("Select provider")',
        'button[aria-haspopup="listbox"]',
        '.w-\\[200px\\] button', // The 200px width class from the component
      ];

      let clicked = false;

      if (await selectTrigger.isVisible()) {
        console.log('   Found select trigger (combobox), clicking...');
        await selectTrigger.click();
        clicked = true;
      } else {
        // Try alternate selectors
        for (const selector of alternateSelectors) {
          const element = page.locator(selector).first();
          if (await element.isVisible().catch(() => false)) {
            console.log(`   Found dropdown with selector: ${selector}`);
            await element.click();
            clicked = true;
            break;
          }
        }
      }

      if (clicked) {
        // Wait for dropdown to open
        await page.waitForTimeout(500);

        // 5. Take screenshot showing dropdown options
        console.log('5. Taking screenshot with dropdown open (settings-default-provider-open)...');
        await takeScreenshot(page, 'settings-default-provider-open');

        // Capture the dropdown options for reporting
        console.log('\n--- Analyzing Dropdown Options ---');

        // SelectContent uses [role="listbox"]
        const listbox = page.locator('[role="listbox"]');
        if (await listbox.isVisible().catch(() => false)) {
          // Get all options
          const options = listbox.locator('[role="option"]');
          const optionCount = await options.count();

          console.log(`Found ${optionCount} provider options in dropdown:`);

          for (let i = 0; i < optionCount; i++) {
            const option = options.nth(i);
            const text = await option.textContent();
            const isDisabled = await option.getAttribute('aria-disabled') === 'true';
            const hasGreenDot = await option.locator('.bg-green-500').count() > 0;

            const status = isDisabled ? ' (DISABLED - not configured/connected)' :
                          hasGreenDot ? ' (Connected)' : ' (Status unknown)';

            console.log(`  ${i + 1}. ${text?.trim()}${status}`);
          }
        } else {
          console.log('   Could not find listbox - dropdown may not have opened');
        }

        // Close dropdown by clicking elsewhere
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      } else {
        console.log('   WARNING: Could not find Default AI Provider dropdown');
      }
    } else {
      console.log('   WARNING: "Default AI Provider" section not found on page');
      console.log('   This might mean you need to navigate to the Connections tab first');
    }

    // 6. Click on Connections tab and take screenshot
    console.log('\n6. Looking for Connections tab...');

    // Try different selectors for the Connections tab
    const connectionsTabSelectors = [
      'button:has-text("Connections")',
      '[role="tab"]:has-text("Connections")',
      'a:has-text("Connections")',
      'text=Connections',
    ];

    let connectionsTabClicked = false;

    for (const selector of connectionsTabSelectors) {
      const tab = page.locator(selector).first();
      if (await tab.isVisible().catch(() => false)) {
        console.log(`   Found Connections tab with selector: ${selector}`);
        await tab.click();
        connectionsTabClicked = true;
        break;
      }
    }

    if (connectionsTabClicked) {
      // Wait for tab content to load
      await page.waitForTimeout(1000);

      console.log('7. Taking screenshot of Connections tab (settings-connections-tab)...');
      await takeScreenshot(page, 'settings-connections-tab');

      // Now try to find the Default AI Provider dropdown again if it wasn't visible before
      const defaultProviderInConnections = page.locator('text=Default AI Provider').first();
      if (await defaultProviderInConnections.isVisible()) {
        console.log('\n   Default AI Provider section is on the Connections tab');

        // Click the dropdown to see options
        const selectTrigger = page.locator('[role="combobox"]').first();
        if (await selectTrigger.isVisible()) {
          await selectTrigger.click();
          await page.waitForTimeout(500);

          // Re-capture screenshot if we didn't get the open dropdown earlier
          const listbox = page.locator('[role="listbox"]');
          if (await listbox.isVisible().catch(() => false)) {
            console.log('\n--- Providers in Default AI Provider dropdown ---');

            const options = listbox.locator('[role="option"]');
            const optionCount = await options.count();

            for (let i = 0; i < optionCount; i++) {
              const option = options.nth(i);
              const text = await option.textContent();
              const isDisabled = await option.getAttribute('aria-disabled') === 'true';
              const hasGreenDot = await option.locator('.bg-green-500').count() > 0;
              const hasGrayDot = await option.locator('.bg-gray-400').count() > 0;

              let status = '';
              if (isDisabled) {
                status = ' [NOT CONNECTED - needs API key]';
              } else if (hasGreenDot) {
                status = ' [CONNECTED]';
              } else if (hasGrayDot) {
                status = ' [NOT CONNECTED]';
              }

              console.log(`  - ${text?.trim()}${status}`);
            }

            // Take another screenshot with dropdown open on connections tab
            await takeScreenshot(page, 'settings-default-provider-open');
          }

          await page.keyboard.press('Escape');
        }
      }
    } else {
      console.log('   Note: Connections tab not found - page may already show connections');
    }

    console.log('\n--- Script Complete ---');
    console.log('Screenshots saved to: test-results/screenshots/');

  } catch (error) {
    console.error('Error running script:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the script
main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});
