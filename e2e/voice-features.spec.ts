import { test, expect } from '@playwright/test';
import {
  waitForAppReady,
  takeScreenshot,
  setupConsoleErrorCheck,
  navigateViaSidebar,
} from './helpers';

test.describe('Voice Features Tests', () => {
  test.describe('Voice Page UI', () => {
    test('should load the Voice page with correct title', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/');
      await waitForAppReady(page);

      // Navigate to Voice page
      await navigateViaSidebar(page, 'Voice');
      await expect(page).toHaveURL(/\/voice/);

      // Verify page title
      await expect(page.locator('h1')).toContainText('Voice Studio');

      // Verify subtitle
      await expect(page.locator('text=Record ideas, create projects from voice')).toBeVisible();

      await takeScreenshot(page, 'voice-page-loaded');

      // Check for console errors
      const errors = getErrors();
      expect(errors.length).toBe(0);
    });

    test('should display Record and Library tabs', async ({ page }) => {
      await page.goto('/voice');
      await waitForAppReady(page);

      // Verify tabs exist
      const recordTab = page.locator('[role="tablist"] >> text=Record');
      const libraryTab = page.locator('[role="tablist"] >> text=Library');

      await expect(recordTab).toBeVisible();
      await expect(libraryTab).toBeVisible();

      // Record tab should be active by default
      await expect(recordTab).toHaveAttribute('data-state', 'active');

      await takeScreenshot(page, 'voice-tabs-visible');
    });

    test('should display recording interface on Record tab', async ({ page }) => {
      await page.goto('/voice');
      await waitForAppReady(page);

      // Verify "Ready" badge is visible (initial state)
      const readyBadge = page.locator('text=Ready').first();
      await expect(readyBadge).toBeVisible();

      // Verify instructions text
      await expect(page.locator('text=Press the microphone to start recording')).toBeVisible();

      // Verify microphone button exists (the large circular button)
      const micButton = page.locator('button:has(svg)').filter({ has: page.locator('svg') }).first();
      await expect(micButton).toBeVisible();

      await takeScreenshot(page, 'voice-recording-interface');
    });

    test('should display Quick Ideas section', async ({ page }) => {
      await page.goto('/voice');
      await waitForAppReady(page);

      // Verify Quick Ideas section
      await expect(page.locator('text=Quick Ideas')).toBeVisible();
      await expect(page.locator('text=Say something like...')).toBeVisible();

      // Verify at least one quick command is shown
      await expect(page.locator('text="What\'s the status?"')).toBeVisible();

      await takeScreenshot(page, 'voice-quick-ideas');
    });

    test('should display Pro tip card', async ({ page }) => {
      await page.goto('/voice');
      await waitForAppReady(page);

      // Verify pro tip exists
      await expect(page.locator('text=Pro tip:')).toBeVisible();
      await expect(page.locator('text=Recordings are automatically transcribed and saved')).toBeVisible();

      await takeScreenshot(page, 'voice-pro-tip');
    });

    test('should switch to Library tab', async ({ page }) => {
      await page.goto('/voice');
      await waitForAppReady(page);

      // Click on Library tab
      const libraryTab = page.locator('[role="tablist"] >> text=Library');
      await libraryTab.click();
      await page.waitForTimeout(300);

      // Verify Library tab is now active
      await expect(libraryTab).toHaveAttribute('data-state', 'active');

      // Library content should be visible (either recordings or sign-in message)
      const libraryContent = page.locator('[role="tabpanel"]');
      await expect(libraryContent).toBeVisible();

      await takeScreenshot(page, 'voice-library-tab');
    });

    test('should have mute/unmute button', async ({ page }) => {
      await page.goto('/voice');
      await waitForAppReady(page);

      // Find mute button
      const muteButton = page.locator('button:has-text("Mute")');
      await expect(muteButton).toBeVisible();

      // Click to mute
      await muteButton.click();
      await page.waitForTimeout(200);

      // Should now show Unmute
      await expect(page.locator('button:has-text("Unmute")')).toBeVisible();

      // Click to unmute
      await page.locator('button:has-text("Unmute")').click();
      await page.waitForTimeout(200);

      // Should show Mute again
      await expect(page.locator('button:has-text("Mute")')).toBeVisible();

      await takeScreenshot(page, 'voice-mute-toggle');
    });

    test('should show recording stats in header when available', async ({ page }) => {
      await page.goto('/voice');
      await waitForAppReady(page);

      // Stats may or may not be visible depending on whether user has recordings
      // Just verify the header layout is correct
      const header = page.locator('h1:has-text("Voice Studio")').locator('..');
      await expect(header).toBeVisible();

      await takeScreenshot(page, 'voice-header-stats');
    });
  });

  test.describe('Voice Page Error Handling', () => {
    test('should handle unsupported browser gracefully', async ({ page, context }) => {
      // This test documents what happens if recording is not supported
      // In most test browsers, recording IS supported, so we just verify the page loads
      await page.goto('/voice');
      await waitForAppReady(page);

      // Page should load without errors regardless of recording support
      await expect(page.locator('h1')).toContainText('Voice Studio');

      await takeScreenshot(page, 'voice-browser-support');
    });

    test('should not have JavaScript errors on Voice page', async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      await page.goto('/voice');
      await waitForAppReady(page);

      // Wait for any async operations
      await page.waitForTimeout(2000);

      const errors = getErrors();
      if (errors.length > 0) {
        console.log('Console errors found on Voice page:', errors);
      }

      expect(errors).toEqual([]);
    });
  });

  test.describe('Voice Recording API', () => {
    test('should return 401 for unauthenticated GET request', async ({ request }) => {
      const response = await request.get('/api/voice-recordings');

      // Should require authentication
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.error).toBe('Authentication required');
    });

    test('should return 401 for unauthenticated POST request', async ({ request }) => {
      const formData = new FormData();
      formData.append('transcription', 'test transcription');

      // Note: This will fail with 401 before even checking for audio file
      const response = await request.post('/api/voice-recordings', {
        multipart: {
          transcription: 'test transcription'
        }
      });

      // Should require authentication
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.error).toBe('Authentication required');
    });

    test('should return 401 for unauthenticated DELETE request', async ({ request }) => {
      const response = await request.delete('/api/voice-recordings/test-id?audioUrl=/test');

      // Should require authentication
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.error).toBe('Authentication required');
    });

    test('should return 401 for unauthenticated audio fetch', async ({ request }) => {
      const response = await request.get('/api/voice-recordings/audio/test-id');

      // Should require authentication
      expect(response.status()).toBe(401);

      const body = await response.json();
      expect(body.error).toBe('Authentication required');
    });
  });

  test.describe('Brain Dump API', () => {
    test('should return 400 when no transcript provided to process endpoint', async ({ request }) => {
      const response = await request.post('/api/brain-dump/process', {
        data: {}
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBe('No transcript provided');
    });

    test('should return 400 when no transcript provided to packetize endpoint', async ({ request }) => {
      const response = await request.post('/api/brain-dump/packetize', {
        data: { projectId: 'test-project' }
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBe('No transcript provided');
    });

    test('should return 400 when no projectId provided to packetize endpoint', async ({ request }) => {
      const response = await request.post('/api/brain-dump/packetize', {
        data: { transcript: 'test transcript' }
      });

      expect(response.status()).toBe(400);

      const body = await response.json();
      expect(body.error).toBe('projectId is required');
    });
  });
});
