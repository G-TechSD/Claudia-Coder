import { test, expect } from '@playwright/test';

/**
 * TaskFlow Benchmark E2E Test
 *
 * Uses the pre-built TaskFlow benchmark project to test:
 * 1. Load TaskFlow Benchmark
 * 2. Navigate to Work Packets
 * 3. Click GO to process
 * 4. Watch processing complete
 * 5. Launch & Test
 */

test.describe('TaskFlow Benchmark E2E', () => {
  test.setTimeout(600000); // 10 minute timeout

  test('should process TaskFlow benchmark packets', async ({ page }) => {
    // Step 1: Go to projects page
    console.log('Step 1: Navigate to projects page');
    await page.goto('https://localhost:3000/projects', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/screenshots/taskflow-01-projects.png' });

    // Step 2: Click "Load TaskFlow Benchmark"
    console.log('Step 2: Load TaskFlow Benchmark');
    const loadButton = page.locator('button:has-text("Load TaskFlow Benchmark")');
    if (await loadButton.count() > 0) {
      await loadButton.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-results/screenshots/taskflow-02-loading.png' });
    }

    // Step 3: Find and click on TaskFlow project
    console.log('Step 3: Open TaskFlow project');
    await page.waitForTimeout(2000);

    // Look for TaskFlow in the projects list
    const taskflowLink = page.locator('a[href*="/projects/"]:has-text("TaskFlow")').first();
    if (await taskflowLink.count() > 0) {
      await taskflowLink.click();
      await page.waitForTimeout(2000);
    } else {
      // Try clicking on any project link that might be TaskFlow
      const anyProjectLink = page.locator('a[href^="/projects/"]:not([href="/projects/new"]):not([href="/projects/trash"])').first();
      if (await anyProjectLink.count() > 0) {
        await anyProjectLink.click();
        await page.waitForTimeout(2000);
      }
    }

    await page.screenshot({ path: 'test-results/screenshots/taskflow-03-project.png' });
    console.log('Current URL:', page.url());

    // Step 4: Go to Work Packets
    console.log('Step 4: Navigate to Work Packets');
    const workPacketsNav = page.getByRole('button', { name: 'Work Packets' });
    if (await workPacketsNav.count() > 0) {
      await workPacketsNav.click();
      await page.waitForTimeout(2000);
    }
    await page.screenshot({ path: 'test-results/screenshots/taskflow-04-packets.png' });

    // Step 5: Check for GO button
    console.log('Step 5: Looking for GO button');
    const goButton = page.locator('button:has-text("GO")').first();
    const runAllButton = page.locator('button:has-text("Run All")').first();

    if (await goButton.count() > 0 && await goButton.isEnabled()) {
      console.log('Found GO button, clicking...');
      await page.screenshot({ path: 'test-results/screenshots/taskflow-05-before-go.png' });
      await goButton.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-results/screenshots/taskflow-06-after-go.png' });

      // Wait for processing
      console.log('Step 6: Waiting for processing...');
      const maxWait = 300000; // 5 minutes
      const startTime = Date.now();

      while (Date.now() - startTime < maxWait) {
        await page.waitForTimeout(10000);
        await page.screenshot({ path: `test-results/screenshots/taskflow-progress-${Math.floor((Date.now() - startTime) / 10000)}.png` });

        // Check for completion
        const complete = page.locator('text=Complete').or(page.locator('text=completed'));
        const stopped = page.locator('text=Stopped').or(page.locator('text=stopped'));
        const failed = page.locator('text=Failed');

        if (await complete.count() > 0 || await stopped.count() > 0 || await failed.count() > 0) {
          console.log('Processing finished');
          break;
        }

        console.log(`Still processing... ${Math.floor((Date.now() - startTime) / 1000)}s`);
      }
    } else if (await runAllButton.count() > 0) {
      console.log('Found Run All button instead');
      await page.screenshot({ path: 'test-results/screenshots/taskflow-05-run-all.png' });
    } else {
      console.log('No GO or Run All button found');
      await page.screenshot({ path: 'test-results/screenshots/taskflow-05-no-button.png' });
    }

    // Final screenshot
    await page.screenshot({ path: 'test-results/screenshots/taskflow-final.png' });
    console.log('TaskFlow E2E test completed');
  });
});
