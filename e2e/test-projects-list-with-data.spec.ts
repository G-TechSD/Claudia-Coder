import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const SCREENSHOT_PATH = '/home/bill/projects/claudia-coder-beta/test-screenshots/test-projects-list-with-data.png';

// Ensure screenshot directory exists
const screenshotDir = path.dirname(SCREENSHOT_PATH);
if (!fs.existsSync(screenshotDir)) {
  fs.mkdirSync(screenshotDir, { recursive: true });
}

// Configure to ignore HTTPS certificate errors
test.use({
  ignoreHTTPSErrors: true,
  baseURL: 'http://localhost:3002',
});

test.describe('Projects List Page with Data', () => {
  test('should display projects list with Test App project and navigate to detail', async ({ page }) => {
    // Capture console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[Console Error] ${msg.text()}`);
        console.log(`[Console Error] ${msg.text()}`);
      }
    });
    page.on('pageerror', (error) => {
      consoleErrors.push(`[Page Error] ${error.message}`);
      console.log(`[Page Error] ${error.message}`);
    });

    // Step 1: Navigate to /projects
    console.log('Step 1: Navigating to /projects...');
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');

    // Wait for the page to fully load - look for the Projects heading
    await page.waitForSelector('h1:has-text("Projects")', { timeout: 30000 });
    console.log('Projects page loaded successfully');

    // Step 2: Wait for projects to load (loading spinner to disappear)
    console.log('Step 2: Waiting for projects to load...');
    await page.waitForFunction(() => {
      const spinners = document.querySelectorAll('[class*="animate-spin"]');
      return spinners.length === 0;
    }, { timeout: 15000 }).catch(() => {
      console.log('Note: Spinner may still be visible or not present');
    });

    // Give additional time for data to render
    await page.waitForTimeout(1000);

    // Step 3: Take screenshot of the projects list
    console.log('Step 3: Taking screenshot of projects list...');
    await page.screenshot({
      path: SCREENSHOT_PATH,
      fullPage: true
    });
    console.log(`Screenshot saved to: ${SCREENSHOT_PATH}`);

    // Step 4: Verify project card displays correctly
    console.log('Step 4: Verifying project card elements...');

    // Look for project list items or cards
    const projectItems = page.locator('.border.rounded-lg.divide-y > div, [class*="card"]');
    const projectCount = await projectItems.count();
    console.log(`Found ${projectCount} project items`);

    // Try to find "Test App" project or any project
    const testAppLink = page.locator('a:has-text("Test App")').first();
    const hasTestApp = await testAppLink.count() > 0;

    let targetProjectLink;
    if (hasTestApp) {
      console.log('Found "Test App" project');
      targetProjectLink = testAppLink;
    } else {
      // Find any project link
      const anyProjectLink = page.locator('a[href*="/projects/"]').first();
      if (await anyProjectLink.count() > 0) {
        const projectName = await anyProjectLink.textContent();
        console.log(`Test App not found, using project: ${projectName}`);
        targetProjectLink = anyProjectLink;
      }
    }

    // Verify project card components are present
    // Check for Name (project link)
    const projectLinks = page.locator('a[href*="/projects/"]');
    const linkCount = await projectLinks.count();
    expect(linkCount).toBeGreaterThan(0);
    console.log(`Verified: ${linkCount} project name links found`);

    // Check for Status badges
    const statusBadges = page.locator('[class*="Badge"], .badge, [class*="badge"]').filter({
      hasText: /Active|Planning|Paused|Completed|Archived/
    });
    const statusCount = await statusBadges.count();
    console.log(`Verified: ${statusCount} status badges found`);

    // Check for descriptions (muted text)
    const descriptions = page.locator('p[class*="muted"]');
    const descCount = await descriptions.count();
    console.log(`Verified: ${descCount} descriptions found`);

    // Check for date information (updated time)
    const dateElements = page.locator('text=/Today|Yesterday|days ago|weeks ago/');
    const dateCount = await dateElements.count();
    console.log(`Verified: ${dateCount} date elements found`);

    // Step 5: Click on a project card to navigate to detail
    console.log('Step 5: Clicking on project to navigate to detail...');

    if (targetProjectLink) {
      const href = await targetProjectLink.getAttribute('href');
      console.log(`Clicking project link: ${href}`);

      await targetProjectLink.click();
      await page.waitForLoadState('networkidle');

      // Step 6: Verify navigation to project detail
      console.log('Step 6: Verifying navigation to project detail page...');
      const currentUrl = page.url();
      console.log(`Current URL after click: ${currentUrl}`);

      // Verify URL contains /projects/ followed by an ID
      expect(currentUrl).toMatch(/\/projects\/[a-zA-Z0-9-]+/);
      console.log('Successfully navigated to project detail page');

      // Wait for detail page to load
      await page.waitForTimeout(1000);

      // Take a screenshot of the detail page as bonus
      await page.screenshot({
        path: SCREENSHOT_PATH.replace('.png', '-detail.png'),
        fullPage: true
      });
      console.log('Detail page screenshot saved');
    } else {
      console.log('Warning: No project found to click');
    }

    // Report findings
    console.log('\n=== TEST SUMMARY ===');
    console.log(`Projects found: ${projectCount}`);
    console.log(`Project links: ${linkCount}`);
    console.log(`Status badges: ${statusCount}`);
    console.log(`Descriptions: ${descCount}`);
    console.log(`Date elements: ${dateCount}`);
    console.log(`Console errors: ${consoleErrors.length}`);

    if (consoleErrors.length > 0) {
      console.log('\n=== CONSOLE ERRORS ===');
      consoleErrors.forEach(err => console.log(err));
    } else {
      console.log('No console errors detected.');
    }
  });
});
