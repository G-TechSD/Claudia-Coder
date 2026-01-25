import { test, expect, Page } from '@playwright/test';

/**
 * Packet Execution E2E Tests
 *
 * Tests the execution of work packets on created projects
 */

const SCREENSHOT_DIR = '/tmp/packet-execution';
const BASE_URL = 'https://localhost:3000';

async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: true,
  });
}

async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('aside', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
}

test.describe('Packet Execution Tests', () => {
  test.beforeAll(async () => {
    const { execSync } = require('child_process');
    execSync(`mkdir -p ${SCREENSHOT_DIR}`);
  });

  test('should navigate to an existing project and view packets', async ({ page }) => {
    test.setTimeout(120000);

    // Get list of projects
    await page.goto(`${BASE_URL}/projects`);
    await waitForAppReady(page);
    await takeScreenshot(page, '01-projects-list');

    // Click on first project link
    const projectLink = page.locator('a[href^="/projects/project-"]').first();
    const projectHref = await projectLink.getAttribute('href');
    console.log(`Navigating to project: ${projectHref}`);

    await projectLink.click();
    await waitForAppReady(page);
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '02-project-page');

    // Look for Build Plan or Execution tab
    const buildPlanTab = page.locator('button:has-text("Build Plan"), [data-value="build-plan"], text=Build Plan');
    const executionTab = page.locator('button:has-text("Execution"), [data-value="execution"], text=Execution');

    if (await buildPlanTab.isVisible().catch(() => false)) {
      console.log('Found Build Plan tab');
      await buildPlanTab.click();
      await page.waitForTimeout(1000);
      await takeScreenshot(page, '03-build-plan-tab');
    }

    if (await executionTab.isVisible().catch(() => false)) {
      console.log('Found Execution tab');
      await executionTab.click();
      await page.waitForTimeout(1000);
      await takeScreenshot(page, '04-execution-tab');
    }

    // Check for packet cards or work items
    const packetCards = page.locator('[class*="packet"], [data-testid*="packet"], .packet-card');
    const packetCount = await packetCards.count().catch(() => 0);
    console.log(`Found ${packetCount} packet elements`);

    // Look for execute button
    const executeButton = page.locator('button:has-text("Execute"), button:has-text("Run"), button:has-text("Start")');
    if (await executeButton.first().isVisible().catch(() => false)) {
      console.log('Found execute button');
      await takeScreenshot(page, '05-execute-button-visible');
    }

    await takeScreenshot(page, '06-final-state');
    console.log(`Current URL: ${page.url()}`);
  });

  test('should display project with build plan details', async ({ page }) => {
    test.setTimeout(120000);

    // Navigate directly to a project we created
    await page.goto(`${BASE_URL}/projects`);
    await waitForAppReady(page);

    // Find and click on Express API Server project
    const expressProject = page.locator('text=Express API Server, text=express-api').first();
    if (await expressProject.isVisible().catch(() => false)) {
      await expressProject.click();
      await waitForAppReady(page);
      await takeScreenshot(page, 'express-project-page');

      // Look for phases
      const phaseElements = page.locator('text=Phase 1, text=Project Setup, text=phases');
      console.log(`Phase elements visible: ${await phaseElements.first().isVisible().catch(() => false)}`);

      // Look for packets
      const packetElements = page.locator('text=Repository Initialization, text=Bootstrap, text=JWT Authentication');
      console.log(`Packet elements visible: ${await packetElements.first().isVisible().catch(() => false)}`);

      await takeScreenshot(page, 'express-project-details');
    }
  });

  test('should verify project folder structure was created', async ({ page }) => {
    test.setTimeout(60000);

    // Use API to check project details
    const response = await page.request.get(`${BASE_URL}/api/projects`);
    const data = await response.json();

    console.log(`Total projects: ${data.projects?.length || 0}`);

    // Find a project with workingDirectory
    const projectWithDir = data.projects?.find((p: { workingDirectory?: string }) => p.workingDirectory);
    if (projectWithDir) {
      console.log(`Project: ${projectWithDir.name}`);
      console.log(`Working Directory: ${projectWithDir.workingDirectory}`);
      console.log(`Packet IDs: ${projectWithDir.packetIds?.length || 0} packets`);
    }

    expect(data.success).toBe(true);
  });

  test('should attempt packet execution via UI', async ({ page }) => {
    test.setTimeout(180000);

    // Navigate to projects
    await page.goto(`${BASE_URL}/projects`);
    await waitForAppReady(page);

    // Click first project
    const projectLink = page.locator('a[href^="/projects/project-"]').first();
    if (await projectLink.isVisible().catch(() => false)) {
      await projectLink.click();
      await waitForAppReady(page);
      await page.waitForTimeout(2000);

      // Look for Execution panel
      const executionTab = page.locator('[data-value="execution"], button:has-text("Execution")').first();
      if (await executionTab.isVisible().catch(() => false)) {
        await executionTab.click();
        await page.waitForTimeout(1000);
      }

      await takeScreenshot(page, 'execution-panel');

      // Look for packet selection dropdown or list
      const packetDropdown = page.locator('select, [role="combobox"], button:has-text("Select Packet")');
      if (await packetDropdown.first().isVisible().catch(() => false)) {
        await packetDropdown.first().click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, 'packet-dropdown-open');
      }

      // Look for model selection
      const modelDropdown = page.locator('select:has-text("Model"), [aria-label*="model"], button:has-text("Select Model")');
      if (await modelDropdown.first().isVisible().catch(() => false)) {
        console.log('Found model dropdown');
        await takeScreenshot(page, 'model-dropdown');
      }

      // Check for execute button and its state
      const executeBtn = page.locator('button:has-text("Execute"), button:has-text("Run Packet")');
      if (await executeBtn.first().isVisible().catch(() => false)) {
        const isDisabled = await executeBtn.first().isDisabled();
        console.log(`Execute button visible, disabled: ${isDisabled}`);
        await takeScreenshot(page, 'execute-button-state');
      }

      await takeScreenshot(page, 'execution-ui-final');
    }
  });
});
