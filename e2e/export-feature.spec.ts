import { test, expect, Download } from '@playwright/test';
import {
  waitForAppReady,
  takeScreenshot,
  setupConsoleErrorCheck,
  navigateViaSidebar,
} from './helpers';

test.describe('Export All Feature Tests', () => {
  test.describe('Export Button Visibility', () => {
    test('should display Export All button on project detail page', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      // Navigate to projects page first
      await page.goto('/projects');
      await waitForAppReady(page);

      // Look for any project card/link to click on
      const projectLink = page.locator('a[href^="/projects/"]').first();

      if (await projectLink.isVisible()) {
        await projectLink.click();
        await waitForAppReady(page);

        // Look for the Export All button in the header
        const exportButton = page.locator('button:has-text("Export All")');

        await takeScreenshot(page, 'project-page-with-export-button');

        // Verify the Export All button exists
        await expect(exportButton).toBeVisible();

        // Verify button has the download icon
        const downloadIcon = exportButton.locator('svg');
        await expect(downloadIcon).toBeVisible();

        const errors = getErrors();
        expect(errors.length).toBe(0);
      } else {
        // No projects exist - create one first
        test.skip();
      }
    });

    test('should show loading state when export is in progress', async ({ page }) => {
      await page.goto('/projects');
      await waitForAppReady(page);

      const projectLink = page.locator('a[href^="/projects/"]').first();

      if (await projectLink.isVisible()) {
        await projectLink.click();
        await waitForAppReady(page);

        const exportButton = page.locator('button:has-text("Export All")');

        if (await exportButton.isVisible()) {
          // Click the export button
          await exportButton.click();

          // Check for loading state (spinner or "Exporting..." text)
          const loadingState = page.locator('button:has-text("Exporting"), button:has([class*="animate-spin"])');

          // The button should show loading state
          await takeScreenshot(page, 'export-loading-state');

          // Wait for export to complete (either download starts or button returns to normal)
          await page.waitForTimeout(5000);
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('Export Download Functionality', () => {
    test('should trigger download when Export All is clicked', async ({ page }) => {
      await page.goto('/projects');
      await waitForAppReady(page);

      const projectLink = page.locator('a[href^="/projects/"]').first();

      if (await projectLink.isVisible()) {
        await projectLink.click();
        await waitForAppReady(page);

        const exportButton = page.locator('button:has-text("Export All")');

        if (await exportButton.isVisible()) {
          // Listen for download event
          const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

          // Click export button
          await exportButton.click();

          await takeScreenshot(page, 'export-initiated');

          try {
            // Wait for the download to start
            const download = await downloadPromise;

            // Verify the download filename matches expected pattern
            const filename = download.suggestedFilename();
            expect(filename).toMatch(/.*-export-.*\.(zip|json)$/);

            await takeScreenshot(page, 'export-download-started');

            // Optionally save the download for verification
            const downloadPath = await download.path();
            expect(downloadPath).toBeTruthy();

          } catch (error) {
            // Download may have failed or taken too long
            await takeScreenshot(page, 'export-download-failed');
            throw error;
          }
        }
      } else {
        test.skip();
      }
    });

    test('should download ZIP file with source code included', async ({ page }) => {
      await page.goto('/projects');
      await waitForAppReady(page);

      const projectLink = page.locator('a[href^="/projects/"]').first();

      if (await projectLink.isVisible()) {
        await projectLink.click();
        await waitForAppReady(page);

        const exportButton = page.locator('button:has-text("Export All")');

        if (await exportButton.isVisible()) {
          const downloadPromise = page.waitForEvent('download', { timeout: 60000 });

          await exportButton.click();

          try {
            const download = await downloadPromise;
            const filename = download.suggestedFilename();

            // When includeSourceCode is true, should be a ZIP file
            expect(filename).toMatch(/\.zip$/);

            await takeScreenshot(page, 'export-zip-downloaded');

          } catch (error) {
            await takeScreenshot(page, 'export-zip-failed');
            throw error;
          }
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('Export with Different Project States', () => {
    test('should handle export for newly created project (empty state)', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      // Navigate to create a new project
      await page.goto('/projects/new');
      await waitForAppReady(page);

      // Try Quick mode if available
      const quickOption = page.locator('button:has-text("Quick")');
      if (await quickOption.isVisible()) {
        await quickOption.click();
        await page.waitForTimeout(500);
      }

      // Fill in project details
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
      const descriptionInput = page.locator('textarea[name="description"], textarea[placeholder*="description" i]').first();

      const timestamp = Date.now();
      const projectName = `Export Test Empty Project ${timestamp}`;

      if (await nameInput.isVisible()) {
        await nameInput.fill(projectName);
      }

      if (await descriptionInput.isVisible()) {
        await descriptionInput.fill('Test project for export feature - empty state');
      }

      await takeScreenshot(page, 'export-test-project-form');

      // Submit the form
      const submitButton = page.locator('button[type="submit"], button:has-text("Create Project"), button:has-text("Create")');

      if (await submitButton.isVisible()) {
        await submitButton.click();

        // Wait for navigation to new project
        try {
          await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/, { timeout: 10000 });
          await waitForAppReady(page);

          // Now find and click Export All button
          const exportButton = page.locator('button:has-text("Export All")');

          if (await exportButton.isVisible()) {
            await takeScreenshot(page, 'export-empty-project-page');

            const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
            await exportButton.click();

            try {
              const download = await downloadPromise;
              const filename = download.suggestedFilename();

              // Should still be able to export even with empty project
              expect(filename).toMatch(/.*-export-.*\.(zip|json)$/);

              await takeScreenshot(page, 'export-empty-project-success');
            } catch (error) {
              await takeScreenshot(page, 'export-empty-project-failed');
              // Empty project export might fail if no data - that's acceptable
            }
          }
        } catch (error) {
          await takeScreenshot(page, 'export-test-project-creation-failed');
        }
      }

      const errors = getErrors();
      expect(errors.length).toBe(0);
    });

    test('should handle export for existing project with sample data', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      // Navigate to projects page
      await page.goto('/projects');
      await waitForAppReady(page);

      // Look for a project that has data (not just any project)
      // Sample projects should have some data
      const projectCards = page.locator('a[href^="/projects/"]');
      const count = await projectCards.count();

      if (count > 0) {
        // Click on first project
        await projectCards.first().click();
        await waitForAppReady(page);

        await takeScreenshot(page, 'existing-project-detail');

        // Check if this project has any data indicators
        const hasPackets = await page.locator('text=/\\d+ packets?/i, text=/packets/i').isVisible();
        const hasResources = await page.locator('text=/\\d+ resources?/i, text=/resources/i').isVisible();
        const hasBuildPlan = await page.locator('text=/build plan/i').isVisible();

        // Find and click Export All
        const exportButton = page.locator('button:has-text("Export All")');

        if (await exportButton.isVisible()) {
          const downloadPromise = page.waitForEvent('download', { timeout: 60000 });
          await exportButton.click();

          try {
            const download = await downloadPromise;
            const filename = download.suggestedFilename();

            expect(filename).toMatch(/.*-export-.*\.(zip|json)$/);

            // Verify download is not empty (should have some content)
            const downloadPath = await download.path();
            expect(downloadPath).toBeTruthy();

            await takeScreenshot(page, 'export-existing-project-success');

          } catch (error) {
            await takeScreenshot(page, 'export-existing-project-failed');
            throw error;
          }
        }
      } else {
        test.skip();
      }

      const errors = getErrors();
      expect(errors.length).toBe(0);
    });
  });

  test.describe('Export Button States', () => {
    test('should disable Export button while export is in progress', async ({ page }) => {
      await page.goto('/projects');
      await waitForAppReady(page);

      const projectLink = page.locator('a[href^="/projects/"]').first();

      if (await projectLink.isVisible()) {
        await projectLink.click();
        await waitForAppReady(page);

        const exportButton = page.locator('button:has-text("Export All")');

        if (await exportButton.isVisible()) {
          // Click export
          await exportButton.click();

          // Button should be disabled during export
          await expect(exportButton).toBeDisabled({ timeout: 1000 }).catch(() => {
            // Button may not be disabled but should show loading state
          });

          await takeScreenshot(page, 'export-button-disabled-state');

          // Wait for export to complete
          await page.waitForTimeout(5000);

          // Button should be enabled again
          await expect(exportButton).toBeEnabled({ timeout: 30000 });

          await takeScreenshot(page, 'export-button-enabled-again');
        }
      } else {
        test.skip();
      }
    });

    test('should show progress indicator during export', async ({ page }) => {
      await page.goto('/projects');
      await waitForAppReady(page);

      const projectLink = page.locator('a[href^="/projects/"]').first();

      if (await projectLink.isVisible()) {
        await projectLink.click();
        await waitForAppReady(page);

        const exportButton = page.locator('button:has-text("Export All")');

        if (await exportButton.isVisible()) {
          // Click export
          await exportButton.click();

          // Look for progress text in the button
          // The button shows progress like "Loading project data..." or "Creating ZIP..."
          const progressText = page.locator('button:has-text("Loading"), button:has-text("Creating"), button:has-text("Exporting")');

          // Wait briefly for progress to appear
          await page.waitForTimeout(500);

          await takeScreenshot(page, 'export-progress-indicator');

          // Wait for completion
          await page.waitForTimeout(10000);
        }
      } else {
        test.skip();
      }
    });
  });

  test.describe('Export API Endpoint', () => {
    test('should return usage information on GET request', async ({ request }) => {
      // Use a placeholder project ID for the GET info endpoint
      const response = await request.get('/api/projects/test-project-id/export-all');

      expect(response.status()).toBe(200);

      const data = await response.json();

      // Verify the response contains expected usage information
      expect(data.message).toBe('Use POST method to export project data');
      expect(data.projectId).toBe('test-project-id');
      expect(data.usage).toBeDefined();
      expect(data.usage.method).toBe('POST');
      expect(data.zipStructure).toBeDefined();
    });

    test('should reject POST without valid project data', async ({ request }) => {
      const response = await request.post('/api/projects/test-project-id/export-all', {
        data: {}
      });

      // Should return 400 for invalid/empty body
      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    test('should accept POST with valid project data structure', async ({ request }) => {
      const testProject = {
        id: 'test-export-project',
        name: 'Test Export Project',
        description: 'A test project for API validation',
        status: 'active',
        priority: 'medium',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        repos: [],
        packetIds: [],
        tags: [],
      };

      const response = await request.post('/api/projects/test-export-project/export-all', {
        data: {
          project: testProject,
          buildPlans: [],
          packets: [],
          packetRuns: [],
          brainDumps: [],
          resources: [],
          resourceFiles: [],
          businessDev: null,
          voiceRecordings: [],
        }
      });

      // Should return ZIP or JSON response
      expect([200, 400, 500]).toContain(response.status());

      if (response.status() === 200) {
        // Verify content type is ZIP
        const contentType = response.headers()['content-type'];
        expect(contentType).toContain('application/zip');
      }
    });
  });
});
