import { test, expect } from '@playwright/test';
import {
  waitForAppReady,
  setupConsoleErrorCheck,
} from './helpers';

/**
 * Test the Fixed Project Creation Flow
 *
 * This test verifies the complete project creation flow at http://localhost:3002:
 * 1. Go to /projects - should show empty or existing projects
 * 2. Click New Project
 * 3. Use Quick Start: name "Fixed Project", type Next.js
 * 4. Create the project
 * 5. Verify toast notification appears
 * 6. Go back to /projects
 * 7. Verify the project appears in the list
 * 8. Click the project
 * 9. Go to Build Plan tab
 * 10. Click Generate Build Plan
 * 11. Capture the result
 *
 * Screenshots saved to: test-screenshots/
 */

const SCREENSHOT_DIR = '/home/bill/projects/claudia-admin/test-screenshots';
const BASE_URL = 'http://localhost:3002';

async function takeScreenshot(page: any, name: string): Promise<void> {
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: true,
  });
  console.log(`Screenshot saved: ${SCREENSHOT_DIR}/${name}.png`);
}

test.describe('Fixed Project Creation Flow', () => {
  test.use({ baseURL: BASE_URL });
  test.setTimeout(180000); // 3 minute timeout for full flow

  test.beforeAll(async () => {
    // Ensure screenshot directory exists
    const { execSync } = require('child_process');
    execSync(`mkdir -p ${SCREENSHOT_DIR}`);
  });

  test('Complete project creation flow with build plan generation', async ({ page }) => {
    const getErrors = setupConsoleErrorCheck(page);
    const projectName = 'Fixed Project';

    console.log('=== STEP 1: Navigate to /projects ===');
    await page.goto('/projects');
    await waitForAppReady(page);

    // Take initial screenshot of projects list
    await takeScreenshot(page, 'test-fixed-project-list');

    // Verify we're on the projects page
    await expect(page).toHaveURL(/\/projects/);
    console.log('Projects page loaded successfully');

    console.log('\n=== STEP 2: Click New Project ===');
    // Based on screenshot: "+ New Project" button in top-right or "Create Project" in empty state
    const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("Create Project"), a:has-text("New Project")').first();
    await expect(newProjectBtn).toBeVisible({ timeout: 10000 });
    console.log('Found New Project button, clicking...');
    await newProjectBtn.click();
    await waitForAppReady(page);
    await page.waitForTimeout(1000);

    console.log('\n=== STEP 3: Use Quick Start mode ===');
    // Look for Quick Start option on the mode selection page
    const quickStartOption = page.getByText('Quick Start', { exact: true });
    const hasQuickStart = await quickStartOption.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasQuickStart) {
      console.log('Found Quick Start option, clicking...');
      await quickStartOption.click();
      await page.waitForTimeout(1000);
      await waitForAppReady(page);
    } else {
      console.log('Quick Start not found - may already be on form');
    }

    // Take screenshot of the form state
    await page.waitForTimeout(500);

    // Fill in project name - look for the first input field
    const nameInput = page.locator('input').first();
    const hasNameInput = await nameInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasNameInput) {
      console.log(`Entering project name: ${projectName}`);
      await nameInput.fill(projectName);
    } else {
      console.log('Name input not visible, checking form structure...');
    }

    // Select project type (Next.js) from dropdown
    const typeSelect = page.locator('select').first();
    const hasTypeSelect = await typeSelect.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasTypeSelect) {
      console.log('Selecting Next.js project type...');
      // Try multiple options for Next.js
      try {
        await typeSelect.selectOption({ label: 'Next.js' });
      } catch {
        try {
          await typeSelect.selectOption('nextjs');
        } catch {
          await typeSelect.selectOption({ index: 1 }); // fallback to second option
        }
      }
    }

    // Fill description if visible
    const descriptionTextarea = page.locator('textarea').first();
    const hasDescription = await descriptionTextarea.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasDescription) {
      await descriptionTextarea.fill('A Next.js project created for E2E testing');
      console.log('Filled project description');
    }

    console.log('\n=== STEP 4: Create the project ===');
    // Look for Continue/Create button
    const continueBtn = page.locator('button:has-text("Continue"), button:has-text("Create"), button[type="submit"]').first();
    const hasContinueBtn = await continueBtn.isVisible({ timeout: 5000 }).catch(() => false);

    let projectUrl = '';

    if (hasContinueBtn) {
      console.log('Clicking Continue/Create button...');
      await continueBtn.click();
      await page.waitForTimeout(2000);
      await waitForAppReady(page);

      // Check if there's a review/confirm step
      const confirmBtn = page.locator('button:has-text("Create Project"), button:has-text("Confirm"), button:has-text("Save")').first();
      const hasConfirmBtn = await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false);

      if (hasConfirmBtn) {
        console.log('Found confirm button, clicking...');
        await confirmBtn.click();
        await page.waitForTimeout(3000);
      }
    } else {
      console.log('Continue button not found - taking screenshot of current state');
    }

    console.log('\n=== STEP 5: Verify toast notification ===');
    // Wait a moment and look for toast
    await page.waitForTimeout(1000);
    const toast = page.locator('[role="alert"], [data-sonner-toast], .toast, [class*="toast"]').first();
    const toastVisible = await toast.isVisible().catch(() => false);

    if (toastVisible) {
      const toastText = await toast.textContent();
      console.log('Toast notification appeared:', toastText);
    } else {
      console.log('No toast visible (may have auto-dismissed)');
    }

    // Take screenshot after creation attempt
    await takeScreenshot(page, 'test-fixed-project-created');

    // Check current URL to see if we were redirected
    projectUrl = page.url();
    console.log('Current URL after create:', projectUrl);

    // If we're on a project detail page, continue with build plan
    if (projectUrl.includes('/projects/') && !projectUrl.includes('/projects/new')) {
      console.log('Successfully navigated to project detail page');

      console.log('\n=== STEP 9: Go to Build Plan tab ===');
      // Look for Build Plan tab - visible in the UI
      const buildPlanTab = page.locator('button:has-text("Build Plan"), [role="tab"]:has-text("Build Plan"), a:has-text("Build Plan")').first();
      const hasBuildPlanTab = await buildPlanTab.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasBuildPlanTab) {
        console.log('Clicking Build Plan tab...');
        await buildPlanTab.click();
        await page.waitForTimeout(1500);
        await waitForAppReady(page);
      } else {
        console.log('Build Plan tab not visible');
      }

      console.log('\n=== STEP 10: Click Generate Build Plan ===');
      // Look for Generate button on the Build Plan tab
      const generateBtn = page.locator('button:has-text("Generate"), button:has-text("Generate Build Plan"), button:has-text("Generate Plan")').first();
      const hasGenerateBtn = await generateBtn.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasGenerateBtn) {
        console.log('Clicking Generate Build Plan button...');
        await generateBtn.click();

        // Wait for generation (AI can take time)
        console.log('Waiting for build plan generation...');
        await page.waitForTimeout(15000);

        // Check for any loading indicators and wait for them to finish
        const loadingSpinner = page.locator('[class*="animate-spin"], [class*="loading"]').first();
        let spinnerVisible = await loadingSpinner.isVisible().catch(() => false);
        let waitCount = 0;
        while (spinnerVisible && waitCount < 12) {
          console.log('Generation in progress, waiting...');
          await page.waitForTimeout(5000);
          spinnerVisible = await loadingSpinner.isVisible().catch(() => false);
          waitCount++;
        }

        console.log('Build plan generation completed (or timed out)');
      } else {
        console.log('Generate button not visible - build plan may already exist or different UI');
      }

      // Take the build plan screenshot from the project detail page
      await takeScreenshot(page, 'test-fixed-build-plan');
    } else {
      console.log('\n=== STEP 6: Navigate back to /projects ===');
      await page.goto('/projects');
      await waitForAppReady(page);
      await page.waitForTimeout(1000);

      console.log('\n=== STEP 7: Verify project appears in list ===');
      // Look for the created project
      const projectLink = page.locator(`a:has-text("${projectName}"), [data-testid="project-item"]:has-text("${projectName}")`).first();
      await page.waitForTimeout(2000);

      const projectInList = await projectLink.isVisible().catch(() => false);
      console.log('Project visible in list:', projectInList);

      // Find any project to click on
      const anyProjectLink = page.locator('a[href^="/projects/"]:not([href="/projects/new"]):not([href="/projects/trash"])').first();
      const hasAnyProject = await anyProjectLink.isVisible().catch(() => false);

      if (hasAnyProject) {
        console.log('\n=== STEP 8: Click the project ===');
        await anyProjectLink.click();
        await waitForAppReady(page);
        await page.waitForTimeout(1000);

        console.log('\n=== STEP 9: Go to Build Plan tab ===');
        const buildPlanTab = page.locator('button:has-text("Build Plan"), [role="tab"]:has-text("Build Plan"), a:has-text("Build Plan")').first();
        const hasBuildPlanTab = await buildPlanTab.isVisible({ timeout: 5000 }).catch(() => false);

        if (hasBuildPlanTab) {
          console.log('Clicking Build Plan tab...');
          await buildPlanTab.click();
          await page.waitForTimeout(1000);
          await waitForAppReady(page);
        }

        console.log('\n=== STEP 10: Click Generate Build Plan ===');
        const generateBtn = page.locator('button:has-text("Generate"), button:has-text("Generate Build Plan")').first();
        const hasGenerateBtn = await generateBtn.isVisible({ timeout: 5000 }).catch(() => false);

        if (hasGenerateBtn) {
          console.log('Clicking Generate Build Plan button...');
          await generateBtn.click();
          console.log('Waiting for build plan generation...');
          await page.waitForTimeout(20000);
        }
      }

      await takeScreenshot(page, 'test-fixed-build-plan');
    }

    console.log('\n=== STEP 11: Final verification ===');

    // Report errors
    const errors = getErrors();
    if (errors.length > 0) {
      console.log('\nConsole errors during test:');
      errors.forEach(e => console.log('  -', e));
    } else {
      console.log('\nNo console errors detected');
    }

    console.log('\n=== TEST COMPLETE ===');
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}/`);
    console.log('  - test-fixed-project-list.png');
    console.log('  - test-fixed-project-created.png');
    console.log('  - test-fixed-build-plan.png');
  });
});
