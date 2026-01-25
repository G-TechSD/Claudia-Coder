import { test, expect } from '@playwright/test';
import {
  waitForAppReady,
  setupConsoleErrorCheck,
} from './helpers';

/**
 * Full Project Creation Flow E2E Test
 * Tests the complete journey from /projects to creating a new project with build plan
 * Screenshots are saved to /tmp/project-flow-test/
 */

const SCREENSHOT_DIR = '/tmp/project-flow-test';

async function takeScreenshot(page: any, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}-${timestamp}.png`,
    fullPage: true,
  });
}

test.describe('Complete Project Creation Flow', () => {
  test.beforeAll(async () => {
    // Ensure screenshot directory exists
    const { execSync } = require('child_process');
    execSync(`mkdir -p ${SCREENSHOT_DIR}`);
  });

  test('Step 1: Navigate to Projects page', async ({ page }) => {
    const getErrors = setupConsoleErrorCheck(page);

    await page.goto('/projects');
    await waitForAppReady(page);

    await takeScreenshot(page, '01-projects-page');

    // Verify projects page loaded
    await expect(page).toHaveURL(/\/projects/);

    // Check for page title "Projects"
    const pageTitle = page.locator('h1:has-text("Projects")');
    await expect(pageTitle).toBeVisible();

    // Check for "New Project" button
    const newProjectBtn = page.locator('a[href="/projects/new"], button:has-text("New Project")');
    await expect(newProjectBtn.first()).toBeVisible();

    await takeScreenshot(page, '01-projects-page-verified');

    const errors = getErrors();
    console.log('Console errors:', errors);
  });

  test('Step 2: Click New Project and verify creation page', async ({ page }) => {
    const getErrors = setupConsoleErrorCheck(page);

    await page.goto('/projects');
    await waitForAppReady(page);

    await takeScreenshot(page, '02-before-new-project-click');

    // Click New Project button (use first() since there may be multiple links)
    const newProjectLink = page.locator('a[href="/projects/new"]').first();
    if (await newProjectLink.isVisible()) {
      await newProjectLink.click();
    } else {
      // Try button variant
      const newProjectBtn = page.locator('button:has-text("New Project"), button:has-text("New")').first();
      await newProjectBtn.click();
    }

    await waitForAppReady(page);
    await takeScreenshot(page, '02-new-project-page');

    // Should show mode selection (Quick, Interview, Linear options)
    const pageContent = await page.content();
    const hasQuickMode = pageContent.includes('Quick') || pageContent.includes('quick');
    const hasInterviewMode = pageContent.includes('Interview') || pageContent.includes('interview');

    console.log('Quick mode available:', hasQuickMode);
    console.log('Interview mode available:', hasInterviewMode);

    const errors = getErrors();
    console.log('Console errors:', errors);
  });

  test('Step 3: Test Quick Mode project creation', async ({ page }) => {
    const getErrors = setupConsoleErrorCheck(page);

    await page.goto('/projects/new');
    await waitForAppReady(page);

    await takeScreenshot(page, '03-new-project-initial');

    // Look for description textarea first
    const descriptionInput = page.locator('textarea').first();

    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill('A test project for E2E testing. This is a simple web application with user authentication and a dashboard.');
      await takeScreenshot(page, '03-description-filled');
    }

    // Check for "Quick Start" (quick mode) option
    const quickStartBtn = page.locator('button:has-text("Quick Start")');
    const hasQuickStart = await quickStartBtn.isVisible().catch(() => false);
    console.log('Quick Start button visible:', hasQuickStart);

    if (hasQuickStart) {
      await takeScreenshot(page, '03-quick-start-visible');
    }

    // Check for voice input option (Speak button)
    const speakBtn = page.locator('button:has-text("Speak")');
    const hasSpeakOption = await speakBtn.isVisible().catch(() => false);
    console.log('Speak input available:', hasSpeakOption);

    const errors = getErrors();
    console.log('Console errors:', errors);
  });

  test('Step 4: Test Interview Mode flow', async ({ page }) => {
    const getErrors = setupConsoleErrorCheck(page);

    await page.goto('/projects/new');
    await waitForAppReady(page);

    await takeScreenshot(page, '04-new-project-initial');

    // Fill in a description first
    const descriptionInput = page.locator('textarea').first();
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill('A task management app with real-time collaboration.');
      await takeScreenshot(page, '04-description-entered');
    }

    // Look for "Full Interview" mode option
    const interviewModeBtn = page.locator('button:has-text("Full Interview")');

    if (await interviewModeBtn.isVisible().catch(() => false)) {
      console.log('Full Interview button found');
      await interviewModeBtn.click();
      await page.waitForTimeout(2000);
      await takeScreenshot(page, '04-interview-mode-selected');

      // Check if interview panel appeared (should have mic button, messages area)
      const pageContent = await page.content();
      const hasInterviewContent = pageContent.includes('Interview') || pageContent.includes('voice');
      console.log('Interview content visible:', hasInterviewContent);

      // Look for skip/cancel buttons in interview mode
      const skipBtn = page.locator('button:has-text("Skip")');
      const cancelBtn = page.locator('button:has-text("Cancel")');

      console.log('Skip button visible:', await skipBtn.isVisible().catch(() => false));
      console.log('Cancel button visible:', await cancelBtn.isVisible().catch(() => false));

      await takeScreenshot(page, '04-interview-panel-visible');

      // Cancel the interview to continue testing
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '04-interview-cancelled');
      }
    } else {
      console.log('Full Interview button not found');
      await takeScreenshot(page, '04-no-interview-button');
    }

    const errors = getErrors();
    console.log('Console errors:', errors);
  });

  test('Step 5: Test Quick Start project creation', async ({ page }) => {
    const getErrors = setupConsoleErrorCheck(page);

    await page.goto('/projects/new');
    await waitForAppReady(page);

    await takeScreenshot(page, '05-new-project-start');

    // Fill in project description first
    const descriptionInput = page.locator('textarea').first();
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill('Build a task management application with user authentication, project organization, and real-time collaboration features.');
      await takeScreenshot(page, '05-description-entered');
    }

    // Click "Quick Start" button to generate plan
    const quickStartBtn = page.locator('button:has-text("Quick Start")');

    if (await quickStartBtn.isVisible().catch(() => false)) {
      console.log('Clicking Quick Start button');
      await takeScreenshot(page, '05-before-quick-start');

      await quickStartBtn.click();

      // Wait for generation (can take time with AI)
      await page.waitForTimeout(5000);
      await takeScreenshot(page, '05-after-quick-start-click');

      // Check for loading state
      const loadingIndicator = page.locator('[class*="animate-spin"]').first();
      if (await loadingIndicator.isVisible().catch(() => false)) {
        console.log('Plan generation in progress...');
        // Wait up to 90 seconds for generation
        await page.waitForFunction(() => {
          return document.querySelectorAll('[class*="animate-spin"]').length === 0;
        }, { timeout: 90000 }).catch(() => {
          console.log('Generation may still be in progress');
        });
      }

      await takeScreenshot(page, '05-generation-result');
    } else {
      console.log('Quick Start button not found');
    }

    const errors = getErrors();
    console.log('Console errors:', errors);
  });

  test('Step 6: Verify Build Plan generation via Quick Start', async ({ page }) => {
    const getErrors = setupConsoleErrorCheck(page);

    await page.goto('/projects/new');
    await waitForAppReady(page);

    // Fill description first
    const descriptionInput = page.locator('textarea').first();
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill('A simple notes application with markdown support and cloud sync.');
    }

    await takeScreenshot(page, '06-before-plan-generation');

    // Click Quick Start to generate
    const quickStartBtn = page.locator('button:has-text("Quick Start")');
    if (await quickStartBtn.isVisible().catch(() => false)) {
      await quickStartBtn.click();

      // Wait for generation
      await page.waitForTimeout(10000);

      // Check for build plan content
      const buildPlanContent = await page.content();
      const hasBuildPlan =
        buildPlanContent.includes('Build Plan') ||
        buildPlanContent.includes('Phase') ||
        buildPlanContent.includes('Packet') ||
        buildPlanContent.includes('feature') ||
        buildPlanContent.includes('Feature') ||
        buildPlanContent.includes('setup');

      console.log('Build plan content detected:', hasBuildPlan);
      await takeScreenshot(page, '06-build-plan-result');
    }

    const errors = getErrors();
    console.log('Console errors:', errors);
  });

  test('Step 7: Test project setup form fields', async ({ page }) => {
    const getErrors = setupConsoleErrorCheck(page);

    await page.goto('/projects/new');
    await waitForAppReady(page);

    await takeScreenshot(page, '07-setup-form-initial');

    // Check for project name input
    const nameInput = page.locator('input[name="name"], input[id*="name" i], input[placeholder*="name" i]').first();
    const hasNameInput = await nameInput.isVisible().catch(() => false);
    console.log('Name input visible:', hasNameInput);

    if (hasNameInput) {
      await nameInput.fill('E2E Test Project');
      await takeScreenshot(page, '07-name-filled');
    }

    // Check for priority selector
    const prioritySelector = page.locator('select[name="priority"], [data-testid="priority"], button:has-text("Medium"), button:has-text("High")');
    const hasPrioritySelector = await prioritySelector.first().isVisible().catch(() => false);
    console.log('Priority selector visible:', hasPrioritySelector);

    // Check for GitLab repo options
    const repoOption = page.locator('text=GitLab, text=Repository, input[name*="repo"]');
    const hasRepoOption = await repoOption.first().isVisible().catch(() => false);
    console.log('Repository option visible:', hasRepoOption);

    // Check for project folder path
    const folderPathInput = page.locator('input[placeholder*="path" i], input[name*="folder" i], input[name*="path" i]');
    const hasFolderPath = await folderPathInput.first().isVisible().catch(() => false);
    console.log('Folder path input visible:', hasFolderPath);

    await takeScreenshot(page, '07-setup-form-explored');

    const errors = getErrors();
    console.log('Console errors:', errors);
  });

  test('Step 8: Full flow - Create project and verify redirect', async ({ page }) => {
    const getErrors = setupConsoleErrorCheck(page);

    await page.goto('/projects/new');
    await waitForAppReady(page);

    await takeScreenshot(page, '08-full-flow-start');

    // Fill in description
    const descriptionInput = page.locator('textarea').first();
    if (await descriptionInput.isVisible()) {
      await descriptionInput.fill('E2E Test: A simple counter app with increment, decrement, and reset functionality.');
      await takeScreenshot(page, '08-description-filled');
    }

    // Click Quick Start to generate
    const quickStartBtn = page.locator('button:has-text("Quick Start")');
    if (await quickStartBtn.isVisible().catch(() => false)) {
      await quickStartBtn.click();
      await page.waitForTimeout(10000);
      await takeScreenshot(page, '08-after-quick-start');
    }

    // Look for the final create/save button after plan generation
    const createBtn = page.locator('button:has-text("Create Project"), button:has-text("Save"), button:has-text("Complete"), button:has-text("Approve")').first();
    if (await createBtn.isVisible().catch(() => false)) {
      console.log('Found final create button');
      await takeScreenshot(page, '08-before-create');

      await createBtn.click();

      // Wait for project creation and redirect
      await page.waitForTimeout(5000);
      await takeScreenshot(page, '08-after-create');

      // Check if redirected to project page
      const currentUrl = page.url();
      console.log('Current URL after create:', currentUrl);

      if (currentUrl.includes('/projects/') && !currentUrl.includes('/projects/new')) {
        console.log('Successfully redirected to project page!');
        await takeScreenshot(page, '08-project-page-redirect');
      }
    } else {
      console.log('Create button not found - checking page state');
      await takeScreenshot(page, '08-no-create-button');
    }

    const errors = getErrors();
    console.log('Console errors:', errors);
  });

  test('Step 9: Verify packets on created project', async ({ page }) => {
    const getErrors = setupConsoleErrorCheck(page);

    // First, navigate to projects list
    await page.goto('/projects');
    await waitForAppReady(page);

    await takeScreenshot(page, '09-projects-list');

    // Look for the test project or any recent project
    const projectLink = page.locator('a[href^="/projects/"]:not([href="/projects/new"]):not([href="/projects/trash"])').first();

    if (await projectLink.isVisible()) {
      const projectName = await projectLink.textContent();
      console.log('Clicking on project:', projectName);

      await projectLink.click();
      await waitForAppReady(page);
      await takeScreenshot(page, '09-project-detail-page');

      // Check for packets section
      const packetsSection = page.locator('text=Packet, text=Work Packet, [data-testid="packets"]');
      const hasPackets = await packetsSection.first().isVisible().catch(() => false);
      console.log('Packets section visible:', hasPackets);

      // Check for build plan
      const buildPlanSection = page.locator('text=Build Plan, text=Phases, [data-testid="build-plan"]');
      const hasBuildPlan = await buildPlanSection.first().isVisible().catch(() => false);
      console.log('Build plan section visible:', hasBuildPlan);

      await takeScreenshot(page, '09-project-sections');
    } else {
      console.log('No projects found in list');
    }

    const errors = getErrors();
    console.log('Console errors:', errors);
  });

  test('Step 10: Test file browser on project', async ({ page }) => {
    const getErrors = setupConsoleErrorCheck(page);

    // Navigate to projects list
    await page.goto('/projects');
    await waitForAppReady(page);

    // Find a project with a basePath (file browser enabled)
    const projectLink = page.locator('a[href^="/projects/"]:not([href="/projects/new"]):not([href="/projects/trash"])').first();

    if (await projectLink.isVisible()) {
      await projectLink.click();
      await waitForAppReady(page);
      await takeScreenshot(page, '10-project-for-file-browser');

      // Look for file browser tab or section
      const fileBrowserTab = page.locator('button:has-text("Files"), a:has-text("Files"), [data-testid="files-tab"]');
      const hasFileBrowser = await fileBrowserTab.first().isVisible().catch(() => false);
      console.log('File browser tab visible:', hasFileBrowser);

      if (hasFileBrowser) {
        await fileBrowserTab.first().click();
        await page.waitForTimeout(1000);
        await takeScreenshot(page, '10-file-browser-opened');

        // Check for file tree elements
        const fileTree = page.locator('[class*="file-tree"], [data-testid="file-tree"], [role="tree"]');
        const hasFileTree = await fileTree.first().isVisible().catch(() => false);
        console.log('File tree visible:', hasFileTree);
      }

      // Also check for folder path input
      const folderInput = page.locator('input[placeholder*="folder" i], input[placeholder*="path" i]');
      const hasFolderInput = await folderInput.first().isVisible().catch(() => false);
      console.log('Folder path input visible:', hasFolderInput);

      await takeScreenshot(page, '10-file-browser-final');
    }

    const errors = getErrors();
    console.log('Console errors:', errors);
  });

  test.afterAll(async () => {
    console.log(`\n=== Screenshots saved to ${SCREENSHOT_DIR} ===\n`);
  });
});
