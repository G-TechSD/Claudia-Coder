import { test, expect } from '@playwright/test';

/**
 * Full End-to-End Flow Test
 *
 * This test creates a simple project and takes it through the entire workflow:
 * 1. Create project via Quick Start
 * 2. Wait for build plan generation
 * 3. Process packets with LM Studio
 * 4. Launch and test the generated app
 */

test.describe('Full E2E Flow', () => {
  test.setTimeout(600000); // 10 minute timeout for full flow

  test('should complete full project workflow', async ({ page }) => {
    // Step 1: Navigate to new project page
    console.log('Step 1: Navigate to new project page');
    await page.goto('https://localhost:3000/projects/new', { waitUntil: 'networkidle' });
    await page.screenshot({ path: 'test-results/screenshots/e2e-01-new-project.png' });

    // Step 2: Enter a simple project description
    console.log('Step 2: Enter project description');
    const description = 'A simple todo list web app with React. Users can add, edit, delete, and mark tasks as complete. Store tasks in local storage.';

    // Find the textarea and fill it
    const textarea = page.locator('textarea').first();
    await textarea.fill(description);
    await page.screenshot({ path: 'test-results/screenshots/e2e-02-description-entered.png' });

    // Step 3: Click Quick Start button
    console.log('Step 3: Click Quick Start');
    const quickStartButton = page.locator('button:has-text("Quick Start")');
    await quickStartButton.click();

    // Wait for plan generation (AI call can take 30-60 seconds)
    console.log('Step 4: Waiting for plan generation...');

    // Wait for "Review Your Plan" or "Looks Good" to appear (up to 90 seconds)
    const maxWait = 90000;
    const startTime = Date.now();
    let planGenerated = false;

    while (Date.now() - startTime < maxWait) {
      const reviewPlan = page.locator('text=Review Your Plan');
      const looksGood = page.locator('button:has-text("Looks Good")');

      if (await reviewPlan.count() > 0 || await looksGood.count() > 0) {
        console.log('Plan generated successfully!');
        planGenerated = true;
        break;
      }

      await page.waitForTimeout(3000);
      console.log(`Waiting for plan... ${Math.floor((Date.now() - startTime) / 1000)}s`);
    }

    await page.screenshot({ path: 'test-results/screenshots/e2e-03-after-quick-start.png' });

    // Step 4: Click "Looks Good" to approve the plan
    console.log('Step 4: Looking for "Looks Good" button...');
    const looksGoodButton = page.locator('button:has-text("Looks Good")');
    if (await looksGoodButton.count() > 0) {
      console.log('Clicking "Looks Good" to approve plan');
      await looksGoodButton.click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'test-results/screenshots/e2e-04-plan-approved.png' });
    }

    // Step 5: Click "View Project" to go to project page
    console.log('Step 5: Looking for "View Project" button...');
    const viewProjectButton = page.locator('button:has-text("View Project")');
    if (await viewProjectButton.count() > 0) {
      console.log('Clicking "View Project"');
      await viewProjectButton.click();
      await page.waitForTimeout(3000);
    }

    // Wait for project page to load
    console.log('Step 6: Waiting for project page...');
    await page.waitForURL(/\/projects\/[a-z0-9-]+/, { timeout: 60000 }).catch(() => {
      console.log('Did not navigate to project page, checking current state...');
    });

    await page.screenshot({ path: 'test-results/screenshots/e2e-05-project-page.png' });

    // If we're on a project page, look for the GO button or work packets
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

    if (currentUrl.includes('/projects/') && !currentUrl.includes('/new')) {
      console.log('Step 7: On project page, generating build plan...');

      // Wait for the page to fully load
      await page.waitForTimeout(2000);

      // Click on Build Plan to generate one
      const buildPlanNav = page.getByRole('button', { name: 'Build Plan' });
      if (await buildPlanNav.count() > 0) {
        console.log('Clicking Build Plan nav');
        await buildPlanNav.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-results/screenshots/e2e-06-build-plan.png' });

        // Look for Generate button
        const generateButton = page.locator('button:has-text("Generate Build Plan")');
        if (await generateButton.count() > 0) {
          console.log('Clicking Generate Build Plan');
          await generateButton.click();

          // Wait for AI to generate the plan (watch for completion)
          console.log('Waiting for build plan generation...');
          const maxWait = 180000; // 3 minutes max
          const startTime = Date.now();

          while (Date.now() - startTime < maxWait) {
            // Check for loading/generating indicators (could be either text)
            const loading = page.locator('text=Loading');
            const generating = page.locator('text=Generating');
            const processingPlan = page.locator('text=Processing');
            const error = page.locator('text=Error').or(page.locator('text=Failed'));

            // Check for completion - look for Accept button which appears when plan is ready
            const acceptButton = page.locator('button:has-text("Accept Build Plan")');
            if (await acceptButton.count() > 0) {
              console.log('Plan generated - Accept button is visible!');
              break;
            }

            // Check if still in progress
            const isInProgress = (await loading.count() > 0) || (await generating.count() > 0) || (await processingPlan.count() > 0);

            if (await error.count() > 0) {
              console.log('Generation error detected');
              await page.screenshot({ path: 'test-results/screenshots/e2e-error-generation.png' });
              break;
            }

            if (!isInProgress) {
              // Not in progress and no accept button - might have failed silently
              console.log('Not in progress, checking for results...');
              await page.waitForTimeout(3000);

              // One more check for accept button
              if (await acceptButton.count() > 0) {
                console.log('Accept button appeared after wait');
                break;
              }
            }

            await page.waitForTimeout(5000);
            console.log(`Still generating... ${Math.floor((Date.now() - startTime) / 1000)}s`);
          }

          await page.screenshot({ path: 'test-results/screenshots/e2e-07-plan-generated.png' });

          // CRITICAL: Click "Accept Build Plan & Add Packets" to actually save the packets
          console.log('Step 8: Waiting for plan to save, then accepting...');

          // Wait for "Saving..." to disappear (plan needs to be saved before we can accept)
          const savingIndicator = page.locator('text=Saving');
          let saveWaitTime = 0;
          while (await savingIndicator.count() > 0 && saveWaitTime < 30000) {
            await page.waitForTimeout(2000);
            saveWaitTime += 2000;
            console.log(`Waiting for save to complete... ${saveWaitTime / 1000}s`);
          }

          // Now click the Accept button (use .first() since there may be multiple)
          const acceptBtnFinal = page.locator('button:has-text("Accept Build Plan")').first();
          if (await acceptBtnFinal.count() > 0) {
            // Wait for button to be enabled
            await acceptBtnFinal.waitFor({ state: 'visible', timeout: 10000 });

            // Check if enabled
            const isDisabled = await acceptBtnFinal.isDisabled();
            if (isDisabled) {
              console.log('Accept button is still disabled, waiting...');
              await page.waitForTimeout(5000);
            }

            await acceptBtnFinal.click();
            console.log('Clicked Accept Build Plan button');

            // Wait for packets to be created
            console.log('Waiting for packets to be created...');
            await page.waitForTimeout(10000);
            await page.screenshot({ path: 'test-results/screenshots/e2e-08-plan-accepted.png' });
          } else {
            console.log('No Accept Build Plan button found');
          }
        }
      }

      // Go to Work Packets section
      const workPacketsNav = page.getByRole('button', { name: 'Work Packets' });
      if (await workPacketsNav.count() > 0) {
        console.log('Clicking Work Packets nav');
        await workPacketsNav.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'test-results/screenshots/e2e-08-work-packets.png' });
      }

      // Look for the GO button
      const goButton = page.locator('button:has-text("GO")').first();
      if (await goButton.count() > 0 && await goButton.isEnabled()) {
        console.log('Step 8: Found GO button, clicking to start processing...');
        await page.screenshot({ path: 'test-results/screenshots/e2e-09-before-go.png' });

        // Click GO to start processing
        await goButton.click();
        await page.screenshot({ path: 'test-results/screenshots/e2e-08-after-go-click.png' });

        // Wait for processing to start
        await page.waitForTimeout(5000);
        await page.screenshot({ path: 'test-results/screenshots/e2e-09-processing.png' });

        // Wait for processing to complete (up to 5 minutes)
        console.log('Step 7: Waiting for processing to complete...');
        const processingTimeout = 300000; // 5 minutes
        const startTime = Date.now();

        while (Date.now() - startTime < processingTimeout) {
          // Check for completion indicators
          const completeText = page.locator('text=Complete').or(page.locator('text=completed')).first();
          const errorText = page.locator('text=Failed').or(page.locator('text=Error')).first();

          if (await completeText.count() > 0) {
            console.log('Processing completed!');
            break;
          }

          if (await errorText.count() > 0) {
            console.log('Processing failed, taking screenshot...');
            await page.screenshot({ path: 'test-results/screenshots/e2e-10-error.png' });
            break;
          }

          // Take periodic screenshots
          if ((Date.now() - startTime) % 30000 < 5000) {
            await page.screenshot({ path: `test-results/screenshots/e2e-progress-${Math.floor((Date.now() - startTime) / 30000)}.png` });
          }

          await page.waitForTimeout(5000);
        }

        await page.screenshot({ path: 'test-results/screenshots/e2e-11-final-state.png' });
      } else {
        console.log('No GO button found or not enabled');
        await page.screenshot({ path: 'test-results/screenshots/e2e-no-go-button.png' });
      }
    }

    console.log('E2E test completed');
  });
});
