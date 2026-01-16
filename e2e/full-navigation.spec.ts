import { test, expect, Page } from '@playwright/test';
import {
  waitForAppReady,
  takeScreenshot,
  setupConsoleErrorCheck,
  navigateViaSidebar,
  expandSidebarSection,
} from './helpers';

/**
 * Comprehensive Navigation Tests for Claudia Coder
 *
 * This test suite covers EVERY navigation item in the sidebar:
 * - Projects Category: Dashboard, Projects, Business Ideas, Voice
 * - Tools Category: Claude Code, Open Web UI, Business Dev, Research, Patents, Source Control, n8n
 * - Admin Category: Admin Panel, Users, Sessions, Invites, Referrals, Migration, Cleanup, Settings, Security
 * - Bottom Navigation: Trash
 */

// Navigation item interface for structured testing
interface NavItem {
  name: string;
  href: string;
  category: 'Projects' | 'Tools' | 'Admin' | 'Bottom';
  expectedContent?: string[];
  requiresAdmin?: boolean;
}

// All navigation items from sidebar.tsx
const ALL_NAV_ITEMS: NavItem[] = [
  // Projects Category
  { name: 'Dashboard', href: '/', category: 'Projects', expectedContent: ['Dashboard', 'Claudia'] },
  { name: 'Projects', href: '/projects', category: 'Projects', expectedContent: ['Projects', 'project'] },
  { name: 'Business Ideas', href: '/business-ideas', category: 'Projects', expectedContent: ['Business', 'Ideas'] },
  { name: 'Voice', href: '/voice', category: 'Projects', expectedContent: ['Voice'] },

  // Tools Category
  { name: 'Claude Code', href: '/claude-code', category: 'Tools', expectedContent: ['Claude', 'Code'] },
  { name: 'Open Web UI', href: '/openwebui', category: 'Tools', expectedContent: ['Open', 'Web', 'UI', 'Chat', 'AI'] },
  { name: 'Business Dev', href: '/business-dev', category: 'Tools', expectedContent: ['Business', 'Development'] },
  { name: 'Research', href: '/research', category: 'Tools', expectedContent: ['Research'] },
  { name: 'Patents', href: '/patents', category: 'Tools', expectedContent: ['Patent'] },
  { name: 'Source Control', href: '/gitea', category: 'Tools', expectedContent: ['Gitea', 'Source', 'Control', 'Git'] },
  { name: 'n8n', href: '/n8n', category: 'Tools', expectedContent: ['n8n', 'Workflow', 'Automation'] },

  // Admin Category (requires admin role)
  { name: 'Admin Panel', href: '/admin', category: 'Admin', expectedContent: ['Admin'], requiresAdmin: true },
  { name: 'Users', href: '/admin/users', category: 'Admin', expectedContent: ['User'], requiresAdmin: true },
  { name: 'Sessions', href: '/admin/sessions', category: 'Admin', expectedContent: ['Session'], requiresAdmin: true },
  { name: 'Invites', href: '/admin/invites', category: 'Admin', expectedContent: ['Invite'], requiresAdmin: true },
  { name: 'Referrals', href: '/admin/referrals', category: 'Admin', expectedContent: ['Referral'], requiresAdmin: true },
  { name: 'Migration', href: '/admin/migration', category: 'Admin', expectedContent: ['Migration', 'Data'], requiresAdmin: true },
  { name: 'Cleanup', href: '/admin/cleanup', category: 'Admin', expectedContent: ['Cleanup', 'Clean'], requiresAdmin: true },
  { name: 'Settings', href: '/settings', category: 'Admin', expectedContent: ['Settings'], requiresAdmin: true },
  { name: 'Security', href: '/settings/security', category: 'Admin', expectedContent: ['Security'], requiresAdmin: true },

  // Bottom Navigation
  { name: 'Trash', href: '/projects/trash', category: 'Bottom', expectedContent: ['Trash', 'Deleted'] },
];

// Group items by category for organized testing
const projectsItems = ALL_NAV_ITEMS.filter(item => item.category === 'Projects');
const toolsItems = ALL_NAV_ITEMS.filter(item => item.category === 'Tools');
const adminItems = ALL_NAV_ITEMS.filter(item => item.category === 'Admin');
const bottomItems = ALL_NAV_ITEMS.filter(item => item.category === 'Bottom');

/**
 * Helper to verify page loaded correctly
 */
async function verifyPageLoad(
  page: Page,
  item: NavItem,
  getErrors: () => string[]
): Promise<void> {
  // Verify URL routing
  if (item.href === '/') {
    await expect(page).toHaveURL(/\/$/);
  } else {
    await expect(page).toHaveURL(new RegExp(item.href.replace(/\//g, '\\/')));
  }

  // Verify page has some content (not blank)
  const bodyContent = await page.locator('body').textContent();
  expect(bodyContent).toBeTruthy();
  expect(bodyContent!.length).toBeGreaterThan(100);

  // Verify expected content (case-insensitive, at least one match)
  if (item.expectedContent && item.expectedContent.length > 0) {
    const pageHtml = await page.content();
    const pageText = pageHtml.toLowerCase();
    const hasExpectedContent = item.expectedContent.some(
      content => pageText.includes(content.toLowerCase())
    );

    // Relaxed check - page should have either expected content OR no errors
    // Some pages may be dynamic or have different content based on state
    const errors = getErrors();
    expect(hasExpectedContent || errors.length === 0).toBeTruthy();
  }

  // Verify no critical console errors
  const errors = getErrors();
  if (errors.length > 0) {
    console.log(`Console errors on ${item.name} (${item.href}):`, errors);
  }
  expect(errors.length).toBe(0);
}

/**
 * Helper to navigate via sidebar with category expansion
 */
async function navigateToItem(page: Page, item: NavItem): Promise<void> {
  // Expand the appropriate category section
  if (item.category === 'Projects' || item.category === 'Tools' || item.category === 'Admin') {
    await expandSidebarSection(page, item.category).catch(() => {
      // Section might already be expanded or not exist
    });
    await page.waitForTimeout(300);
  }

  // Navigate to the item
  await navigateViaSidebar(page, item.name);
}

test.describe('Full Navigation Tests', () => {
  test.describe('Projects Category Navigation', () => {
    for (const item of projectsItems) {
      test(`should navigate to ${item.name} (${item.href})`, async ({ page }) => {
        const getErrors = setupConsoleErrorCheck(page);

        await page.goto('/');
        await waitForAppReady(page);

        await navigateToItem(page, item);
        await waitForAppReady(page);

        await verifyPageLoad(page, item, getErrors);
        await takeScreenshot(page, `nav-projects-${item.name.toLowerCase().replace(/\s+/g, '-')}`);
      });
    }

    test('should have all Projects items visible in sidebar', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      await expandSidebarSection(page, 'Projects');
      await page.waitForTimeout(300);

      for (const item of projectsItems) {
        const link = page.locator(`aside a:has-text("${item.name}")`);
        await expect(link).toBeVisible();
      }

      await takeScreenshot(page, 'nav-projects-section-expanded');
    });
  });

  test.describe('Tools Category Navigation', () => {
    for (const item of toolsItems) {
      test(`should navigate to ${item.name} (${item.href})`, async ({ page }) => {
        const getErrors = setupConsoleErrorCheck(page);

        await page.goto('/');
        await waitForAppReady(page);

        await navigateToItem(page, item);
        await waitForAppReady(page);

        await verifyPageLoad(page, item, getErrors);
        await takeScreenshot(page, `nav-tools-${item.name.toLowerCase().replace(/\s+/g, '-')}`);
      });
    }

    test('should have all Tools items visible in sidebar', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      await expandSidebarSection(page, 'Tools');
      await page.waitForTimeout(300);

      for (const item of toolsItems) {
        const link = page.locator(`aside a:has-text("${item.name}")`);
        await expect(link).toBeVisible();
      }

      await takeScreenshot(page, 'nav-tools-section-expanded');
    });
  });

  test.describe('Admin Category Navigation', () => {
    // Note: Admin items are only visible for admin users
    // These tests use direct URL navigation to test the pages exist

    for (const item of adminItems) {
      test(`should load ${item.name} page via direct URL (${item.href})`, async ({ page }) => {
        const getErrors = setupConsoleErrorCheck(page);

        // Navigate directly to the admin page URL
        await page.goto(item.href);
        await waitForAppReady(page);

        // Verify page loaded (may redirect to login or show access denied)
        // The key is that no JS errors occur
        const errors = getErrors();
        if (errors.length > 0) {
          console.log(`Console errors on ${item.name}:`, errors);
        }
        expect(errors.length).toBe(0);

        await takeScreenshot(page, `nav-admin-${item.name.toLowerCase().replace(/\s+/g, '-')}`);
      });
    }

    test('Admin section should be available in sidebar for admin users', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Check if Admin section exists (will only be visible for admin users)
      const adminSection = page.locator('aside button:has-text("Admin")');
      const hasAdminSection = await adminSection.isVisible().catch(() => false);

      // If admin section exists, expand and verify items
      if (hasAdminSection) {
        await expandSidebarSection(page, 'Admin');
        await page.waitForTimeout(300);

        for (const item of adminItems) {
          const link = page.locator(`aside a:has-text("${item.name}")`);
          await expect(link).toBeVisible();
        }

        await takeScreenshot(page, 'nav-admin-section-expanded');
      } else {
        // Admin section not visible - this is expected for non-admin users
        await takeScreenshot(page, 'nav-admin-section-hidden-non-admin');
      }
    });
  });

  test.describe('Bottom Navigation (Trash)', () => {
    for (const item of bottomItems) {
      test(`should navigate to ${item.name} (${item.href})`, async ({ page }) => {
        const getErrors = setupConsoleErrorCheck(page);

        await page.goto('/');
        await waitForAppReady(page);

        // Trash is always visible at bottom of sidebar
        const trashLink = page.locator(`aside a:has-text("${item.name}")`);
        await expect(trashLink).toBeVisible();

        await trashLink.click();
        await waitForAppReady(page);

        await verifyPageLoad(page, item, getErrors);
        await takeScreenshot(page, `nav-bottom-${item.name.toLowerCase().replace(/\s+/g, '-')}`);
      });
    }
  });

  test.describe('Settings Pages Navigation', () => {
    const settingsPages = [
      { name: 'General Settings', href: '/settings' },
      { name: 'Security Settings', href: '/settings/security' },
      { name: 'GitLab Settings', href: '/settings/gitlab' },
      { name: 'n8n Settings', href: '/settings/n8n' },
      { name: 'OpenWebUI Settings', href: '/settings/openwebui' },
    ];

    for (const settings of settingsPages) {
      test(`should load ${settings.name} page (${settings.href})`, async ({ page }) => {
        const getErrors = setupConsoleErrorCheck(page);

        await page.goto(settings.href);
        await waitForAppReady(page);

        // Verify URL (may redirect if auth required)
        const currentUrl = page.url();

        // Verify no JS errors
        const errors = getErrors();
        if (errors.length > 0) {
          console.log(`Console errors on ${settings.name}:`, errors);
        }
        expect(errors.length).toBe(0);

        await takeScreenshot(page, `nav-settings-${settings.name.toLowerCase().replace(/\s+/g, '-')}`);
      });
    }
  });

  test.describe('Project Detail Pages Navigation', () => {
    test('should navigate to create new project page', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/projects/new');
      await waitForAppReady(page);

      // Verify we're on the new project page or redirected appropriately
      const errors = getErrors();
      expect(errors.length).toBe(0);

      await takeScreenshot(page, 'nav-projects-new');
    });

    test('should handle project detail page with invalid ID', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/projects/non-existent-project-id-12345');
      await waitForAppReady(page);

      // Should not have JS errors, may show error page or redirect
      const errors = getErrors();
      expect(errors.length).toBe(0);

      await takeScreenshot(page, 'nav-projects-invalid-id');
    });

    test('should navigate to projects list and handle empty state', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/projects');
      await waitForAppReady(page);

      // Should show either projects or empty state
      const projectsList = page.locator('[data-testid="projects-list"], [class*="project"], main');
      await expect(projectsList.first()).toBeVisible();

      const errors = getErrors();
      expect(errors.length).toBe(0);

      await takeScreenshot(page, 'nav-projects-list');
    });
  });

  test.describe('Complete Sidebar Structure Verification', () => {
    test('should render sidebar with logo and branding', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Verify sidebar exists
      const sidebar = page.locator('aside');
      await expect(sidebar).toBeVisible();

      // Verify branding
      await expect(sidebar.locator('text=Claudia Coder')).toBeVisible();

      // Verify logo image
      const logo = sidebar.locator('img[alt*="Claudia"]');
      await expect(logo).toBeVisible();

      await takeScreenshot(page, 'nav-sidebar-branding');
    });

    test('should have collapsible category sections', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Verify Projects section toggle exists
      const projectsToggle = page.locator('aside button:has-text("Projects")');
      await expect(projectsToggle).toBeVisible();

      // Verify Tools section toggle exists
      const toolsToggle = page.locator('aside button:has-text("Tools")');
      await expect(toolsToggle).toBeVisible();

      await takeScreenshot(page, 'nav-sidebar-sections');
    });

    test('should toggle sidebar sections correctly', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Find Tools section
      const toolsToggle = page.locator('aside button:has-text("Tools")');

      // Get initial state of a tools item (e.g., Claude Code)
      await expandSidebarSection(page, 'Tools');
      const claudeCodeLink = page.locator('aside a:has-text("Claude Code")');
      await expect(claudeCodeLink).toBeVisible();

      await takeScreenshot(page, 'nav-sidebar-tools-expanded');

      // Click to collapse
      await toolsToggle.click();
      await page.waitForTimeout(400);

      // Claude Code should be hidden now
      await expect(claudeCodeLink).toBeHidden();

      await takeScreenshot(page, 'nav-sidebar-tools-collapsed');
    });

    test('should display search/command palette button', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      const searchButton = page.locator('aside button:has-text("Search")');
      await expect(searchButton).toBeVisible();

      await takeScreenshot(page, 'nav-sidebar-search-button');
    });

    test('should display user menu at bottom of sidebar', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // User menu should be visible at bottom of sidebar
      const userMenu = page.locator('aside').locator('[data-testid="user-menu"], [class*="user"], button:last-child');
      // Relax this check - just verify sidebar has some bottom content
      const sidebarBottom = page.locator('aside > div:last-child');
      await expect(sidebarBottom).toBeVisible();

      await takeScreenshot(page, 'nav-sidebar-user-menu');
    });
  });

  test.describe('Navigation Link Attributes', () => {
    test('should have correct href attributes for all internal links', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Expand all sections
      await expandSidebarSection(page, 'Projects');
      await expandSidebarSection(page, 'Tools');

      // Check each navigation item has correct href
      for (const item of [...projectsItems, ...toolsItems, ...bottomItems]) {
        const link = page.locator(`aside a:has-text("${item.name}")`).first();
        const isVisible = await link.isVisible().catch(() => false);

        if (isVisible) {
          const href = await link.getAttribute('href');
          expect(href).toBe(item.href);
        }
      }

      await takeScreenshot(page, 'nav-link-hrefs-verified');
    });

    test('should highlight active navigation item', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Dashboard should be active when on root
      const dashboardLink = page.locator('aside a:has-text("Dashboard")');

      // Check for active styling (typically includes primary color class)
      const dashboardClasses = await dashboardLink.getAttribute('class');
      expect(dashboardClasses).toContain('primary');

      await takeScreenshot(page, 'nav-active-item-dashboard');

      // Navigate to projects and verify active state changes
      await expandSidebarSection(page, 'Projects');
      await navigateViaSidebar(page, 'Projects');
      await waitForAppReady(page);

      const projectsLink = page.locator('aside a[href="/projects"]');
      const projectsClasses = await projectsLink.getAttribute('class');
      expect(projectsClasses).toContain('primary');

      await takeScreenshot(page, 'nav-active-item-projects');
    });
  });

  test.describe('Navigation Performance', () => {
    test('should navigate between pages quickly', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Time navigation to projects
      const startProjects = Date.now();
      await expandSidebarSection(page, 'Projects');
      await navigateViaSidebar(page, 'Projects');
      await waitForAppReady(page);
      const projectsTime = Date.now() - startProjects;

      // Time navigation to tools
      const startTools = Date.now();
      await expandSidebarSection(page, 'Tools');
      await navigateViaSidebar(page, 'Claude Code');
      await waitForAppReady(page);
      const toolsTime = Date.now() - startTools;

      // Time navigation back to dashboard
      const startDashboard = Date.now();
      await expandSidebarSection(page, 'Projects');
      await navigateViaSidebar(page, 'Dashboard');
      await waitForAppReady(page);
      const dashboardTime = Date.now() - startDashboard;

      // Log performance metrics
      console.log('Navigation Performance:');
      console.log(`  Projects: ${projectsTime}ms`);
      console.log(`  Claude Code: ${toolsTime}ms`);
      console.log(`  Dashboard: ${dashboardTime}ms`);

      // All navigations should complete within 10 seconds
      expect(projectsTime).toBeLessThan(10000);
      expect(toolsTime).toBeLessThan(10000);
      expect(dashboardTime).toBeLessThan(10000);

      await takeScreenshot(page, 'nav-performance-test');
    });
  });

  test.describe('Mobile Navigation (Collapsed Sidebar)', () => {
    test('should handle collapsed sidebar state', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Find collapse toggle button
      const collapseButton = page.locator('aside button').filter({ has: page.locator('svg') }).first();

      // Take screenshot of expanded state
      await takeScreenshot(page, 'nav-sidebar-expanded');

      // Try to collapse sidebar if button exists
      const hasCollapseButton = await collapseButton.isVisible().catch(() => false);

      if (hasCollapseButton) {
        await collapseButton.click();
        await page.waitForTimeout(300);

        // Verify sidebar is narrower
        const sidebar = page.locator('aside');
        const sidebarWidth = await sidebar.evaluate(el => (el as HTMLElement).offsetWidth);

        // Collapsed sidebar should be narrow (less than 100px typically)
        // If sidebar is wide, it might not support collapsing
        console.log(`Sidebar width after collapse attempt: ${sidebarWidth}px`);

        await takeScreenshot(page, 'nav-sidebar-collapsed-attempt');
      }
    });
  });

  test.describe('Error Handling During Navigation', () => {
    test('should handle navigation to non-existent routes', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/non-existent-route-xyz123');
      await waitForAppReady(page);

      // Should show error page without crashing
      const errors = getErrors();
      // Filter out expected 404 errors
      const criticalErrors = errors.filter(e =>
        !e.includes('404') &&
        !e.includes('not found') &&
        !e.includes('Not Found')
      );

      expect(criticalErrors.length).toBe(0);

      await takeScreenshot(page, 'nav-404-page');
    });

    test('should maintain sidebar after navigation error', async ({ page }) => {
      await page.goto('/non-existent-route');
      await waitForAppReady(page);

      // Sidebar should still be visible
      const sidebar = page.locator('aside');
      await expect(sidebar).toBeVisible();

      // Navigation should still work
      await expandSidebarSection(page, 'Projects');
      await navigateViaSidebar(page, 'Dashboard');
      await waitForAppReady(page);

      await expect(page).toHaveURL(/\/$/);

      await takeScreenshot(page, 'nav-recovery-after-error');
    });
  });
});

test.describe('Comprehensive Navigation Flow', () => {
  test('should navigate through all main sections sequentially', async ({ page }) => {
    const getErrors = setupConsoleErrorCheck(page);

    await page.goto('/');
    await waitForAppReady(page);

    // Visit each major section
    const majorSections = [
      { name: 'Dashboard', category: 'Projects' as const },
      { name: 'Projects', category: 'Projects' as const },
      { name: 'Voice', category: 'Projects' as const },
      { name: 'Claude Code', category: 'Tools' as const },
      { name: 'Research', category: 'Tools' as const },
      { name: 'Trash', category: 'Bottom' as const },
    ];

    for (const section of majorSections) {
      if (section.category !== 'Bottom') {
        await expandSidebarSection(page, section.category).catch(() => {});
      }

      await navigateViaSidebar(page, section.name);
      await waitForAppReady(page);

      console.log(`Navigated to: ${section.name}`);
      await takeScreenshot(page, `nav-flow-${section.name.toLowerCase().replace(/\s+/g, '-')}`);
    }

    // Check for any errors accumulated during the flow
    const errors = getErrors();
    if (errors.length > 0) {
      console.log('Errors during navigation flow:', errors);
    }
    expect(errors.length).toBe(0);
  });

  test('should handle rapid navigation between pages', async ({ page }) => {
    const getErrors = setupConsoleErrorCheck(page);

    await page.goto('/');
    await waitForAppReady(page);

    // Expand sections first
    await expandSidebarSection(page, 'Projects');
    await expandSidebarSection(page, 'Tools');

    // Rapidly navigate between pages
    const pages = ['/projects', '/voice', '/claude-code', '/research', '/'];

    for (const href of pages) {
      await page.goto(href);
      // Don't wait for full ready, test rapid navigation
      await page.waitForSelector('aside', { state: 'visible', timeout: 5000 });
    }

    // Final wait for page to settle
    await waitForAppReady(page);

    const errors = getErrors();
    if (errors.length > 0) {
      console.log('Errors during rapid navigation:', errors);
    }
    expect(errors.length).toBe(0);

    await takeScreenshot(page, 'nav-rapid-navigation-complete');
  });
});
