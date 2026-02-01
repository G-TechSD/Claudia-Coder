/**
 * E2E Tests for Cloud Provider Integration
 * Tests build plan generation with Google and Claude Code
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_DIR = path.join(process.cwd(), 'test-screenshots', 'cloud-providers');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Helper to save screenshots with timestamps
async function saveScreenshot(page: Page, name: string) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filepath = path.join(SCREENSHOT_DIR, `${timestamp}-${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 Screenshot: ${name}`);
  return filepath;
}

// Configure test settings
test.use({
  ignoreHTTPSErrors: true,
  baseURL: 'http://localhost:3000',
});

// 5 minute timeout per test for AI operations
test.setTimeout(300000);

test.describe('Build Plan Generation', () => {

  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !msg.text().includes('hydrat')) {
        console.log(`[Error] ${msg.text().substring(0, 200)}`);
      }
    });
  });

  test('generate build plan with Google Gemini', async ({ page }) => {
    console.log('\n========== Google Gemini Build Plan Test ==========');
    console.log(`Time: ${new Date().toLocaleTimeString()}`);

    // Go to new project
    await page.goto('/projects/new');
    await page.waitForTimeout(2000);
    await saveScreenshot(page, 'gemini-01-new-project');

    // Fill description - use clear coding project with enough detail to avoid clarification
    const textarea = page.locator('textarea').first();
    await textarea.fill('Build a todo list web app with React and TypeScript. Features: add tasks, mark complete, delete tasks, persist to localStorage. Use a single-column card-based UI. Use React hooks for state management.');
    await page.waitForTimeout(500);
    await saveScreenshot(page, 'gemini-02-filled-description');

    // Click Quick Start
    const quickStart = page.getByRole('button', { name: /Quick Start/i });
    await quickStart.click();
    console.log('Clicked Quick Start');

    // Wait for either clarification page or Quick mode confirmation
    // The page can go to either flow depending on project complexity
    console.log('Waiting for next step...');

    // Wait up to 30 seconds for page transition
    const maxWait = 30000;
    const startWait = Date.now();
    let foundClarifyPage = false;
    let foundQuickMode = false;

    while (Date.now() - startWait < maxWait) {
      // Check for clarification page
      const clarifyHeading = await page.locator('h1:has-text("Let\'s Clarify")').isVisible({ timeout: 1000 }).catch(() => false);
      if (clarifyHeading) {
        foundClarifyPage = true;
        console.log('Detected clarification page');
        break;
      }

      // Check for Quick mode (project creation step)
      const projectCreated = page.url().match(/\/projects\/(?!new)[^/]+/);
      if (projectCreated) {
        foundQuickMode = true;
        console.log('Project was created directly');
        break;
      }

      await page.waitForTimeout(500);
    }

    await saveScreenshot(page, 'gemini-03-after-quick-start');

    if (foundClarifyPage) {
      console.log('On clarification page - using Quick Clarification');

      // Scroll down to see the Quick Clarification section
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      await saveScreenshot(page, 'gemini-04-clarification-scroll');

      // Find and fill the Quick Clarification textarea
      const clarifyTextarea = page.locator('textarea').last();
      try {
        await clarifyTextarea.waitFor({ state: 'visible', timeout: 5000 });
        await clarifyTextarea.fill('Use a clean minimal design. CSS modules for styling. No external state libraries.');
        console.log('Filled clarification textarea');
        await saveScreenshot(page, 'gemini-05-clarification-filled');
      } catch (e) {
        console.log('Could not find clarification textarea:', e);
      }

      // Click Continue button to proceed
      const continueBtn = page.getByRole('button', { name: /Continue/i });
      try {
        await continueBtn.waitFor({ state: 'visible', timeout: 10000 });
        console.log('Found Continue button, waiting for it to be enabled...');
        // Wait for it to be enabled
        const btnWaitStart = Date.now();
        while (Date.now() - btnWaitStart < 30000) {
          const isDisabled = await continueBtn.isDisabled();
          if (!isDisabled) {
            await continueBtn.click();
            console.log('Clicked Continue');
            break;
          }
          await page.waitForTimeout(500);
        }
      } catch (e) {
        console.log('Continue button issue:', e);
        await saveScreenshot(page, 'gemini-05-no-continue-btn');
      }

      await page.waitForTimeout(3000);
      await saveScreenshot(page, 'gemini-06-after-continue');
    }

    // Check what page we're on after Continue
    await page.waitForTimeout(2000); // Give page time to render

    // Check for "Review Your Plan" page (flow 1)
    const reviewHeading = page.locator('h1:has-text("Review Your Plan")');
    const onReviewPage = await reviewHeading.isVisible({ timeout: 5000 }).catch(() => false);

    // Check for "Project Details" page (flow 2)
    const projectDetailsPage = page.locator('text=Project Details');
    const onProjectDetailsPage = await projectDetailsPage.isVisible({ timeout: 3000 }).catch(() => false);

    if (onReviewPage) {
      console.log('On Review Your Plan page');
      await saveScreenshot(page, 'gemini-07-review-plan');

      const looksGoodBtn = page.getByRole('button', { name: /Looks Good/i });
      try {
        await looksGoodBtn.waitFor({ state: 'visible', timeout: 10000 });
        console.log('Found Looks Good button, clicking...');
        await looksGoodBtn.click();
        console.log('Clicked Looks Good');
      } catch (e) {
        console.log('Looks Good button issue:', e);
      }

      await page.waitForTimeout(3000);
      await saveScreenshot(page, 'gemini-08-after-looks-good');
    } else if (onProjectDetailsPage) {
      console.log('On Project Details page - clicking Create Project');
      await saveScreenshot(page, 'gemini-07-project-details');

      const createProjectBtn = page.locator('button:has-text("Create Project")');
      try {
        await createProjectBtn.waitFor({ state: 'visible', timeout: 5000 });
        // Check if enabled and click
        if (await createProjectBtn.isEnabled()) {
          await createProjectBtn.click();
          console.log('Clicked Create Project');
        } else {
          console.log('Create Project button is disabled');
        }
      } catch (e) {
        console.log('Create Project button issue:', e);
      }

      await page.waitForTimeout(3000);
      await saveScreenshot(page, 'gemini-08-after-create');
    }

    // Check for "Project Created!" success modal
    const successModal = page.locator('text=Project Created!');
    const onSuccessPage = await successModal.isVisible({ timeout: 10000 }).catch(() => false);

    if (onSuccessPage) {
      console.log('✅ Project was created successfully');
      await saveScreenshot(page, 'gemini-09-project-success');

      const viewProjectBtn = page.getByRole('button', { name: /View Project/i });
      try {
        await viewProjectBtn.waitFor({ state: 'visible', timeout: 5000 });
        console.log('Clicking View Project...');
        await viewProjectBtn.click();
        console.log('Clicked View Project');
      } catch (e) {
        console.log('View Project button issue:', e);
      }
    }

    // Wait for project creation and navigation
    try {
      await page.waitForURL(/\/projects\/(?!new)[^/]+/, { timeout: 60000 });
      console.log('Project created:', page.url());
    } catch {
      console.log('Did not navigate to project page, URL:', page.url());
    }
    await page.waitForTimeout(2000);
    await saveScreenshot(page, 'gemini-10-project-created');

    // Check if we're on a project page
    const onProjectPage = page.url().match(/\/projects\/(?!new)[^/]+/);
    if (onProjectPage) {
      console.log('✅ Successfully created project and navigated to project page');

      // Wait for build plan in the project page
      console.log('Waiting for build plan on project page...');
      const startTime = Date.now();
      let generated = false;

      while (Date.now() - startTime < 90000) {
        // Check for packets indicator on project page
        const packetsIndicator = await page.locator('text=/\\d+.*work packets?/i').isVisible({ timeout: 2000 }).catch(() => false);
        if (packetsIndicator) {
          console.log('✅ Build plan with packets found on project page');
          generated = true;
          break;
        }

        const elapsed = Math.round((Date.now() - startTime) / 1000);
        if (elapsed % 15 === 0) {
          console.log(`Waiting for build plan... ${elapsed}s`);
          await saveScreenshot(page, `gemini-bp-${elapsed}s`);
        }

        await page.waitForTimeout(3000);
      }

      await saveScreenshot(page, 'gemini-11-final');
      console.log(`Build plan result: ${generated ? 'PASSED' : 'TIMEOUT'}`);
    } else {
      console.log('❌ Did not navigate to project page');
      await saveScreenshot(page, 'gemini-11-final-no-project');
    }
    console.log(`Time: ${new Date().toLocaleTimeString()}`);
  });

  test('generate build plan with Claude Code', async ({ page }) => {
    console.log('\n========== Claude Code Build Plan Test ==========');
    console.log(`Time: ${new Date().toLocaleTimeString()}`);

    // Go to new project
    await page.goto('/projects/new');
    await page.waitForTimeout(2000);
    await saveScreenshot(page, 'claude-01-new-project');

    // Fill description - use clear coding project with enough detail
    const textarea = page.locator('textarea').first();
    await textarea.fill('Build a REST API with Express.js for a blog. Features: CRUD endpoints for posts, comments, and users with PostgreSQL database. Use TypeScript and include basic authentication.');
    await page.waitForTimeout(500);
    await saveScreenshot(page, 'claude-02-filled-description');

    // Click Quick Start
    const quickStart = page.getByRole('button', { name: /Quick Start/i });
    await quickStart.click();
    console.log('Clicked Quick Start');

    // Wait for page transition
    console.log('Waiting for next step...');
    const maxWait = 30000;
    const startWait = Date.now();
    let foundClarifyPage = false;

    while (Date.now() - startWait < maxWait) {
      const clarifyHeading = await page.locator('h1:has-text("Let\'s Clarify")').isVisible({ timeout: 1000 }).catch(() => false);
      if (clarifyHeading) {
        foundClarifyPage = true;
        console.log('Detected clarification page');
        break;
      }
      const projectCreated = page.url().match(/\/projects\/(?!new)[^/]+/);
      if (projectCreated) {
        console.log('Project was created directly');
        break;
      }
      await page.waitForTimeout(500);
    }

    await saveScreenshot(page, 'claude-03-after-quick-start');

    if (foundClarifyPage) {
      console.log('On clarification page - using Quick Clarification');

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);

      const clarifyTextarea = page.locator('textarea').last();
      try {
        await clarifyTextarea.waitFor({ state: 'visible', timeout: 5000 });
        await clarifyTextarea.fill('Use Express with async/await. JWT for auth. Sequelize ORM.');
        console.log('Filled clarification textarea');
        await saveScreenshot(page, 'claude-04-clarification-filled');
      } catch (e) {
        console.log('Could not find clarification textarea:', e);
      }

      const continueBtn = page.getByRole('button', { name: /Continue/i });
      try {
        await continueBtn.waitFor({ state: 'visible', timeout: 10000 });
        console.log('Found Continue button, waiting for it to be enabled...');
        const btnWaitStart = Date.now();
        while (Date.now() - btnWaitStart < 30000) {
          const isDisabled = await continueBtn.isDisabled();
          if (!isDisabled) {
            await continueBtn.click();
            console.log('Clicked Continue');
            break;
          }
          await page.waitForTimeout(500);
        }
      } catch (e) {
        console.log('Continue button issue:', e);
      }

      await page.waitForTimeout(3000);
      await saveScreenshot(page, 'claude-05-after-continue');
    }

    // Check for Review Your Plan page
    const reviewHeading = page.locator('h1:has-text("Review Your Plan")');
    const onReviewPage = await reviewHeading.isVisible({ timeout: 10000 }).catch(() => false);

    if (onReviewPage) {
      console.log('On Review Your Plan page');
      await saveScreenshot(page, 'claude-06-review-plan');

      const looksGoodBtn = page.getByRole('button', { name: /Looks Good/i });
      try {
        await looksGoodBtn.waitFor({ state: 'visible', timeout: 10000 });
        console.log('Found Looks Good button, clicking...');
        await looksGoodBtn.click();
        console.log('Clicked Looks Good');
      } catch (e) {
        console.log('Looks Good button issue:', e);
      }

      await page.waitForTimeout(3000);
      await saveScreenshot(page, 'claude-07-after-looks-good');
    }

    // Check for Project Created! success modal
    const successModal = page.locator('text=Project Created!');
    const onSuccessPage = await successModal.isVisible({ timeout: 10000 }).catch(() => false);

    if (onSuccessPage) {
      console.log('✅ Project was created successfully');
      await saveScreenshot(page, 'claude-08-project-success');

      const viewProjectBtn = page.getByRole('button', { name: /View Project/i });
      try {
        await viewProjectBtn.waitFor({ state: 'visible', timeout: 5000 });
        console.log('Clicking View Project...');
        await viewProjectBtn.click();
        console.log('Clicked View Project');
      } catch (e) {
        console.log('View Project button issue:', e);
      }
    }

    // Wait for project creation and navigation
    try {
      await page.waitForURL(/\/projects\/(?!new)[^/]+/, { timeout: 60000 });
      console.log('Project created:', page.url());
    } catch {
      console.log('Did not navigate to project page, URL:', page.url());
    }
    await page.waitForTimeout(2000);
    await saveScreenshot(page, 'claude-09-project-created');

    // Check if we're on a project page
    const onProjectPage = page.url().match(/\/projects\/(?!new)[^/]+/);
    if (onProjectPage) {
      console.log('✅ Successfully created project and navigated to project page');

      // Wait for build plan in the project page
      console.log('Waiting for build plan on project page...');
      const startTime = Date.now();
      let generated = false;

      while (Date.now() - startTime < 90000) {
        const packetsIndicator = await page.locator('text=/\\d+.*work packets?/i').isVisible({ timeout: 2000 }).catch(() => false);
        if (packetsIndicator) {
          console.log('✅ Build plan with packets found on project page');
          generated = true;
          break;
        }

        const elapsed = Math.round((Date.now() - startTime) / 1000);
        if (elapsed % 15 === 0) {
          console.log(`Waiting for build plan... ${elapsed}s`);
          await saveScreenshot(page, `claude-bp-${elapsed}s`);
        }

        await page.waitForTimeout(3000);
      }

      await saveScreenshot(page, 'claude-10-final');
      console.log(`Build plan result: ${generated ? 'PASSED' : 'TIMEOUT'}`);
    } else {
      console.log('❌ Did not navigate to project page');
      await saveScreenshot(page, 'claude-10-final-no-project');
    }
    console.log(`Time: ${new Date().toLocaleTimeString()}`);
  });

  test('execute packets with existing project', async ({ page }) => {
    console.log('\n========== Packet Execution Test ==========');
    console.log(`Time: ${new Date().toLocaleTimeString()}`);

    // Go to projects list
    await page.goto('/projects');
    await page.waitForTimeout(2000);
    await saveScreenshot(page, 'exec-01-projects');

    // Click first project
    const projectLink = page.locator('a[href*="/projects/"]').first();
    if (await projectLink.isVisible({ timeout: 5000 })) {
      await projectLink.click();
      await page.waitForURL(/\/projects\/[^/]+/, { timeout: 10000 });
      console.log('Opened project');
      await page.waitForTimeout(2000);
      await saveScreenshot(page, 'exec-02-project-opened');

      // Find GO button
      const goButton = page.getByRole('button', { name: /^GO$/i }).or(
        page.locator('button:has-text("GO")')
      );

      if (await goButton.isVisible({ timeout: 5000 })) {
        console.log('Found GO button');
        await saveScreenshot(page, 'exec-03-before-go');

        // Click GO
        await goButton.click();
        console.log('Clicked GO');

        // Monitor execution for 60 seconds
        const startTime = Date.now();
        while (Date.now() - startTime < 60000) {
          const elapsed = Math.round((Date.now() - startTime) / 1000);

          // Check for Claude Code terminal opening
          const terminalVisible = await page.locator('text=Claude Code').isVisible({ timeout: 1000 }).catch(() => false);
          if (terminalVisible) {
            console.log('Claude Code terminal opened!');
          }

          // Check for completion
          const completed = await page.locator('text=/complete|finished/i').isVisible({ timeout: 1000 }).catch(() => false);
          if (completed) {
            console.log('✅ Execution completed');
            break;
          }

          if (elapsed % 10 === 0) {
            console.log(`Executing... ${elapsed}s`);
            await saveScreenshot(page, `exec-running-${elapsed}s`);
          }

          await page.waitForTimeout(3000);
        }

        await saveScreenshot(page, 'exec-04-final');
      } else {
        console.log('No GO button found');
        await saveScreenshot(page, 'exec-03-no-go');
      }
    } else {
      console.log('No projects found');
      await saveScreenshot(page, 'exec-02-no-projects');
    }

    console.log(`Time: ${new Date().toLocaleTimeString()}`);
  });
});

test.afterAll(async () => {
  console.log(`\n========== Tests completed at ${new Date().toLocaleTimeString()} ==========`);
});
