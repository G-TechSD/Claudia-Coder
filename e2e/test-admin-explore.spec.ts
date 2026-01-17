import { test, expect, Page } from '@playwright/test';

// Configuration
const BASE_URL = 'https://localhost:3000';
const SCREENSHOT_DIR = '/tmp/claudia-test-screenshots';

// Known admin routes discovered from the codebase
const ADMIN_ROUTES = [
  '/admin',
  '/admin/users',
  '/admin/sessions',
  '/admin/invites',
  '/admin/referrals',
  '/admin/security',
  '/admin/security/logs',
  '/admin/migration',
];

// Collect console errors
const consoleErrors: { page: string; message: string; type: string }[] = [];
const pagesVisited: string[] = [];
const navigationLinks: string[] = [];

test.describe('Claudia Admin Section Tests', () => {
  test.use({
    ignoreHTTPSErrors: true,
    viewport: { width: 1920, height: 1080 },
  });

  test('Explore all admin pages and capture screenshots', async ({ page }) => {
    // Setup console error listener
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          page: page.url(),
          message: msg.text(),
          type: msg.type(),
        });
        console.log(`[CONSOLE ERROR] ${page.url()}: ${msg.text()}`);
      }
    });

    // Setup page error listener
    page.on('pageerror', (error) => {
      consoleErrors.push({
        page: page.url(),
        message: error.message,
        type: 'pageerror',
      });
      console.log(`[PAGE ERROR] ${page.url()}: ${error.message}`);
    });

    // Visit each known admin route
    for (const route of ADMIN_ROUTES) {
      const fullUrl = `${BASE_URL}${route}`;
      console.log(`\n=== Visiting: ${fullUrl} ===`);

      try {
        const response = await page.goto(fullUrl, {
          waitUntil: 'networkidle',
          timeout: 30000
        });

        const status = response?.status() || 'unknown';
        console.log(`Status: ${status}`);

        // Wait for any dynamic content
        await page.waitForTimeout(1000);

        // Get page title
        const title = await page.title();
        console.log(`Title: ${title}`);

        pagesVisited.push(`${route} (status: ${status}, title: ${title})`);

        // Take screenshot
        const screenshotName = route.replace(/\//g, '_').replace(/^_/, '') || 'admin_root';
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/${screenshotName}.png`,
          fullPage: true
        });
        console.log(`Screenshot saved: ${screenshotName}.png`);

        // Explore navigation and tabs on the page
        await exploreNavigation(page, route);

      } catch (error) {
        console.log(`Error visiting ${route}: ${error}`);
        pagesVisited.push(`${route} (ERROR: ${error})`);
      }
    }

    // Discover additional links from navigation
    console.log('\n=== Exploring discovered navigation links ===');
    const uniqueLinks = [...new Set(navigationLinks)].filter(
      link => !ADMIN_ROUTES.includes(link) && link.startsWith('/admin')
    );

    for (const link of uniqueLinks.slice(0, 10)) {
      const fullUrl = `${BASE_URL}${link}`;
      console.log(`\nVisiting discovered link: ${fullUrl}`);

      try {
        const response = await page.goto(fullUrl, {
          waitUntil: 'networkidle',
          timeout: 30000
        });

        const status = response?.status() || 'unknown';
        const title = await page.title();
        pagesVisited.push(`${link} (discovered, status: ${status}, title: ${title})`);

        const screenshotName = link.replace(/\//g, '_').replace(/^_/, '');
        await page.screenshot({
          path: `${SCREENSHOT_DIR}/${screenshotName}_discovered.png`,
          fullPage: true
        });

      } catch (error) {
        console.log(`Error visiting discovered link ${link}: ${error}`);
      }
    }

    // Print summary
    console.log('\n========================================');
    console.log('SUMMARY');
    console.log('========================================');
    console.log('\nPages Visited:');
    pagesVisited.forEach(p => console.log(`  - ${p}`));

    console.log('\nNavigation Links Found:');
    [...new Set(navigationLinks)].forEach(l => console.log(`  - ${l}`));

    console.log('\nConsole Errors:');
    if (consoleErrors.length === 0) {
      console.log('  No console errors detected');
    } else {
      consoleErrors.forEach(e => console.log(`  - [${e.type}] ${e.page}: ${e.message}`));
    }

    console.log('\nScreenshots saved to:', SCREENSHOT_DIR);
  });
});

async function exploreNavigation(page: Page, currentRoute: string) {
  try {
    // Find all navigation links
    const links = await page.$$eval('a[href]', (anchors) =>
      anchors
        .map(a => a.getAttribute('href'))
        .filter(href => href && href.startsWith('/admin'))
    );

    links.forEach(link => {
      if (link) navigationLinks.push(link);
    });
    console.log(`Found ${links.length} admin links on ${currentRoute}`);

    // Look for tabs (common patterns)
    const tabSelectors = [
      '[role="tab"]',
      '.tab',
      '[data-tab]',
      'button[role="tab"]',
      '.tabs button',
      '[class*="tab"]',
    ];

    for (const selector of tabSelectors) {
      try {
        const tabs = await page.$$(selector);
        if (tabs.length > 0) {
          console.log(`Found ${tabs.length} tabs with selector: ${selector}`);

          // Click each tab and take screenshot
          for (let i = 0; i < Math.min(tabs.length, 5); i++) {
            try {
              const tabText = await tabs[i].textContent();
              console.log(`  Clicking tab: ${tabText}`);
              await tabs[i].click();
              await page.waitForTimeout(500);

              const tabScreenshotName = `${currentRoute.replace(/\//g, '_').replace(/^_/, '')}_tab_${i}`;
              await page.screenshot({
                path: `${SCREENSHOT_DIR}/${tabScreenshotName}.png`,
                fullPage: true
              });
            } catch (e) {
              // Tab might not be clickable
            }
          }
        }
      } catch (e) {
        // Selector not found, continue
      }
    }

    // Look for sidebar navigation
    const sidebarSelectors = [
      'nav a',
      '[class*="sidebar"] a',
      '[class*="nav"] a',
      'aside a',
    ];

    for (const selector of sidebarSelectors) {
      try {
        const sidebarLinks = await page.$$eval(selector, (anchors) =>
          anchors
            .map(a => ({ href: a.getAttribute('href'), text: a.textContent?.trim() }))
            .filter(item => item.href && item.href.startsWith('/admin'))
        );

        if (sidebarLinks.length > 0) {
          console.log(`Found ${sidebarLinks.length} sidebar links with selector: ${selector}`);
          sidebarLinks.forEach(link => {
            if (link.href) navigationLinks.push(link.href);
            console.log(`    - ${link.text}: ${link.href}`);
          });
        }
      } catch (e) {
        // Selector not found, continue
      }
    }

  } catch (error) {
    console.log(`Error exploring navigation on ${currentRoute}: ${error}`);
  }
}
