const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, 'test-results/screenshots');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

(async () => {
  console.log('Starting Playwright test for project models...\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    ignoreHTTPSErrors: true
  });
  const page = await context.newPage();

  // Track console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[Console Error] ${msg.text()}`);
    }
  });

  try {
    // Step 1: Navigate to projects list
    console.log('Step 1: Navigating to /projects...');
    await page.goto('http://localhost:3000/projects', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Take screenshot of projects list
    const projectsListPath = path.join(SCREENSHOT_DIR, 'projects-list.png');
    await page.screenshot({ path: projectsListPath, fullPage: true });
    console.log(`Screenshot saved: ${projectsListPath}`);

    // Log page title and URL
    console.log(`  Page title: ${await page.title()}`);
    console.log(`  URL: ${page.url()}`);

    // Step 2: Find and click on the first project
    console.log('\nStep 2: Looking for projects...');

    // Try various selectors to find project links
    const projectSelectors = [
      'a[href*="/projects/"]',
      '[data-testid="project-card"]',
      '.project-card',
      'table tbody tr a',
      '.card a[href*="/project"]'
    ];

    let projectLink = null;
    for (const selector of projectSelectors) {
      const elements = page.locator(selector);
      const count = await elements.count();
      if (count > 0) {
        // Find a link that actually goes to a project detail page (contains a UUID)
        for (let i = 0; i < count; i++) {
          const href = await elements.nth(i).getAttribute('href');
          if (href && href.match(/\/projects\/[a-f0-9-]{36}/)) {
            projectLink = elements.nth(i);
            console.log(`  Found project link: ${href}`);
            break;
          }
        }
        if (projectLink) break;
      }
    }

    if (!projectLink) {
      console.log('  No projects found on the page.');
      console.log('  Taking screenshot of current state...');
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'no-projects-found.png'),
        fullPage: true
      });
      await browser.close();
      return;
    }

    // Click the project
    await projectLink.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Step 3: Take screenshot of project detail page
    console.log('\nStep 3: Capturing project detail page...');
    const projectDetailPath = path.join(SCREENSHOT_DIR, 'project-detail.png');
    await page.screenshot({ path: projectDetailPath, fullPage: true });
    console.log(`Screenshot saved: ${projectDetailPath}`);
    console.log(`  URL: ${page.url()}`);

    // Step 4: Look for AI Models tab and click it
    console.log('\nStep 4: Looking for AI Models tab...');

    // The project detail page has tabs: Repositories, Browse Files, Work Packets, Claude Code, AI Models
    const aiModelsTab = page.locator('button:has-text("AI Models"), [role="tab"]:has-text("AI Models")');

    if (await aiModelsTab.count() > 0) {
      console.log('  Found AI Models tab, clicking it...');
      await aiModelsTab.first().click();
      await page.waitForTimeout(1000);

      // Take screenshot of the AI Models tab content
      const aiModelsTabPath = path.join(SCREENSHOT_DIR, 'project-ai-models-tab.png');
      await page.screenshot({ path: aiModelsTabPath, fullPage: true });
      console.log(`Screenshot saved: ${aiModelsTabPath}`);
    } else {
      console.log('  AI Models tab not found, checking for Model section directly...');
    }

    // The ModelAssignment component has "Enabled Models" with a Brain icon and an "Add" button
    // Look for elements that indicate the model assignment area

    // First, let's see if we can find the Models section
    const enabledModelsText = page.locator('text=Enabled Models');
    const defaultModelText = page.locator('text=Default Model');

    if (await enabledModelsText.count() > 0 || await defaultModelText.count() > 0) {
      console.log('  Found Model section on page!');

      // Find and click the "Add" button to show available models
      // Look specifically for the Add button in the Enabled Models section
      const addButton = page.locator('button:has-text("Add")').first();
      if (await addButton.count() > 0) {
        console.log('  Found Add button, waiting for it to be enabled...');

        // Wait a bit for providers to load (they come from API)
        await page.waitForTimeout(3000);

        // Check if button is enabled now
        const isDisabled = await addButton.isDisabled();
        console.log(`  Button disabled state: ${isDisabled}`);

        if (isDisabled) {
          console.log('  Add button is still disabled (providers may be loading)');
          console.log('  Taking screenshot of current state...');
        } else {
          console.log('  Clicking Add button to reveal model options...');
          await addButton.click();
          await page.waitForTimeout(1000);
        }

        // Take screenshot showing the model dropdown/panel
        const modelsDropdownPath = path.join(SCREENSHOT_DIR, 'project-models-dropdown.png');
        await page.screenshot({ path: modelsDropdownPath, fullPage: true });
        console.log(`Screenshot saved: ${modelsDropdownPath}`);

        // Analyze what we see
        console.log('\n  Analyzing model options visible...');

        // Check for provider grid (local servers + cloud providers)
        const selectProviderText = page.locator('text=Select Provider');
        if (await selectProviderText.count() > 0) {
          console.log('  Found "Select Provider" section');

          // Look for cloud providers
          const anthropicButton = page.locator('button:has-text("Anthropic")');
          const openaiButton = page.locator('button:has-text("OpenAI")');
          const googleButton = page.locator('button:has-text("Google")');

          const cloudProviders = [];
          if (await anthropicButton.count() > 0) cloudProviders.push('Anthropic');
          if (await openaiButton.count() > 0) cloudProviders.push('OpenAI');
          if (await googleButton.count() > 0) cloudProviders.push('Google AI');

          console.log(`  Cloud providers visible: ${cloudProviders.join(', ') || 'None'}`);

          // Look for local servers
          const lmstudioText = page.locator('text=LM Studio');
          const ollamaText = page.locator('text=Ollama');

          const localServers = [];
          if (await lmstudioText.count() > 0) localServers.push('LM Studio');
          if (await ollamaText.count() > 0) localServers.push('Ollama');

          console.log(`  Local servers visible: ${localServers.join(', ') || 'None'}`);

          // Click on a cloud provider to see the models
          if (await anthropicButton.count() > 0) {
            console.log('\n  Clicking on Anthropic to see available models...');
            await anthropicButton.click();
            await page.waitForTimeout(500);

            // Look for "Select Model" section and model buttons
            const selectModelText = page.locator('text=Select Model');
            if (await selectModelText.count() > 0) {
              console.log('  Found "Select Model" section');

              // Find model buttons (claude-3-opus, claude-3-sonnet, etc.)
              const modelButtons = page.locator('button').filter({ hasText: /claude|gpt|gemini/i });
              const modelCount = await modelButtons.count();

              if (modelCount > 0) {
                console.log(`  Found ${modelCount} model options:`);
                for (let i = 0; i < Math.min(modelCount, 10); i++) {
                  const text = await modelButtons.nth(i).textContent();
                  console.log(`    - ${text?.trim()}`);
                }
              }
            }

            // Take screenshot of model selection
            const modelSelectionPath = path.join(SCREENSHOT_DIR, 'project-models-selection.png');
            await page.screenshot({ path: modelSelectionPath, fullPage: true });
            console.log(`\nScreenshot saved: ${modelSelectionPath}`);
          }
        }
      } else {
        console.log('  Add button not found');
      }
    } else {
      console.log('  Model section not visible on current view');
      console.log('  Scrolling to look for it...');

      // Scroll down to find it
      await page.evaluate(() => window.scrollBy(0, 500));
      await page.waitForTimeout(300);

      // Take another screenshot
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, 'project-detail-scrolled.png'),
        fullPage: true
      });
    }

    // Step 5: Summary
    console.log('\n=== SUMMARY ===');
    console.log('Screenshots saved:');
    const screenshots = fs.readdirSync(SCREENSHOT_DIR);
    screenshots.forEach(s => {
      console.log(`  - ${path.join(SCREENSHOT_DIR, s)}`);
    });

  } catch (error) {
    console.error('\nError during test:', error.message);
    // Take error screenshot
    await page.screenshot({
      path: path.join(SCREENSHOT_DIR, 'error-state.png'),
      fullPage: true
    });
  } finally {
    await browser.close();
    console.log('\nTest completed.');
  }
})();
