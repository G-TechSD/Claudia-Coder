import { chromium } from 'playwright';

async function testEasyMode() {
  console.log('Starting Easy Mode test v2...');
  console.log('====================================');
  
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--ignore-certificate-errors']
  });
  const context = await browser.newContext({ 
    ignoreHTTPSErrors: true,
    bypassCSP: true
  });
  const page = await context.newPage();
  
  // Log browser console
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser ERROR:', msg.text());
    }
  });
  
  try {
    // Step 1: Navigate to Easy Mode
    console.log('\nStep 1: Navigating to Easy Mode...');
    await page.goto('https://localhost:3000/easy-mode', { 
      timeout: 30000,
      waitUntil: 'commit'
    });
    await page.waitForTimeout(5000); // Wait for hydration
    await page.screenshot({ path: '/tmp/easy-mode-test-v2/01-easy-mode-landing.png', fullPage: true });
    console.log('  Screenshot: 01-easy-mode-landing.png');
    
    // Step 2: Enter project name
    console.log('\nStep 2: Entering project name...');
    const nameInput = page.locator('input').first();
    await nameInput.waitFor({ state: 'visible', timeout: 10000 });
    await nameInput.fill('Test Project Beta');
    await page.screenshot({ path: '/tmp/easy-mode-test-v2/02-project-name-entered.png', fullPage: true });
    console.log('  Screenshot: 02-project-name-entered.png');
    
    // Step 3: Enter description (if textarea exists on first page)
    console.log('\nStep 3: Looking for description field...');
    const textarea = page.locator('textarea').first();
    if (await textarea.count() > 0 && await textarea.isVisible()) {
      await textarea.fill('A simple test project to verify Easy Mode works');
      await page.screenshot({ path: '/tmp/easy-mode-test-v2/03-description-entered.png', fullPage: true });
      console.log('  Screenshot: 03-description-entered.png');
    } else {
      console.log('  No description textarea found (may be on different step)');
    }
    
    // Step 4: Click Next to brain dump step
    console.log('\nStep 4: Clicking Next button...');
    const nextButtons = page.getByRole('button', { name: /next|continue/i });
    if (await nextButtons.count() > 0) {
      await nextButtons.first().click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: '/tmp/easy-mode-test-v2/04-brain-dump-step.png', fullPage: true });
      console.log('  Screenshot: 04-brain-dump-step.png');
    } else {
      console.log('  No Next button found');
    }
    
    // Step 5: Brain Dump step - Click "Generate Plan" to proceed (this is the actual button name)
    console.log('\nStep 5: Brain dump step - clicking Generate Plan...');
    await page.waitForTimeout(1000);
    
    // Log available buttons for debugging
    const buttons = await page.locator('button').allTextContents();
    console.log('  Available buttons:', buttons);
    
    // The button is "Generate Plan" not just "Generate"
    const generatePlanBtn = page.getByRole('button', { name: /generate plan/i });
    
    if (await generatePlanBtn.count() > 0 && await generatePlanBtn.first().isVisible()) {
      console.log('  Clicking Generate Plan button...');
      await generatePlanBtn.first().click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/easy-mode-test-v2/05-after-generate-plan.png', fullPage: true });
      console.log('  Screenshot: 05-after-generate-plan.png');
    } else {
      // Try generic "Generate" button
      const generateBtn = page.getByRole('button', { name: /^generate$/i });
      if (await generateBtn.count() > 0 && await generateBtn.first().isEnabled()) {
        await generateBtn.first().click();
        await page.waitForTimeout(3000);
      }
    }
    
    // Step 6: Wait for generation to complete
    console.log('\nStep 6: Waiting for generation (up to 2 minutes)...');
    let waitTime = 0;
    const maxWait = 120000;
    let generationComplete = false;
    let error = null;
    
    while (waitTime < maxWait) {
      await page.waitForTimeout(5000);
      waitTime += 5000;
      
      // Check for success indicators - looking for Review step or Approve button
      const approveButton = page.getByRole('button', { name: /approve|accept/i });
      const continueBtn = page.getByRole('button', { name: /continue/i });
      const reviewStep = page.locator('text=Review your generated plan');
      
      // Check for errors
      const errorEl = page.locator('.text-red-500, .text-destructive').first();
      const errorText = await errorEl.textContent().catch(() => null);
      
      if (errorText && errorText.trim() && errorText.length > 5) {
        console.log(`  ERROR DETECTED: ${errorText}`);
        error = errorText;
        await page.screenshot({ path: '/tmp/easy-mode-test-v2/06-error.png', fullPage: true });
        break;
      }
      
      // Check if we're on Review step
      if ((await approveButton.count() > 0 && await approveButton.first().isVisible()) ||
          (await continueBtn.count() > 0 && await continueBtn.first().isVisible()) ||
          (await reviewStep.count() > 0)) {
        console.log('  Generation complete - reached Review step!');
        generationComplete = true;
        await page.screenshot({ path: '/tmp/easy-mode-test-v2/06-generation-complete.png', fullPage: true });
        console.log('  Screenshot: 06-generation-complete.png');
        break;
      }
      
      console.log(`    Waiting... ${waitTime/1000}s elapsed`);
      
      // Take periodic progress screenshots
      if (waitTime % 20000 === 0) {
        await page.screenshot({ path: `/tmp/easy-mode-test-v2/06-progress-${waitTime/1000}s.png`, fullPage: true });
        console.log(`    Progress screenshot: 06-progress-${waitTime/1000}s.png`);
      }
    }
    
    if (!generationComplete && !error) {
      console.log('  Generation timed out');
      await page.screenshot({ path: '/tmp/easy-mode-test-v2/06-timeout.png', fullPage: true });
    }
    
    // Step 7: Approve/Continue step (if generation succeeded)
    if (generationComplete) {
      console.log('\nStep 7: Review/Approve step...');
      
      // Try approve button
      const approveBtn = page.getByRole('button', { name: /approve|accept/i });
      if (await approveBtn.count() > 0 && await approveBtn.first().isVisible()) {
        await approveBtn.first().click();
        await page.waitForTimeout(3000);
        await page.screenshot({ path: '/tmp/easy-mode-test-v2/07-approved.png', fullPage: true });
        console.log('  Screenshot: 07-approved.png');
      } else {
        // Try continue/next button
        const contBtn = page.getByRole('button', { name: /continue|next/i });
        if (await contBtn.count() > 0 && await contBtn.first().isVisible()) {
          await contBtn.first().click();
          await page.waitForTimeout(3000);
          await page.screenshot({ path: '/tmp/easy-mode-test-v2/07-continued.png', fullPage: true });
          console.log('  Screenshot: 07-continued.png');
        }
      }
      
      // Step 8: Build step
      console.log('\nStep 8: Build step...');
      await page.waitForTimeout(2000);
      
      const buildBtn = page.getByRole('button', { name: /build|create|finish/i });
      if (await buildBtn.count() > 0 && await buildBtn.first().isVisible()) {
        await buildBtn.first().click();
        await page.waitForTimeout(5000);
        await page.screenshot({ path: '/tmp/easy-mode-test-v2/08-build.png', fullPage: true });
        console.log('  Screenshot: 08-build.png');
      } else {
        console.log('  No build button found');
        await page.screenshot({ path: '/tmp/easy-mode-test-v2/08-no-build.png', fullPage: true });
      }
    }
    
    // Final state
    await page.screenshot({ path: '/tmp/easy-mode-test-v2/09-final-state.png', fullPage: true });
    console.log('\nFinal screenshot: 09-final-state.png');
    
    console.log('\n====================================');
    if (generationComplete) {
      console.log('TEST COMPLETED SUCCESSFULLY');
    } else if (error) {
      console.log('TEST FAILED - Error during generation');
    } else {
      console.log('TEST INCOMPLETE - Generation timed out');
    }
    console.log('====================================');
    
  } catch (error: any) {
    console.log('\nERROR:', error.message);
    try {
      await page.screenshot({ path: '/tmp/easy-mode-test-v2/error-state.png', fullPage: true });
    } catch (e) {
      console.log('Could not take error screenshot');
    }
  } finally {
    await browser.close();
  }
}

testEasyMode();
