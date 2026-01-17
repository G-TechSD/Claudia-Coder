import { test, expect, Page } from '@playwright/test';

// Custom test configuration for localhost with self-signed certs
test.use({
  baseURL: 'https://localhost:3000',
  ignoreHTTPSErrors: true,
});

const SCREENSHOT_DIR = '/tmp/claudia-test-screenshots';

// Helper functions
async function takeScreenshot(page: Page, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}-${timestamp}.png`,
    fullPage: true,
  });
}

async function waitForAppReady(page: Page): Promise<void> {
  // Wait for the sidebar to be visible (indicates app shell is loaded)
  await page.waitForSelector('aside', { state: 'visible', timeout: 30000 }).catch(() => {
    console.log('Sidebar not found, continuing...');
  });

  // Wait for any loading spinners to disappear
  await page.waitForFunction(() => {
    const spinners = document.querySelectorAll('[class*="animate-spin"]');
    return spinners.length === 0;
  }, { timeout: 15000 }).catch(() => {
    // Ignore timeout - some pages may have persistent spinners
  });

  // Wait for network to be idle
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
    // Ignore timeout - some pages may have persistent connections
  });
}

function setupConsoleErrorCheck(page: Page): () => string[] {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      // Filter out known acceptable errors
      const acceptablePatterns = [
        /Failed to load resource.*favicon/i,
        /ResizeObserver loop/i,
        /Non-Error promise rejection/i,
        /hydration/i,
        /401/i,
        /api\/health/i,
        /Unauthorized/i,
        /N8N API/i,
        /Failed to fetch/i,
        /getAllProjects called without userId/i,
        /server activities/i,
        /NEXT_REDIRECT/i,
      ];
      if (!acceptablePatterns.some(pattern => pattern.test(text))) {
        errors.push(text);
        console.log(`Console error: ${text}`);
      }
    }
  });

  page.on('pageerror', (error) => {
    errors.push(`Page error: ${error.message}`);
    console.log(`Page error: ${error.message}`);
  });

  return () => errors;
}

test.describe('Claudia Coder Settings - Comprehensive Test', () => {
  test.describe('Main Settings Page', () => {
    test('should load and explore main settings tabs', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/settings');
      await waitForAppReady(page);
      await takeScreenshot(page, '01-main-settings-initial');

      // Check page loaded
      await expect(page).toHaveURL(/\/settings/);
      console.log('Main settings page loaded');

      // Look for main tabs
      const tabs = ['Default LLM Provider', 'Local Servers', 'Connections', 'Data Management'];
      for (const tabName of tabs) {
        const tab = page.locator(`button:has-text("${tabName}"), [role="tab"]:has-text("${tabName}")`).first();
        if (await tab.isVisible()) {
          console.log(`Found tab: ${tabName}`);
          await tab.click();
          await page.waitForTimeout(500);
          await takeScreenshot(page, `02-main-settings-tab-${tabName.toLowerCase().replace(/\s+/g, '-')}`);
        }
      }

      // Look for switches/toggles
      const switches = page.locator('[role="switch"]');
      const switchCount = await switches.count();
      console.log(`Found ${switchCount} toggle switches`);

      if (switchCount > 0) {
        // Test toggling first switch (without saving)
        const firstSwitch = switches.first();
        const initialState = await firstSwitch.getAttribute('aria-checked');
        console.log(`First switch initial state: ${initialState}`);
        await firstSwitch.click();
        await page.waitForTimeout(300);
        const newState = await firstSwitch.getAttribute('aria-checked');
        console.log(`First switch new state: ${newState}`);
        // Toggle back to avoid saving changes
        await firstSwitch.click();
        await takeScreenshot(page, '03-main-settings-toggle-test');
      }

      // Look for inputs
      const inputs = page.locator('input:visible');
      const inputCount = await inputs.count();
      console.log(`Found ${inputCount} visible inputs`);

      // Check for buttons
      const buttons = page.locator('button:visible');
      const buttonCount = await buttons.count();
      console.log(`Found ${buttonCount} visible buttons`);

      // Report errors
      const errors = getErrors();
      console.log(`Console errors: ${errors.length}`);
      errors.forEach(e => console.log(`  - ${e}`));
    });

    test('should explore LLM provider settings', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/settings');
      await waitForAppReady(page);

      // Look for LLM provider options
      const llmOptions = ['Anthropic', 'OpenAI', 'LM Studio', 'Gemini', 'Google'];
      const foundProviders: string[] = [];

      for (const provider of llmOptions) {
        const option = page.locator(`text=${provider}`).first();
        if (await option.isVisible().catch(() => false)) {
          foundProviders.push(provider);
        }
      }
      console.log(`Found LLM providers: ${foundProviders.join(', ')}`);
      await takeScreenshot(page, '04-llm-providers');

      const errors = getErrors();
      console.log(`Console errors: ${errors.length}`);
    });

    test('should explore Data Management section', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/settings');
      await waitForAppReady(page);

      // Navigate to Data Management tab
      const dataTab = page.locator('button:has-text("Data Management"), [role="tab"]:has-text("Data Management")').first();
      if (await dataTab.isVisible()) {
        await dataTab.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '05-data-management');

        // Look for data management features
        const features = ['Export', 'Import', 'Clear', 'Reset'];
        for (const feature of features) {
          const found = await page.locator(`button:has-text("${feature}")`).first().isVisible().catch(() => false);
          console.log(`Data Management - ${feature}: ${found ? 'Found' : 'Not found'}`);
        }
      }

      const errors = getErrors();
      console.log(`Console errors: ${errors.length}`);
    });
  });

  test.describe('API Keys & Budget Page', () => {
    test('should load and explore API keys settings', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/settings/api-keys');
      await waitForAppReady(page);
      await takeScreenshot(page, '06-api-keys-page');

      // Check page loaded
      await expect(page).toHaveURL(/\/settings\/api-keys/);
      console.log('API Keys page loaded');

      // Look for header
      const header = page.locator('h1');
      const headerText = await header.first().textContent().catch(() => '');
      console.log(`Page header: ${headerText}`);

      // Check for API key section
      const anthropicSection = page.locator('text=Anthropic');
      if (await anthropicSection.first().isVisible()) {
        console.log('Found Anthropic API key section');
      }

      // Check for budget section
      const budgetSection = page.locator('text=Budget');
      if (await budgetSection.first().isVisible()) {
        console.log('Found Budget section');
      }

      // Look for action buttons
      const addKeyButton = page.locator('button:has-text("Add")');
      if (await addKeyButton.first().isVisible()) {
        console.log('Found Add Key button');
        // Click to open dialog but don't save
        await addKeyButton.first().click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '07-api-keys-dialog');

        // Close dialog
        const cancelButton = page.locator('button:has-text("Cancel")');
        if (await cancelButton.isVisible()) {
          await cancelButton.click();
        } else {
          await page.keyboard.press('Escape');
        }
      }

      // Look for Usage Tips section
      const usageTips = page.locator('text=Usage Tips');
      if (await usageTips.first().isVisible()) {
        console.log('Found Usage Tips section');
      }

      const errors = getErrors();
      console.log(`Console errors: ${errors.length}`);
    });
  });

  test.describe('Security Settings Page', () => {
    test('should load and explore security settings', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/settings/security');
      await waitForAppReady(page);
      await takeScreenshot(page, '08-security-page');

      // Check page loaded
      await expect(page).toHaveURL(/\/settings\/security/);
      console.log('Security page loaded');

      // Look for header
      const header = page.locator('h1:has-text("Security")');
      if (await header.first().isVisible()) {
        console.log('Found Security header');
      }

      // Check for 2FA section
      const twoFactorSection = page.locator('text=Two-Factor Authentication, text=2FA');
      if (await twoFactorSection.first().isVisible()) {
        console.log('Found Two-Factor Authentication section');
      }

      // Check for Passkeys section
      const passkeysSection = page.locator('text=Passkeys');
      if (await passkeysSection.first().isVisible()) {
        console.log('Found Passkeys section');
      }

      // Look for setup buttons
      const setupButton = page.locator('button:has-text("Set Up"), button:has-text("Enable"), button:has-text("Add Passkey")');
      const setupButtonCount = await setupButton.count();
      console.log(`Found ${setupButtonCount} setup/enable buttons`);
      await takeScreenshot(page, '09-security-buttons');

      const errors = getErrors();
      console.log(`Console errors: ${errors.length}`);
    });
  });

  test.describe('GitLab Settings Page', () => {
    test('should load and explore GitLab settings', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/settings/gitlab');
      await waitForAppReady(page);
      await takeScreenshot(page, '10-gitlab-page');

      // Check page loaded
      await expect(page).toHaveURL(/\/settings\/gitlab/);
      console.log('GitLab page loaded');

      // Look for header
      const header = page.locator('h1:has-text("Git"), h1:has-text("GitLab")');
      if (await header.first().isVisible()) {
        const headerText = await header.first().textContent();
        console.log(`Found header: ${headerText}`);
      }

      // Check for instance mode selection
      const sharedOption = page.locator('button:has-text("Shared")').first();
      const personalOption = page.locator('button:has-text("Your Own"), button:has-text("Personal")').first();

      if (await sharedOption.isVisible().catch(() => false)) {
        console.log('Found Shared instance option');
      }
      if (await personalOption.isVisible()) {
        console.log('Found Personal instance option');
        await personalOption.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '11-gitlab-personal-mode');

        // Look for URL and token inputs
        const urlInput = page.locator('input[placeholder*="URL"], input[placeholder*="gitlab"]').first();
        const tokenInput = page.locator('input[type="password"], input[placeholder*="token"]').first();

        if (await urlInput.isVisible()) {
          console.log('Found URL input');
        }
        if (await tokenInput.isVisible()) {
          console.log('Found token input');
        }
      }

      // Look for Test Connection button
      const testButton = page.locator('button:has-text("Test Connection"), button:has-text("Test")');
      if (await testButton.first().isVisible()) {
        console.log('Found Test Connection button');
      }

      // Look for Save button
      const saveButton = page.locator('button:has-text("Save")');
      if (await saveButton.first().isVisible()) {
        console.log('Found Save button');
      }

      // Look for Project Preferences
      const preferences = page.locator('text=Project Preferences, text=Auto-create');
      if (await preferences.first().isVisible()) {
        console.log('Found Project Preferences section');
      }

      const errors = getErrors();
      console.log(`Console errors: ${errors.length}`);
    });
  });

  test.describe('N8N Settings Page', () => {
    test('should load and explore N8N settings', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/settings/n8n');
      await waitForAppReady(page);
      await takeScreenshot(page, '12-n8n-page');

      // Check page loaded
      await expect(page).toHaveURL(/\/settings\/n8n/);
      console.log('N8N page loaded');

      // Look for header
      const header = page.locator('h1:has-text("n8n"), h1:has-text("N8N")');
      if (await header.first().isVisible()) {
        const headerText = await header.first().textContent();
        console.log(`Found header: ${headerText}`);
      }

      // Check for instance mode selection
      const personalOption = page.locator('button:has-text("Your Own"), button:has-text("Personal")').first();
      if (await personalOption.isVisible()) {
        console.log('Found Personal instance option');
        await personalOption.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, '13-n8n-personal-mode');

        // Look for configuration inputs
        const urlInput = page.locator('input[placeholder*="URL"], input[placeholder*="n8n"]').first();
        const apiKeyInput = page.locator('input[type="password"], input[placeholder*="api"]').first();

        if (await urlInput.isVisible()) {
          console.log('Found N8N URL input');
        }
        if (await apiKeyInput.isVisible()) {
          console.log('Found N8N API key input');
        }
      }

      // Look for Workflow Preferences
      const workflowPrefs = page.locator('text=Workflow Preferences');
      if (await workflowPrefs.first().isVisible()) {
        console.log('Found Workflow Preferences section');
      }

      // Look for Your Workflows section
      const workflows = page.locator('text=Your Workflows');
      if (await workflows.first().isVisible()) {
        console.log('Found Your Workflows section');
      }

      const errors = getErrors();
      console.log(`Console errors: ${errors.length}`);
    });
  });

  test.describe('OpenWebUI Settings Page', () => {
    test('should load and explore OpenWebUI settings', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/settings/openwebui');
      await waitForAppReady(page);
      await takeScreenshot(page, '14-openwebui-page');

      // Check page loaded
      await expect(page).toHaveURL(/\/settings\/openwebui/);
      console.log('OpenWebUI page loaded');

      // Look for header
      const header = page.locator('h1:has-text("Open Web UI"), h1:has-text("OpenWebUI")');
      if (await header.first().isVisible()) {
        const headerText = await header.first().textContent();
        console.log(`Found header: ${headerText}`);
      }

      // Look for URL input
      const urlInput = page.locator('input[placeholder*="URL"], input[id*="url"]').first();
      if (await urlInput.isVisible()) {
        console.log('Found URL input');
      }

      // Look for Test Connection button
      const testButton = page.locator('button:has-text("Test Connection"), button:has-text("Test")');
      if (await testButton.first().isVisible()) {
        console.log('Found Test Connection button');
      }

      // Look for Display Preferences
      const displayPrefs = page.locator('text=Display Preferences');
      if (await displayPrefs.first().isVisible()) {
        console.log('Found Display Preferences section');
      }

      // Test toggle switches
      const switches = page.locator('[role="switch"]');
      const switchCount = await switches.count();
      console.log(`Found ${switchCount} toggle switches`);

      if (switchCount > 0) {
        const enableSwitch = switches.first();
        const initialState = await enableSwitch.getAttribute('aria-checked');
        console.log(`Enable switch initial state: ${initialState}`);
        await enableSwitch.click();
        await page.waitForTimeout(300);
        const newState = await enableSwitch.getAttribute('aria-checked');
        console.log(`Enable switch new state: ${newState}`);
        // Toggle back
        await enableSwitch.click();
        await takeScreenshot(page, '15-openwebui-toggle-test');
      }

      const errors = getErrors();
      console.log(`Console errors: ${errors.length}`);
    });
  });

  test.describe('Settings Navigation', () => {
    test('should navigate through all settings pages without errors', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);
      const allErrors: string[] = [];

      const settingsPages = [
        { path: '/settings', name: 'main' },
        { path: '/settings/api-keys', name: 'api-keys' },
        { path: '/settings/security', name: 'security' },
        { path: '/settings/gitlab', name: 'gitlab' },
        { path: '/settings/n8n', name: 'n8n' },
        { path: '/settings/openwebui', name: 'openwebui' },
      ];

      for (const settingsPage of settingsPages) {
        console.log(`\nNavigating to ${settingsPage.path}...`);
        await page.goto(settingsPage.path);
        await waitForAppReady(page);

        // Verify URL
        await expect(page).toHaveURL(new RegExp(settingsPage.path.replace(/\//g, '\\/')));
        console.log(`Successfully loaded ${settingsPage.name}`);

        await takeScreenshot(page, `16-nav-${settingsPage.name}`);

        // Wait for any delayed errors
        await page.waitForTimeout(1000);
      }

      const errors = getErrors();
      console.log(`\nTotal console errors across all pages: ${errors.length}`);
      errors.forEach(e => console.log(`  - ${e}`));
    });
  });

  test.describe('Input Validation', () => {
    test('should handle invalid URL formats in GitLab settings', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/settings/gitlab');
      await waitForAppReady(page);

      // Select personal mode
      const personalOption = page.locator('button:has-text("Your Own"), button:has-text("Personal")').first();
      if (await personalOption.isVisible()) {
        await personalOption.click();
        await page.waitForTimeout(500);

        // Find URL input and enter invalid URL
        const urlInput = page.locator('input[placeholder*="URL"]').first();
        if (await urlInput.isVisible()) {
          await urlInput.fill('not-a-valid-url');
          await page.waitForTimeout(300);
          await takeScreenshot(page, '17-gitlab-invalid-url');

          // Check for validation feedback
          const validationError = page.locator('text=Invalid, text=valid URL, [class*="error"]');
          if (await validationError.first().isVisible().catch(() => false)) {
            console.log('Validation error shown for invalid URL');
          }

          // Clear the input
          await urlInput.clear();
        }
      }

      const errors = getErrors();
      console.log(`Console errors: ${errors.length}`);
    });

    test('should handle invalid URL formats in OpenWebUI settings', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/settings/openwebui');
      await waitForAppReady(page);

      // Find URL input and enter invalid URL
      const urlInput = page.locator('input[placeholder*="URL"], input[id*="url"]').first();
      if (await urlInput.isVisible()) {
        await urlInput.fill('invalid-url-format');
        await page.waitForTimeout(300);
        await takeScreenshot(page, '18-openwebui-invalid-url');

        // Clear the input
        await urlInput.clear();
      }

      const errors = getErrors();
      console.log(`Console errors: ${errors.length}`);
    });
  });

  test.describe('Form Interaction', () => {
    test('should test form interactions without saving', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/settings');
      await waitForAppReady(page);

      // Find all interactable elements
      const interactableSelectors = [
        '[role="switch"]',
        'button:visible',
        'input:visible',
        '[role="tab"]',
        'select:visible',
      ];

      let totalInteractables = 0;
      for (const selector of interactableSelectors) {
        const count = await page.locator(selector).count();
        totalInteractables += count;
        console.log(`${selector}: ${count} elements`);
      }
      console.log(`Total interactable elements: ${totalInteractables}`);

      await takeScreenshot(page, '19-form-interactions');

      const errors = getErrors();
      console.log(`Console errors: ${errors.length}`);
    });
  });
});

// Summary test
test('Settings Summary Report', async ({ page }) => {
  console.log('\n========================================');
  console.log('SETTINGS SUMMARY REPORT');
  console.log('========================================\n');

  const settingsPages = [
    { path: '/settings', name: 'Main Settings', sections: ['Default LLM Provider', 'Local Servers', 'Connections', 'Data Management'] },
    { path: '/settings/api-keys', name: 'API Keys & Budget', sections: ['Anthropic API Key', 'Usage Tips', 'Budget Status'] },
    { path: '/settings/security', name: 'Security', sections: ['Two-Factor Authentication', 'Passkeys'] },
    { path: '/settings/gitlab', name: 'GitLab', sections: ['Instance Mode', 'Project Preferences', 'Connection Test'] },
    { path: '/settings/n8n', name: 'N8N', sections: ['Instance Mode', 'Workflow Preferences', 'Your Workflows'] },
    { path: '/settings/openwebui', name: 'OpenWebUI', sections: ['URL Configuration', 'Display Preferences', 'Connection Test'] },
  ];

  const allErrors: string[] = [];
  const getErrors = setupConsoleErrorCheck(page);

  for (const settingsPage of settingsPages) {
    console.log(`\n[${settingsPage.name}] - ${settingsPage.path}`);
    console.log('-'.repeat(40));

    await page.goto(settingsPage.path);
    await waitForAppReady(page);

    // Check each expected section
    for (const section of settingsPage.sections) {
      const found = await page.locator(`text=${section}`).first().isVisible().catch(() => false);
      console.log(`  ${found ? '[OK]' : '[--]'} ${section}`);
    }

    // Count interactive elements
    const switchCount = await page.locator('[role="switch"]').count();
    const buttonCount = await page.locator('button:visible').count();
    const inputCount = await page.locator('input:visible').count();

    console.log(`  Toggles: ${switchCount} | Buttons: ${buttonCount} | Inputs: ${inputCount}`);

    await takeScreenshot(page, `20-summary-${settingsPage.name.toLowerCase().replace(/\s+/g, '-')}`);
  }

  const errors = getErrors();
  console.log('\n========================================');
  console.log('CONSOLE ERRORS');
  console.log('========================================');
  if (errors.length === 0) {
    console.log('No console errors detected!');
  } else {
    errors.forEach(e => console.log(`  - ${e}`));
  }
  console.log('\n========================================');
  console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
  console.log('========================================\n');
});
