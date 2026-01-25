import { test, expect, Page } from '@playwright/test';

/**
 * Build Plan Exploration E2E Tests
 *
 * Tests the Build Plan UI within created projects
 */

const SCREENSHOT_DIR = '/tmp/build-plan-exploration';
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

test.describe('Build Plan Exploration', () => {
  test.beforeAll(async () => {
    const { execSync } = require('child_process');
    execSync(`mkdir -p ${SCREENSHOT_DIR}`);
  });

  test('should navigate to Build Plan tab and view phases/packets', async ({ page }) => {
    test.setTimeout(180000);

    // Get projects and navigate to one with packets
    await page.goto(`${BASE_URL}/projects`);
    await waitForAppReady(page);
    await takeScreenshot(page, '01-projects-list');

    // Click on first project
    const projectLink = page.locator('a[href^="/projects/project-"]').first();
    if (!await projectLink.isVisible().catch(() => false)) {
      console.log('No projects found');
      return;
    }

    await projectLink.click();
    await waitForAppReady(page);
    await page.waitForTimeout(2000);
    await takeScreenshot(page, '02-project-page');

    // Click Build Plan tab
    const buildPlanTab = page.locator('button:has-text("Build Plan"), [data-value="build-plan"]').first();
    if (await buildPlanTab.isVisible().catch(() => false)) {
      console.log('Clicking Build Plan tab');
      await buildPlanTab.click();
      await page.waitForTimeout(1000);
      await takeScreenshot(page, '03-build-plan-tab');
    }

    // Look for phases
    const phases = page.locator('text=Phase, [data-testid*="phase"]');
    const phaseCount = await phases.count().catch(() => 0);
    console.log(`Found ${phaseCount} phase elements`);

    // Look for packets
    const packets = page.locator('[class*="packet"], [data-testid*="packet"]');
    const packetCount = await packets.count().catch(() => 0);
    console.log(`Found ${packetCount} packet elements`);

    // Look for packet cards or list items
    const packetItems = page.locator('.packet-card, [class*="PacketCard"], div:has(text*="Repository"), div:has(text*="Setup")');
    console.log(`Packet items: ${await packetItems.count().catch(() => 0)}`);

    await takeScreenshot(page, '04-build-plan-content');

    // Check the page content for key terms
    const content = await page.content();
    console.log('Page has "Phase":', content.includes('Phase'));
    console.log('Page has "Packet":', content.includes('Packet') || content.includes('packet'));
    console.log('Page has "Setup":', content.includes('Setup'));
    console.log('Page has "queued":', content.includes('queued'));
  });

  test('should view AI Models tab', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto(`${BASE_URL}/projects`);
    await waitForAppReady(page);

    const projectLink = page.locator('a[href^="/projects/project-"]').first();
    if (await projectLink.isVisible().catch(() => false)) {
      await projectLink.click();
      await waitForAppReady(page);
      await page.waitForTimeout(2000);

      // Click AI Models tab
      const modelsTab = page.locator('button:has-text("AI Models"), [data-value="ai-models"]').first();
      if (await modelsTab.isVisible().catch(() => false)) {
        console.log('Clicking AI Models tab');
        await modelsTab.click();
        await page.waitForTimeout(1000);
        await takeScreenshot(page, '05-ai-models-tab');

        // Look for model settings
        const modelSettings = page.locator('text=Model, text=Provider, text=Default');
        console.log(`Model settings visible: ${await modelSettings.first().isVisible().catch(() => false)}`);
      }

      await takeScreenshot(page, '06-ai-models-content');
    }
  });

  test('should view Claude Code tab', async ({ page }) => {
    test.setTimeout(120000);

    await page.goto(`${BASE_URL}/projects`);
    await waitForAppReady(page);

    const projectLink = page.locator('a[href^="/projects/project-"]').first();
    if (await projectLink.isVisible().catch(() => false)) {
      await projectLink.click();
      await waitForAppReady(page);
      await page.waitForTimeout(2000);

      // Click Claude Code tab
      const claudeCodeTab = page.locator('button:has-text("Claude Code"), [data-value="claude-code"]').first();
      if (await claudeCodeTab.isVisible().catch(() => false)) {
        console.log('Clicking Claude Code tab');
        await claudeCodeTab.click();
        await page.waitForTimeout(1000);
        await takeScreenshot(page, '07-claude-code-tab');

        // Look for Claude Code integration
        const claudeContent = page.locator('text=Claude, text=Terminal, text=Execute');
        console.log(`Claude content visible: ${await claudeContent.first().isVisible().catch(() => false)}`);
      }

      await takeScreenshot(page, '08-claude-code-content');
    }
  });

  test('should navigate to Execution section and explore UI', async ({ page }) => {
    test.setTimeout(180000);

    await page.goto(`${BASE_URL}/projects`);
    await waitForAppReady(page);

    const projectLink = page.locator('a[href^="/projects/project-"]').first();
    if (await projectLink.isVisible().catch(() => false)) {
      await projectLink.click();
      await waitForAppReady(page);
      await page.waitForTimeout(2000);

      // Click on Execution in the sidebar
      const executionLink = page.locator('aside a:has-text("Execution"), aside button:has-text("Execution")').first();
      if (await executionLink.isVisible().catch(() => false)) {
        console.log('Clicking Execution link');
        await executionLink.click();
        await page.waitForTimeout(1000);
        await takeScreenshot(page, '09-execution-sidebar');
      }

      // Look for execution panel components
      const executionPanel = page.locator('[class*="execution"], [data-testid*="execution"]');
      console.log(`Execution panel: ${await executionPanel.first().isVisible().catch(() => false)}`);

      // Look for model dropdown
      const modelDropdown = page.locator('select, [role="combobox"]').first();
      if (await modelDropdown.isVisible().catch(() => false)) {
        console.log('Found model dropdown');
        await modelDropdown.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '10-model-dropdown');
      }

      await takeScreenshot(page, '11-execution-final');
    }
  });
});
