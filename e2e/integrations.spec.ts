import { test, expect } from '@playwright/test';
import {
  waitForAppReady,
  takeScreenshot,
  setupConsoleErrorCheck,
  navigateViaSidebar,
  expandSidebarSection,
} from './helpers';

test.describe('Integration Pages Tests', () => {
  test.describe('Gitea Integration', () => {
    test('should load Gitea page', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/gitea');
      await waitForAppReady(page);

      await takeScreenshot(page, 'gitea-page-loaded');

      // App stays at /gitea
      await expect(page).toHaveURL(/\/gitea/);

      // Page should have some content (title, iframe, or configuration)
      const pageContent = await page.content();
      const hasGiteaContent =
        pageContent.toLowerCase().includes('gitea') ||
        pageContent.toLowerCase().includes('gitlab') ||
        pageContent.toLowerCase().includes('source control') ||
        pageContent.toLowerCase().includes('git');

      expect(hasGiteaContent).toBeTruthy();

      const errors = getErrors();
      expect(errors.length).toBe(0);
    });

    test('should navigate to Gitea via sidebar', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Expand Tools section
      await expandSidebarSection(page, 'Tools');

      // Click on Source Control (which links to /gitea)
      await navigateViaSidebar(page, 'Source Control');

      // App stays at /gitea
      await expect(page).toHaveURL(/\/gitea/);

      await takeScreenshot(page, 'gitea-via-sidebar');
    });

    test('should display Gitea interface or configuration', async ({ page }) => {
      await page.goto('/gitea');
      await waitForAppReady(page);

      // Check for iframe (embedded Gitea) or configuration form
      const iframe = page.locator('iframe');
      const configForm = page.locator('form, input, button');

      const hasIframe = await iframe.isVisible().catch(() => false);
      const hasConfig = await configForm.first().isVisible().catch(() => false);

      await takeScreenshot(page, 'gitea-interface');

      // Should have either embedded interface or configuration
      expect(hasIframe || hasConfig).toBeTruthy();
    });
  });

  test.describe('OpenWebUI Integration', () => {
    test('should load OpenWebUI page', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/openwebui');
      await waitForAppReady(page);

      await takeScreenshot(page, 'openwebui-page-loaded');

      // App stays at /openwebui
      await expect(page).toHaveURL(/\/openwebui/);

      // Page should have relevant content
      const pageContent = await page.content();
      const hasOpenWebUIContent =
        pageContent.toLowerCase().includes('openwebui') ||
        pageContent.toLowerCase().includes('open web ui') ||
        pageContent.toLowerCase().includes('chat') ||
        pageContent.toLowerCase().includes('ai') ||
        pageContent.toLowerCase().includes('settings');

      expect(hasOpenWebUIContent).toBeTruthy();

      const errors = getErrors();
      expect(errors.length).toBe(0);
    });

    test('should navigate to OpenWebUI via sidebar', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Expand Tools section
      await expandSidebarSection(page, 'Tools');

      // Click on Open Web UI
      await navigateViaSidebar(page, 'Open Web UI');

      // App stays at /openwebui
      await expect(page).toHaveURL(/\/openwebui/);

      await takeScreenshot(page, 'openwebui-via-sidebar');
    });

    test('should display OpenWebUI interface or configuration', async ({ page }) => {
      await page.goto('/openwebui');
      await waitForAppReady(page);

      // Check for iframe (embedded OpenWebUI) or configuration
      const iframe = page.locator('iframe');
      const content = page.locator('main, [role="main"], .content');

      const hasIframe = await iframe.isVisible().catch(() => false);
      const hasContent = await content.first().isVisible().catch(() => false);

      await takeScreenshot(page, 'openwebui-interface');

      // Should have some interface
      expect(hasIframe || hasContent).toBeTruthy();
    });
  });

  test.describe('n8n Integration', () => {
    test('should load n8n page', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/n8n');
      await waitForAppReady(page);

      await takeScreenshot(page, 'n8n-page-loaded');

      // App stays at /n8n
      await expect(page).toHaveURL(/\/n8n/);

      // Page should have relevant content
      const pageContent = await page.content();
      const hasN8nContent =
        pageContent.toLowerCase().includes('n8n') ||
        pageContent.toLowerCase().includes('workflow') ||
        pageContent.toLowerCase().includes('automation') ||
        pageContent.toLowerCase().includes('settings');

      expect(hasN8nContent).toBeTruthy();

      const errors = getErrors();
      expect(errors.length).toBe(0);
    });

    test('should navigate to n8n via sidebar', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Expand Tools section
      await expandSidebarSection(page, 'Tools');

      // Click on n8n
      await navigateViaSidebar(page, 'n8n');

      // App stays at /n8n
      await expect(page).toHaveURL(/\/n8n/);

      await takeScreenshot(page, 'n8n-via-sidebar');
    });

    test('should display n8n interface or configuration', async ({ page }) => {
      await page.goto('/n8n');
      await waitForAppReady(page);

      // Check for iframe (embedded n8n) or configuration
      const iframe = page.locator('iframe');
      const content = page.locator('main, [role="main"], .content');

      const hasIframe = await iframe.isVisible().catch(() => false);
      const hasContent = await content.first().isVisible().catch(() => false);

      await takeScreenshot(page, 'n8n-interface');

      // Should have some interface
      expect(hasIframe || hasContent).toBeTruthy();
    });
  });

  test.describe('Source Control Sidebar Item', () => {
    test('should have Source Control in Tools section', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Expand Tools section
      await expandSidebarSection(page, 'Tools');

      await page.waitForTimeout(500);

      // Look for Source Control link
      const sourceControlLink = page.locator('aside a:has-text("Source Control")');

      await takeScreenshot(page, 'source-control-in-sidebar');

      await expect(sourceControlLink).toBeVisible();
    });

    test('should Source Control link point to /gitea', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Expand Tools section
      await expandSidebarSection(page, 'Tools');

      const sourceControlLink = page.locator('aside a:has-text("Source Control")');

      // Check href attribute points to /gitea
      const href = await sourceControlLink.getAttribute('href');
      expect(href).toBe('/gitea');
    });

    test('should navigate from Source Control to Gitea page', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Expand Tools section
      await expandSidebarSection(page, 'Tools');

      // Click Source Control
      await page.click('aside a:has-text("Source Control")');
      await waitForAppReady(page);

      // App stays at /gitea
      await expect(page).toHaveURL(/\/gitea/);

      await takeScreenshot(page, 'source-control-navigates-to-gitea');
    });
  });

  test.describe('Tools Section Navigation', () => {
    test('should have all expected tools in sidebar', async ({ page }) => {
      await page.goto('/');
      await waitForAppReady(page);

      // Expand Tools section
      await expandSidebarSection(page, 'Tools');

      await page.waitForTimeout(500);

      await takeScreenshot(page, 'tools-section-expanded');

      // Check for expected tools
      const expectedTools = [
        'Claude Code',
        'Open Web UI',
        'Source Control',
        'n8n',
      ];

      for (const tool of expectedTools) {
        const toolLink = page.locator(`aside a:has-text("${tool}")`);
        await expect(toolLink).toBeVisible();
      }
    });

    test('should navigate through all tool pages', async ({ page }) => {
      // Tools stay at their direct URLs
      const toolPages = [
        { name: 'Claude Code', url: '/claude-code' },
        { name: 'Open Web UI', url: '/openwebui' },
        { name: 'Source Control', url: '/gitea' },
        { name: 'n8n', url: '/n8n' },
      ];

      for (const tool of toolPages) {
        await page.goto('/');
        await waitForAppReady(page);

        // Expand Tools section
        await expandSidebarSection(page, 'Tools');

        // Navigate to tool
        await navigateViaSidebar(page, tool.name);

        // Verify URL (stays at direct URL)
        await expect(page).toHaveURL(new RegExp(tool.url));

        await takeScreenshot(page, `tool-${tool.name.toLowerCase().replace(/\s+/g, '-')}`);
      }
    });
  });

  test.describe('Settings Integration Pages', () => {
    test('should have n8n settings page', async ({ page }) => {
      await page.goto('/settings/n8n');
      await waitForAppReady(page);

      await takeScreenshot(page, 'n8n-settings-page');

      await expect(page).toHaveURL(/\/settings\/n8n/);
    });

    test('should have OpenWebUI settings page', async ({ page }) => {
      await page.goto('/settings/openwebui');
      await waitForAppReady(page);

      await takeScreenshot(page, 'openwebui-settings-page');

      await expect(page).toHaveURL(/\/settings\/openwebui/);
    });

    test('should have GitLab settings page', async ({ page }) => {
      await page.goto('/settings/gitlab');
      await waitForAppReady(page);

      await takeScreenshot(page, 'gitlab-settings-page');

      await expect(page).toHaveURL(/\/settings\/gitlab/);
    });
  });
});
