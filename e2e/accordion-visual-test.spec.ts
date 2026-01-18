import { test, expect } from '@playwright/test';

test.describe('Accordion Project Page Visual Tests', () => {
  const screenshotDir = '/home/bill/projects/claudia-admin/test-screenshots';

  test('capture accordion screenshots', async ({ page }) => {
    // Go to dashboard first to find projects
    await page.goto('https://localhost:3000/dashboard', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Extract all hrefs from page to find project URLs
    const allHrefs = await page.evaluate(() => {
      const anchors = document.querySelectorAll('a[href]');
      return Array.from(anchors).map(a => a.getAttribute('href')).filter(h => h && h.includes('/projects/'));
    });

    console.log('Found hrefs:', allHrefs);

    // Find a project link with a UUID (not /projects/new)
    let projectUrl = allHrefs.find(href =>
      href &&
      href.includes('/projects/') &&
      !href.endsWith('/projects') &&
      !href.includes('/projects/new') &&
      !href.includes('/projects/trash') &&
      href.match(/[a-f0-9-]{8,}/)
    );

    if (!projectUrl) {
      // Try projects list page
      await page.goto('https://localhost:3000/projects', { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      const projectsPageHrefs = await page.evaluate(() => {
        const anchors = document.querySelectorAll('a[href]');
        return Array.from(anchors).map(a => a.getAttribute('href')).filter(h => h && h.includes('/projects/'));
      });

      console.log('Projects page hrefs:', projectsPageHrefs);

      projectUrl = projectsPageHrefs.find(href =>
        href &&
        href.includes('/projects/') &&
        !href.endsWith('/projects') &&
        !href.includes('/projects/new') &&
        !href.includes('/projects/trash') &&
        href.match(/[a-f0-9-]{8,}/)
      );
    }

    if (!projectUrl) {
      throw new Error('No existing project found');
    }

    // Navigate to the project
    const fullUrl = projectUrl.startsWith('http') ? projectUrl : `https://localhost:3000${projectUrl}`;
    console.log(`Navigating to project: ${fullUrl}`);
    await page.goto(fullUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Screenshot 1: Initial view with Overview expanded
    await page.screenshot({
      path: `${screenshotDir}/accordion-reordered-initial.png`,
      fullPage: false
    });
    console.log('Screenshot 1: accordion-reordered-initial.png captured');

    // Scroll down to see all accordion sections
    await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'auto' }));
    await page.waitForTimeout(500);

    // Take a full page screenshot to see all sections
    await page.screenshot({
      path: `${screenshotDir}/accordion-full-page.png`,
      fullPage: true
    });
    console.log('Screenshot: accordion-full-page.png captured (full page)');

    // Find all accordion trigger buttons by looking for elements with expandable behavior
    const allButtons = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button');
      return Array.from(buttons).map(b => ({
        text: b.textContent?.trim().substring(0, 50),
        hasDataState: b.hasAttribute('data-state'),
        dataState: b.getAttribute('data-state'),
        ariaExpanded: b.getAttribute('aria-expanded')
      })).filter(b => b.hasDataState || b.ariaExpanded !== null);
    });
    console.log('Accordion-like buttons found:', JSON.stringify(allButtons, null, 2));

    // Scroll back to top
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
    await page.waitForTimeout(300);

    // Try to find and click specific accordion sections
    // Look for text containing these keywords in buttons
    const sectionsToCapture = [
      { name: 'AI Models', screenshot: 'accordion-ai-models.png' },
      { name: 'Build Plan', screenshot: 'accordion-build-plan.png' },
      { name: 'Business', screenshot: 'accordion-business-dev.png' },
    ];

    for (const section of sectionsToCapture) {
      // Try multiple selector strategies
      const selectors = [
        `button:has-text("${section.name}")`,
        `[data-state]:has-text("${section.name}")`,
        `div:has-text("${section.name}") button[data-state]`,
      ];

      let clicked = false;
      for (const selector of selectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.isVisible({ timeout: 500 })) {
            // Scroll button into view
            await button.scrollIntoViewIfNeeded();
            await page.waitForTimeout(200);
            await button.click();
            await page.waitForTimeout(500);
            clicked = true;
            console.log(`Clicked ${section.name} using selector: ${selector}`);
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      if (clicked) {
        await page.screenshot({
          path: `${screenshotDir}/${section.screenshot}`,
          fullPage: false
        });
        console.log(`Screenshot: ${section.screenshot} captured`);
      } else {
        console.log(`${section.name} section not found or not clickable`);
      }
    }

    // Test scrolling behavior - rapid scroll up and down
    console.log('Testing scroll behavior...');

    // Scroll down quickly multiple times
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'auto' }));
      await page.waitForTimeout(50);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
      await page.waitForTimeout(50);
    }

    // Rapid small scrolls
    for (let i = 0; i < 10; i++) {
      await page.evaluate((offset) => window.scrollBy(0, offset), (i % 2 === 0 ? 200 : -200));
      await page.waitForTimeout(30);
    }

    // Final scroll to middle and take screenshot
    await page.evaluate(() => window.scrollTo({ top: 300, behavior: 'auto' }));
    await page.waitForTimeout(300);

    // Take screenshot after scroll test
    await page.screenshot({
      path: `${screenshotDir}/accordion-scroll-test.png`,
      fullPage: false
    });
    console.log('Screenshot: accordion-scroll-test.png captured');

    console.log('All screenshots captured successfully!');
  });
});
