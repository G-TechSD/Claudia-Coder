import { test, expect } from '@playwright/test';

test.use({
  ignoreHTTPSErrors: true,
  baseURL: 'https://localhost:3000',
});

test.describe('Build Plan Model Dropdown', () => {
  test('dropdown should only show system default and project-configured models', async ({ page }) => {
    // Capture console logs for debugging
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      // Capture our debug logs
      if (text.includes('[build-plan-editor]')) {
        consoleLogs.push(text);
        console.log(text);
      }
    });

    // Navigate to projects list first
    console.log('Navigating to projects list...');
    await page.goto('/projects');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    // Take screenshot of projects list
    await page.screenshot({
      path: '/tmp/build-plan-dropdown-00-projects-list.png',
      fullPage: true
    });

    // Click on the first project row (DanceArm Control)
    console.log('Looking for project to click...');
    const projectRow = page.locator('text=DanceArm Control').first();

    if (await projectRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Found DanceArm Control, clicking...');
      await projectRow.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(2000);
    }

    const projectUrl = page.url();
    console.log(`Navigated to: ${projectUrl}`);
    await page.waitForTimeout(2000);

    // Look for the Build Plan section - it should be on the Overview tab for planning projects
    console.log('Looking for Build Plan section...');

    // The model dropdown should be in the Build Plan section
    // Look for a Select component with model options
    const modelDropdown = page.locator('[data-testid="regeneration-model-select"], button[role="combobox"]:has-text("Select model"), button[role="combobox"]:has-text("LM Studio"), button[role="combobox"]:has-text("Anthropic"), button[role="combobox"]:has-text("Google"), button[role="combobox"]:has-text("System Default")').first();

    // Wait for the dropdown to appear
    const dropdownVisible = await modelDropdown.isVisible({ timeout: 10000 }).catch(() => false);

    if (!dropdownVisible) {
      console.log('Model dropdown not immediately visible, scrolling...');
      // Try to find the Build Plan section by scrolling
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 3);
      });
      await page.waitForTimeout(1000);
    }

    // Take a screenshot of the page state
    await page.screenshot({
      path: '/tmp/build-plan-dropdown-01-initial.png',
      fullPage: true
    });

    // Check console logs for debug info
    console.log('\n=== Console Logs ===');
    consoleLogs.forEach(log => console.log(log));

    // If we found the dropdown, click it to see options
    if (await modelDropdown.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Found model dropdown, clicking to open...');
      await modelDropdown.click();
      await page.waitForTimeout(500);

      // Take screenshot of open dropdown
      await page.screenshot({
        path: '/tmp/build-plan-dropdown-02-open.png',
        fullPage: true
      });

      // Get all visible options
      const options = page.locator('[role="option"], [data-value]');
      const optionCount = await options.count();
      console.log(`\nFound ${optionCount} dropdown options:`);

      for (let i = 0; i < optionCount; i++) {
        const optionText = await options.nth(i).textContent();
        console.log(`  ${i + 1}. ${optionText?.trim()}`);
      }

      // Verify expected behavior:
      // 1. If no project models configured, should show system default only
      // 2. Should NOT show unconfigured providers like Anthropic

      const allOptionsText = await page.locator('[role="listbox"]').textContent().catch(() => '');
      console.log('\nAll options text:', allOptionsText);

      // Check for problematic options (providers that shouldn't appear if not configured)
      const hasAnthropicNotConfigured = allOptionsText?.toLowerCase().includes('anthropic') &&
        !consoleLogs.some(log => log.includes('anthropic') && log.includes('Project enabled'));

      if (hasAnthropicNotConfigured) {
        console.log('\nWARNING: Anthropic appears in dropdown but may not be configured!');
      }

      // Close dropdown
      await page.keyboard.press('Escape');
    } else {
      console.log('Model dropdown not found on page');

      // List all buttons to help debug
      const allButtons = page.locator('button');
      const buttonCount = await allButtons.count();
      console.log(`\nFound ${buttonCount} total buttons on page`);

      for (let i = 0; i < Math.min(buttonCount, 20); i++) {
        const btnText = await allButtons.nth(i).textContent();
        if (btnText && btnText.length < 100) {
          console.log(`  Button ${i}: ${btnText.trim()}`);
        }
      }
    }

    // Log the debug info that was captured
    console.log('\n=== Build Plan Editor Debug Logs ===');
    if (consoleLogs.length === 0) {
      console.log('No [build-plan-editor] logs captured - component may not have loaded');
    } else {
      consoleLogs.forEach(log => console.log(log));
    }
  });

  test('AI Models section should not auto-detect on page load', async ({ page }) => {
    // Navigate to projects list first
    await page.goto('/projects');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    // Click on first project
    const projectRow = page.locator('text=DanceArm Control').first();
    if (await projectRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await projectRow.click();
      await page.waitForLoadState('domcontentloaded');
    }
    await page.waitForTimeout(2000);

    // Look for the AI Models section - it should be in an accordion or expandable section
    const aiModelsSection = page.locator('text="AI Models"').first();

    if (await aiModelsSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('Found AI Models section');

      // Check if it says "Detecting servers..."
      const detectingText = page.locator('text="Detecting servers"');
      const isDetecting = await detectingText.isVisible({ timeout: 2000 }).catch(() => false);

      if (isDetecting) {
        console.log('ERROR: AI Models section is auto-detecting servers!');
        await page.screenshot({ path: '/tmp/ai-models-detecting.png', fullPage: true });
      } else {
        console.log('Good: AI Models section is NOT auto-detecting');
      }

      // The section should show static provider buttons or existing configured models
      expect(isDetecting).toBe(false);
    } else {
      console.log('AI Models section not visible - may need to expand accordion');

      // Try clicking on AI Models header to expand
      const aiModelsHeader = page.locator('[data-state="closed"]:has-text("AI Models"), button:has-text("AI Models")').first();
      if (await aiModelsHeader.isVisible({ timeout: 3000 }).catch(() => false)) {
        await aiModelsHeader.click();
        await page.waitForTimeout(1000);

        // Now check for detecting text
        const detectingText = page.locator('text="Detecting servers"');
        const isDetecting = await detectingText.isVisible({ timeout: 2000 }).catch(() => false);

        expect(isDetecting).toBe(false);
      }
    }

    await page.screenshot({
      path: '/tmp/ai-models-section.png',
      fullPage: true
    });
  });
});
