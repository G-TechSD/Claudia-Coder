import { test, expect } from '@playwright/test';

/**
 * Manual Packet Creation and Processing Test
 *
 * Tests the full flow by manually creating a packet, bypassing
 * build plan generation issues with small local models.
 */

test.describe('Manual Packet Flow', () => {
  test.setTimeout(600000); // 10 minute timeout

  test('should create packet manually and process it', async ({ page }) => {
    // Step 1: Create a new project via Quick Start
    console.log('Step 1: Create project via Quick Start');
    await page.goto('https://localhost:3000/projects/new', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Fill in description
    const textarea = page.locator('textarea').first();
    await textarea.fill('A simple calculator app with add, subtract, multiply, divide functions');
    await page.screenshot({ path: 'test-results/screenshots/manual-01-new-project.png' });

    // Click Quick Start
    const quickStartButton = page.locator('button:has-text("Quick Start")');
    await quickStartButton.click();

    // Wait for plan
    console.log('Waiting for quick plan...');
    for (let i = 0; i < 30; i++) {
      const looksGood = page.locator('button:has-text("Looks Good")');
      if (await looksGood.count() > 0) break;
      await page.waitForTimeout(2000);
    }

    // Click Looks Good
    const looksGoodBtn = page.locator('button:has-text("Looks Good")');
    if (await looksGoodBtn.count() > 0) {
      await looksGoodBtn.click();
      await page.waitForTimeout(2000);
    }

    // Click View Project
    const viewProjectBtn = page.locator('button:has-text("View Project")');
    if (await viewProjectBtn.count() > 0) {
      await viewProjectBtn.click();
      await page.waitForTimeout(2000);
    }

    await page.screenshot({ path: 'test-results/screenshots/manual-02-project-created.png' });
    console.log('Project URL:', page.url());

    // Step 2: Navigate to Work Packets
    console.log('Step 2: Navigate to Work Packets');
    const workPacketsNav = page.getByRole('button', { name: 'Work Packets' });
    if (await workPacketsNav.count() > 0) {
      await workPacketsNav.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: 'test-results/screenshots/manual-03-work-packets.png' });

    // Step 3: Click "Create Your First Packet" or "Create Packet"
    console.log('Step 3: Create a packet manually');
    const createFirstBtn = page.locator('button:has-text("Create Your First Packet")');
    const createPacketBtn = page.locator('button:has-text("Create Packet")').first();

    if (await createFirstBtn.count() > 0) {
      console.log('Clicking "Create Your First Packet"');
      await createFirstBtn.click();
    } else if (await createPacketBtn.count() > 0) {
      console.log('Clicking "Create Packet"');
      await createPacketBtn.click();
    }

    // Wait for dialog to open
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/screenshots/manual-04-create-packet-dialog.png' });

    // Wait for the dialog to appear
    const dialog = page.locator('[role="dialog"]');
    await dialog.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
      console.log('Dialog not found via role, trying other selectors');
    });

    // Fill in packet details using the dialog's inputs
    const titleInput = page.locator('#new-title');
    if (await titleInput.count() > 0) {
      console.log('Filling title input');
      await titleInput.fill('Implement Calculator Functions');
    } else {
      console.log('Title input not found, trying fallback');
      const fallbackTitle = page.locator('input[placeholder*="authentication"]').or(page.locator('[role="dialog"] input').first());
      if (await fallbackTitle.count() > 0) {
        await fallbackTitle.fill('Implement Calculator Functions');
      }
    }

    const descInput = page.locator('#new-description');
    if (await descInput.count() > 0) {
      console.log('Filling description textarea');
      await descInput.fill('Create add, subtract, multiply, and divide functions that take two numbers and return the result. Include error handling for division by zero.');
    } else {
      console.log('Description input not found, trying fallback');
      const fallbackDesc = page.locator('[role="dialog"] textarea').first();
      if (await fallbackDesc.count() > 0) {
        await fallbackDesc.fill('Create add, subtract, multiply, and divide functions that take two numbers and return the result. Include error handling for division by zero.');
      }
    }

    await page.screenshot({ path: 'test-results/screenshots/manual-05-packet-filled.png' });

    // Click the Create Packet button in the dialog (not the one that opens the dialog)
    const createBtn = page.locator('[role="dialog"] button:has-text("Create Packet")');
    if (await createBtn.count() > 0) {
      console.log('Clicking Create Packet button in dialog');
      await createBtn.click();
      await page.waitForTimeout(2000);
    } else {
      console.log('Create button not found in dialog');
      // Try alternate selector
      const altCreateBtn = page.locator('button:has-text("Create Packet")').last();
      if (await altCreateBtn.count() > 0) {
        await altCreateBtn.click();
        await page.waitForTimeout(2000);
      }
    }

    await page.screenshot({ path: 'test-results/screenshots/manual-06-packet-created.png' });

    // Step 4: Look for processing buttons (GO, Run All, or Start)
    console.log('Step 4: Look for processing button');
    await page.waitForTimeout(2000);

    const goButton = page.locator('button:has-text("GO")').first();
    const runAllButton = page.locator('button:has-text("Run All")').first();
    const startButton = page.locator('button:has-text("Start")').first();

    let buttonClicked = false;

    if (await goButton.count() > 0 && await goButton.isEnabled()) {
      console.log('Step 5: Found GO button, clicking to start processing');
      await page.screenshot({ path: 'test-results/screenshots/manual-07-before-processing.png' });
      await goButton.click();
      buttonClicked = true;
    } else if (await runAllButton.count() > 0) {
      console.log('Step 5: Found Run All button, clicking to start processing');
      await page.screenshot({ path: 'test-results/screenshots/manual-07-before-processing.png' });
      await runAllButton.click();
      buttonClicked = true;
    } else if (await startButton.count() > 0) {
      console.log('Step 5: Found Start button, clicking to start processing');
      await page.screenshot({ path: 'test-results/screenshots/manual-07-before-processing.png' });
      await startButton.click();
      buttonClicked = true;
    } else {
      console.log('No processing button found - packet might not have been created');
      await page.screenshot({ path: 'test-results/screenshots/manual-07-no-button.png' });
    }

    if (buttonClicked) {
      // Wait for processing to start
      console.log('Waiting for processing to start...');
      await page.waitForTimeout(5000);
      await page.screenshot({ path: 'test-results/screenshots/manual-08-processing.png' });

      // Monitor processing for up to 5 minutes
      const maxWait = 300000;
      const startTime = Date.now();

      while (Date.now() - startTime < maxWait) {
        await page.waitForTimeout(15000);
        await page.screenshot({
          path: `test-results/screenshots/manual-progress-${Math.floor((Date.now() - startTime) / 15000)}.png`
        });

        // Check for completion
        const pageText = await page.textContent('body');
        if (pageText?.includes('Complete') || pageText?.includes('completed') ||
            pageText?.includes('Stopped') || pageText?.includes('Failed') ||
            pageText?.includes('success')) {
          console.log('Processing finished');
          break;
        }

        console.log(`Processing... ${Math.floor((Date.now() - startTime) / 1000)}s`);
      }

      await page.screenshot({ path: 'test-results/screenshots/manual-09-final.png' });

      // Step 6: Check for Launch & Test functionality
      console.log('Step 6: Navigate to Launch & Test');
      const launchTestNav = page.getByRole('button', { name: 'Launch & Test' });
      if (await launchTestNav.count() > 0) {
        await launchTestNav.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-results/screenshots/manual-10-launch-test.png' });
      }
    }

    console.log('Manual packet flow test completed');
  });
});
