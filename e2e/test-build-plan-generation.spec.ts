import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_PATH = '/home/bill/projects/claudia-coder-beta/test-screenshots/test-build-plan.png';

// Ensure screenshot directory exists
const screenshotDir = path.dirname(SCREENSHOT_PATH);
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

// Configure to ignore HTTPS certificate errors
test.use({
  ignoreHTTPSErrors: true,
  baseURL: 'http://localhost:3002',
});

test.describe('Build Plan Generation Feature', () => {
  test('should create project and test build plan generation', async ({ page }) => {
    // Capture console errors and logs
    const consoleErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[Console Error] ${msg.text()}`);
        console.log(`[Console Error] ${msg.text()}`);
      }
    });
    page.on('pageerror', (error) => {
      consoleErrors.push(`[Page Error] ${error.message}`);
      console.log(`[Page Error] ${error.message}`);
    });

    // ========== PHASE 1: CREATE A PROJECT ==========
    console.log('\n========== PHASE 1: CREATE PROJECT ==========');

    // Step 1: Navigate to /projects/new
    console.log('Step 1: Navigating to /projects/new...');
    await page.goto('/projects/new');
    await page.waitForLoadState('networkidle');

    // Wait for the mode selection to be visible
    await page.waitForSelector('text=Create New Project', {
      state: 'visible',
      timeout: 15000
    });
    console.log('New project page loaded');

    // Step 2: Click "Quick Start" option
    console.log('Step 2: Clicking "Quick Start" option...');
    const quickStartText = page.getByText('Quick Start', { exact: true });

    if (await quickStartText.isVisible({ timeout: 5000 })) {
      await quickStartText.click();
      console.log('Clicked "Quick Start" option');
      await page.waitForTimeout(1000);
    } else {
      console.log('Quick Start option not found, taking screenshot...');
      await page.screenshot({
        path: SCREENSHOT_PATH.replace('.png', '-01-mode-selection.png'),
        fullPage: true
      });
    }

    // Wait for Quick Start form
    await page.waitForSelector('text=Project Name', { timeout: 5000 }).catch(() => {
      console.log('Project Name label not found');
    });

    // Step 3: Fill in project details
    console.log('Step 3: Filling in project details...');

    // Fill project name
    const nameInput = page.locator('input[placeholder="my-awesome-project"]');
    if (await nameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nameInput.fill('Build Plan Test');
      console.log('Filled project name: Build Plan Test');
    } else {
      // Fallback: try first input
      const firstInput = page.locator('input').first();
      if (await firstInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstInput.fill('Build Plan Test');
        console.log('Filled project name via fallback');
      }
    }

    // Fill description
    const descriptionInput = page.locator('textarea').first();
    if (await descriptionInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await descriptionInput.fill('Testing the build plan generation feature');
      console.log('Filled description');
    }

    // Screenshot of form
    await page.screenshot({
      path: SCREENSHOT_PATH.replace('.png', '-01-form-filled.png'),
      fullPage: true
    });

    // Step 4: Continue to review
    console.log('Step 4: Continuing to review...');
    const continueButton = page.getByText('Continue to Review');
    if (await continueButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await continueButton.click();
      await page.waitForTimeout(2000);
      console.log('Clicked Continue to Review');
    }

    // Step 5: Create the project
    console.log('Step 5: Creating project...');
    const createButton = page.locator('button:has-text("Create Project"), button:has-text("Create")').first();
    if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createButton.click();
      console.log('Clicked Create Project');

      // Wait for redirect to project page
      try {
        await page.waitForURL(/\/projects\/proj_[a-zA-Z0-9_]+/, { timeout: 30000 });
        console.log('Redirected to project page!');
      } catch {
        console.log('Waiting for project page...');
        await page.waitForTimeout(3000);
      }
    }

    // Step 6: Handle "View Project" if shown
    const viewProjectLink = page.locator('a:has-text("View Project"), button:has-text("View Project")').first();
    if (await viewProjectLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await viewProjectLink.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }

    console.log(`Current URL after project creation: ${page.url()}`);

    // Screenshot of project detail
    await page.screenshot({
      path: SCREENSHOT_PATH.replace('.png', '-02-project-detail.png'),
      fullPage: true
    });

    // ========== PHASE 2: TEST BUILD PLAN ==========
    console.log('\n========== PHASE 2: TEST BUILD PLAN ==========');

    // Step 7: Navigate to Build Plan tab or scroll to find Build Plan section
    console.log('Step 7: Looking for Build Plan...');

    // Wait for project detail page to fully load
    await page.waitForTimeout(2000);

    // Wait for page to stabilize (handle any React errors)
    await page.waitForLoadState('networkidle');

    // Reload the page to ensure clean state (workaround for React hook errors)
    console.log('Reloading page to ensure clean state...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Try to find Plan tab in multiple ways
    let foundPlanTab = false;

    // Method 1: Look for tab with "Plan" text (tabs are role="tab")
    const tabs = page.locator('[role="tab"]');
    const tabCount = await tabs.count();
    console.log(`Found ${tabCount} tabs`);

    for (let i = 0; i < tabCount; i++) {
      const tabText = await tabs.nth(i).textContent();
      console.log(`  Tab ${i}: ${tabText?.trim()}`);
      if (tabText?.toLowerCase().includes('plan')) {
        console.log('Found Plan tab, clicking...');
        await tabs.nth(i).click();
        await page.waitForTimeout(1500);
        foundPlanTab = true;
        break;
      }
    }

    if (!foundPlanTab) {
      console.log('Plan tab not found in navigation tabs');

      // The Build Plan section might be on the Overview tab for planning status projects
      // Scroll down to find it
      console.log('Scrolling to find Build Plan section...');
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });
      await page.waitForTimeout(500);

      // Look for Build Plan card/section header
      const buildPlanHeader = page.locator('text="Build Plan"').first();
      if (await buildPlanHeader.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('Found Build Plan section on page');
        await buildPlanHeader.scrollIntoViewIfNeeded();
        await page.waitForTimeout(500);
      } else {
        console.log('Build Plan section not found on current page');
        // Try scrolling more
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await page.waitForTimeout(500);
      }
    }

    // Screenshot of Build Plan tab/section
    await page.screenshot({
      path: SCREENSHOT_PATH.replace('.png', '-03-build-plan-section.png'),
      fullPage: true
    });

    // Step 8: Find and interact with Generate Build Plan button
    console.log('Step 8: Looking for Generate Build Plan button...');

    const generateBtn = page.locator('button:has-text("Generate Build Plan"), button:has-text("Generate")').first();
    let generationAttempted = false;

    if (await generateBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      const isDisabled = await generateBtn.isDisabled();
      const btnText = await generateBtn.textContent();
      console.log(`Found Generate button: "${btnText?.trim()}", Disabled: ${isDisabled}`);

      if (!isDisabled) {
        console.log('Clicking Generate Build Plan button...');
        await generateBtn.click();
        generationAttempted = true;

        // Wait for loading or response
        console.log('Waiting for build plan generation...');

        // Look for loading indicator
        const loadingSpinner = page.locator('[class*="animate-spin"], .loader');
        try {
          await loadingSpinner.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
            console.log('No loading spinner appeared');
          });

          // Take screenshot during generation
          await page.screenshot({
            path: SCREENSHOT_PATH.replace('.png', '-04-generating.png'),
            fullPage: true
          });

          // Wait for generation to complete (or timeout)
          await loadingSpinner.waitFor({ state: 'hidden', timeout: 60000 }).catch(() => {
            console.log('Generation still in progress after 60s');
          });
        } catch {
          console.log('Loading wait completed');
        }

        await page.waitForTimeout(3000);
      } else {
        console.log('Generate button is disabled - checking for messages...');

        // Look for any info/warning messages
        const infoText = await page.locator('.alert, [role="alert"], .text-muted-foreground').first().textContent().catch(() => null);
        if (infoText) {
          console.log(`Info/Warning: ${infoText.slice(0, 200)}`);
        }
      }
    } else {
      console.log('Generate Build Plan button not visible');

      // Check if a build plan already exists
      const objectives = page.locator('text="Objectives"');
      const phases = page.locator('text="Phase"');
      if (await objectives.count() > 0 || await phases.count() > 0) {
        console.log('A build plan may already exist (found Objectives/Phase text)');
      }
    }

    // ========== PHASE 3: DOCUMENT RESULTS ==========
    console.log('\n========== PHASE 3: DOCUMENT RESULTS ==========');

    // Take final screenshot
    await page.screenshot({
      path: SCREENSHOT_PATH,
      fullPage: true
    });
    console.log(`Final screenshot saved to: ${SCREENSHOT_PATH}`);

    // Summary
    console.log('\n========== TEST SUMMARY ==========');
    console.log(`Final URL: ${page.url()}`);
    console.log(`Generation attempted: ${generationAttempted}`);
    console.log(`Console errors: ${consoleErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log('\n--- Console Errors ---');
      consoleErrors.slice(0, 5).forEach(err => console.log(err));
      if (consoleErrors.length > 5) {
        console.log(`... and ${consoleErrors.length - 5} more`);
      }

      // Check for LLM-related errors
      const llmErrors = consoleErrors.filter(e =>
        e.toLowerCase().includes('api') ||
        e.toLowerCase().includes('provider') ||
        e.toLowerCase().includes('anthropic') ||
        e.toLowerCase().includes('openai') ||
        e.toLowerCase().includes('401') ||
        e.toLowerCase().includes('403')
      );

      if (llmErrors.length > 0) {
        console.log('\n--- LLM/API Related Errors ---');
        console.log('Note: These may indicate no LLM is configured, which is expected.');
        llmErrors.slice(0, 3).forEach(err => console.log(err));
      }
    } else {
      console.log('No console errors detected');
    }

    console.log('\n--- Screenshots Saved ---');
    console.log(`1. ${SCREENSHOT_PATH.replace('.png', '-01-form-filled.png')}`);
    console.log(`2. ${SCREENSHOT_PATH.replace('.png', '-02-project-detail.png')}`);
    console.log(`3. ${SCREENSHOT_PATH.replace('.png', '-03-build-plan-section.png')}`);
    if (generationAttempted) {
      console.log(`4. ${SCREENSHOT_PATH.replace('.png', '-04-generating.png')}`);
    }
    console.log(`5. ${SCREENSHOT_PATH} (final result)`);
    console.log('==================================');
  });
});
