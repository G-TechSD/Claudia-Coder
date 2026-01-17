import { test, expect, Page } from '@playwright/test';

/**
 * Easy Mode Flow E2E Test
 * Tests the complete project creation wizard flow
 */

const SCREENSHOT_DIR = '/tmp/easy-mode-final-test';

// Helper to take screenshot with timestamp
async function takeScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}-${timestamp}.png`,
    fullPage: true,
  });
}

// Helper to wait for loading spinners to disappear
async function waitForSpinnersToDisappear(page: Page, timeout = 60000): Promise<void> {
  await page.waitForFunction(() => {
    const spinners = document.querySelectorAll('[class*="animate-spin"]');
    return spinners.length === 0;
  }, { timeout }).catch(() => {
    // Ignore timeout - continue test
  });
}

test.describe('Easy Mode Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Set up console error collection
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });

    page.on('pageerror', error => {
      console.log('Page error:', error.message);
    });
  });

  test('should complete the full Easy Mode project creation flow', async ({ page }) => {
    // Increase timeout for this comprehensive test
    test.setTimeout(180000); // 3 minutes

    console.log('Starting Easy Mode flow test...');

    // ============================================
    // Step 1: Navigate to /easy-mode
    // ============================================
    console.log('Step 1: Navigating to /easy-mode');
    await page.goto('/easy-mode');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h1:has-text("Easy Mode")', { timeout: 15000 });

    await takeScreenshot(page, '01-easy-mode-landing');
    console.log('Screenshot: Easy Mode landing page');

    // Verify we're on step 1
    const projectInfoTitle = page.locator('text=Project Information');
    await expect(projectInfoTitle).toBeVisible();

    // ============================================
    // Step 2: Enter project name and description
    // ============================================
    console.log('Step 2: Entering project name and description');

    const projectNameInput = page.locator('#projectName');
    const projectDescInput = page.locator('#projectDescription');

    await projectNameInput.fill('Test E2E Project');
    await projectDescInput.fill('A test project created by the Playwright E2E test. This project demonstrates the Easy Mode wizard flow with automated testing capabilities.');

    await takeScreenshot(page, '02-project-info-filled');
    console.log('Screenshot: Project info filled');

    // Click Next to go to brain dump
    const nextButton = page.locator('button:has-text("Next")');
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    // ============================================
    // Step 3: Brain Dump (optional - we'll skip it)
    // ============================================
    console.log('Step 3: Brain dump step (skipping)');

    await page.waitForSelector('text=Brain Dump', { timeout: 10000 });
    await takeScreenshot(page, '03-brain-dump-step');
    console.log('Screenshot: Brain dump step');

    // Optional: Add some brain dump text
    const brainDumpTextarea = page.locator('textarea[placeholder*="additional context"]');
    if (await brainDumpTextarea.isVisible()) {
      await brainDumpTextarea.fill('Additional requirements: This is an optional brain dump providing extra context for the AI to consider when generating the build plan.');
    }

    await takeScreenshot(page, '03b-brain-dump-filled');

    // Click Generate Plan to proceed
    const generateButton = page.locator('button:has-text("Generate Plan")');
    await expect(generateButton).toBeEnabled();
    await generateButton.click();

    // ============================================
    // Step 4: Generate plan and wait for completion
    // ============================================
    console.log('Step 4: Waiting for plan generation...');

    // Should now see the Generate step
    await page.waitForSelector('text=Generate Build Plan', { timeout: 10000 });

    // Wait for generation to start
    await page.waitForSelector('[class*="animate-spin"], text=Analyzing', { timeout: 10000 }).catch(() => {});
    await takeScreenshot(page, '04-generation-started');
    console.log('Screenshot: Generation started');

    // Wait for generation to complete (up to 90 seconds)
    console.log('Waiting for plan generation to complete (up to 90 seconds)...');

    // Wait for either success indicator or error
    await Promise.race([
      page.waitForSelector('text=Build plan generated', { timeout: 90000 }),
      page.waitForSelector('text=Build plan ready', { timeout: 90000 }),
      page.waitForSelector('[class*="text-green-500"]:has-text("generated")', { timeout: 90000 }),
    ]).catch(async () => {
      // Take screenshot of current state if generation seems stuck
      await takeScreenshot(page, '04-generation-timeout');
      console.log('Generation may have timed out - checking current state');
    });

    // Wait a moment for UI to settle
    await page.waitForTimeout(2000);
    await waitForSpinnersToDisappear(page);

    await takeScreenshot(page, '05-generation-complete');
    console.log('Screenshot: Generation complete');

    // Check if there was an error
    const errorElement = page.locator('text=Generation failed');
    if (await errorElement.isVisible()) {
      await takeScreenshot(page, '05-generation-error');
      console.log('ERROR: Generation failed');
      // Try again button
      const retryButton = page.locator('button:has-text("Try Again")');
      if (await retryButton.isVisible()) {
        console.log('Clicking Try Again...');
        await retryButton.click();
        await page.waitForTimeout(2000);
      }
    }

    // Click Next to go to Review
    const nextToReview = page.locator('button:has-text("Next")');
    if (await nextToReview.isEnabled()) {
      await nextToReview.click();
    }

    // ============================================
    // Step 5: Review the generated plan
    // ============================================
    console.log('Step 5: Reviewing generated plan');

    await page.waitForSelector('text=Review Build Plan', { timeout: 15000 });
    await page.waitForTimeout(1000); // Let UI settle

    await takeScreenshot(page, '06-review-plan');
    console.log('Screenshot: Review plan');

    // Verify plan content is visible - use more specific selector
    const packetsLabel = page.locator('label:has-text("Work Packets")');
    await expect(packetsLabel).toBeVisible();

    // Scroll through packets if needed
    const scrollArea = page.locator('[class*="ScrollArea"], [data-radix-scroll-area-viewport]').first();
    if (await scrollArea.isVisible()) {
      await scrollArea.evaluate(el => el.scrollTop = 500);
      await takeScreenshot(page, '06b-review-plan-scrolled');
    }

    // ============================================
    // Step 6: Click Approve Plan
    // ============================================
    console.log('Step 6: Approving the plan');

    const approveButton = page.locator('button:has-text("Approve Plan")');
    await expect(approveButton).toBeVisible();
    await approveButton.click();

    // Verify approval
    const approvedIndicator = page.locator('button:has-text("Approved")');
    await expect(approvedIndicator).toBeVisible({ timeout: 5000 });

    await takeScreenshot(page, '07-plan-approved');
    console.log('Screenshot: Plan approved');

    // Click Start Build to proceed
    const startBuildButton = page.locator('button:has-text("Start Build")');
    await expect(startBuildButton).toBeEnabled();
    await startBuildButton.click();

    // ============================================
    // Step 7: Watch build execution
    // ============================================
    console.log('Step 7: Watching build execution');

    await page.waitForSelector('text=Build Project', { timeout: 10000 });

    // Wait for build to start
    await page.waitForSelector('[class*="animate-spin"], text=Creating', { timeout: 10000 }).catch(() => {});
    await takeScreenshot(page, '08-build-started');
    console.log('Screenshot: Build started');

    // Wait for build to complete (up to 60 seconds)
    console.log('Waiting for build to complete...');

    await Promise.race([
      page.waitForSelector('text=Project created successfully', { timeout: 60000 }),
      page.waitForSelector('text=created successfully', { timeout: 60000 }),
    ]).catch(async () => {
      await takeScreenshot(page, '08-build-timeout');
      console.log('Build may have timed out');
    });

    await waitForSpinnersToDisappear(page);
    await page.waitForTimeout(2000);

    await takeScreenshot(page, '09-build-complete');
    console.log('Screenshot: Build complete');

    // Check for build errors
    const buildError = page.locator('text=Build failed');
    if (await buildError.isVisible()) {
      await takeScreenshot(page, '09-build-error');
      console.log('ERROR: Build failed');
    }

    // Click Next to go to Results
    const nextToResults = page.locator('button:has-text("Next")');
    if (await nextToResults.isEnabled()) {
      await nextToResults.click();
    }

    // ============================================
    // Step 8: Check results page
    // ============================================
    console.log('Step 8: Checking results page');

    await page.waitForSelector('text=Project Ready', { timeout: 15000 });
    await page.waitForTimeout(2000);

    await takeScreenshot(page, '10-results-page');
    console.log('Screenshot: Results page');

    // Verify key elements on results page
    const projectReadyTitle = page.locator('text=Project Ready');
    await expect(projectReadyTitle).toBeVisible();

    // Check for Open Project button
    const openProjectButton = page.locator('button:has-text("Open Project")');
    await expect(openProjectButton).toBeVisible();

    // Check for Download PRD button
    const downloadPrdButton = page.locator('button:has-text("Download PRD")');
    await expect(downloadPrdButton).toBeVisible();

    // Check for working directory display
    const workingDirElement = page.locator('code');
    if (await workingDirElement.isVisible()) {
      const workingDir = await workingDirElement.textContent();
      console.log('Project working directory:', workingDir);
    }

    // Check for file browser if present
    const fileBrowser = page.locator('text=Files, text=File Browser').first();
    if (await fileBrowser.isVisible()) {
      await takeScreenshot(page, '11-file-browser');
      console.log('Screenshot: File browser');
    }

    // Final screenshot
    await takeScreenshot(page, '12-final-state');
    console.log('Screenshot: Final state');

    console.log('Easy Mode flow test completed successfully!');
  });

  test('should handle navigation back and forth', async ({ page }) => {
    test.setTimeout(60000);

    await page.goto('/easy-mode');
    await page.waitForLoadState('networkidle');

    // Fill step 1
    await page.locator('#projectName').fill('Navigation Test');
    await page.locator('#projectDescription').fill('Testing navigation');

    // Go to step 2
    await page.locator('button:has-text("Next")').click();
    await page.waitForSelector('text=Brain Dump');

    await takeScreenshot(page, 'nav-01-step2');

    // Go back to step 1
    await page.locator('button:has-text("Back")').click();
    await page.waitForSelector('text=Project Information');

    // Verify data is preserved
    await expect(page.locator('#projectName')).toHaveValue('Navigation Test');

    await takeScreenshot(page, 'nav-02-back-to-step1');

    console.log('Navigation test completed');
  });

  test('should validate required fields', async ({ page }) => {
    test.setTimeout(30000);

    await page.goto('/easy-mode');
    await page.waitForLoadState('networkidle');

    // Try to proceed without filling fields
    const nextButton = page.locator('button:has-text("Next")');

    // Button should be disabled without required fields
    await expect(nextButton).toBeDisabled();

    await takeScreenshot(page, 'validation-01-disabled');

    // Fill only name
    await page.locator('#projectName').fill('Partial Data');
    await expect(nextButton).toBeDisabled();

    // Fill description too
    await page.locator('#projectDescription').fill('Now we have both');
    await expect(nextButton).toBeEnabled();

    await takeScreenshot(page, 'validation-02-enabled');

    console.log('Validation test completed');
  });
});
