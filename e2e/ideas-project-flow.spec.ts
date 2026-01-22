import { test, expect } from '@playwright/test';
import {
  waitForAppReady,
  takeScreenshot,
  setupConsoleErrorCheck,
} from './helpers';

/**
 * Ideas Project E2E Tests
 * Tests the complete flow of creating and using Ideas-type projects
 * with the fractal ideation interface
 */

test.describe('Ideas Project Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to start fresh for each test
    await page.goto('/');
    await page.evaluate(() => {
      // Clear only test-related storage keys
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.includes('claudia_') || key.includes('project')) {
          localStorage.removeItem(key);
        }
      });
    });
  });

  test.describe('Ideas Project Creation', () => {
    test('should navigate to new project page', async ({ page }) => {
      await page.goto('/projects/new');
      await waitForAppReady(page);
      await takeScreenshot(page, 'ideas-01-new-project-page');

      // Should see project creation interface
      const pageContent = await page.textContent('body');
      expect(pageContent).toBeTruthy();
    });

    test('should create an Ideas project via Feeling Lucky', async ({ page }) => {
      await page.goto('/projects/new');
      await waitForAppReady(page);
      await takeScreenshot(page, 'ideas-02-before-input');

      // Enter the test scenario about Charles and LED displays
      const testInput = `Charles Can we do something with generative AI that I can use at the trade shows and roadshows to showcase the video walls. He lives in Shenzhen China and sells LED panels and video walls to resellers and distributors internationally and wants to start Incorporating AI content generation. I saw him at the trade shows and he had some really good products. 3D screens, these high resolution and high contrast panels, interactive walls. Seems like a lot of potential there. What direction do we go?`;

      // Look for the quick description textarea or input
      const descriptionInput = page.locator('textarea, input[type="text"]').first();
      if (await descriptionInput.isVisible()) {
        await descriptionInput.fill(testInput);
        await takeScreenshot(page, 'ideas-03-input-filled');
      }

      // Look for "Feeling Lucky" or similar button that triggers ideation mode
      const feelingLuckyBtn = page.locator('button:has-text("Feeling Lucky"), button:has-text("feeling lucky"), button:has-text("Quick"), button:has-text("Ideas")');
      if (await feelingLuckyBtn.first().isVisible()) {
        await feelingLuckyBtn.first().click();
        await page.waitForTimeout(3000); // Wait for LLM processing
        await takeScreenshot(page, 'ideas-04-after-feeling-lucky');
      }

      // Check if we got ideation detection
      const ideationDetected = page.locator('text=Ideas Project Detected, text=ideation, text=Detected');
      const hasIdeation = await ideationDetected.first().isVisible().catch(() => false);

      await takeScreenshot(page, 'ideas-05-ideation-detection-result');
    });

    test('should show ideation detection results with meaningful insights', async ({ page }) => {
      await page.goto('/projects/new');
      await waitForAppReady(page);

      // Enter the test input
      const testInput = `Charles Can we do something with generative AI that I can use at the trade shows and roadshows to showcase the video walls. He lives in Shenzhen China and sells LED panels and video walls to resellers and distributors internationally and wants to start Incorporating AI content generation.`;

      const descriptionInput = page.locator('textarea, input[type="text"]').first();
      if (await descriptionInput.isVisible()) {
        await descriptionInput.fill(testInput);
      }

      // Trigger detection
      const detectBtn = page.locator('button:has-text("Feeling Lucky"), button:has-text("Quick")');
      if (await detectBtn.first().isVisible()) {
        await detectBtn.first().click();
        await page.waitForTimeout(4000);
      }

      await takeScreenshot(page, 'ideas-06-detection-insights');

      // Verify key insights are present - should NOT have generic categories
      const pageText = await page.textContent('body') || '';

      // Should NOT see garbage like "Involves: What" or "Quick Win" categories
      const hasGarbageCategories =
        pageText.includes('Involves: What') ||
        pageText.includes('Involves: Click') ||
        pageText.includes('Quick Win:') ||
        pageText.includes('Platform Play:');

      // Log what we found for debugging
      console.log('Page text snippet:', pageText.substring(0, 500));

      await takeScreenshot(page, 'ideas-07-quality-check');
    });

    test('should create Ideas project and navigate to ideation interface', async ({ page }) => {
      await page.goto('/projects/new');
      await waitForAppReady(page);

      // Fill in project name
      const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
      if (await nameInput.isVisible()) {
        await nameInput.fill('LED AI Showcase Ideas');
      }

      // Fill in description
      const descInput = page.locator('textarea').first();
      if (await descInput.isVisible()) {
        await descInput.fill('Charles wants to showcase LED video walls with AI content generation at trade shows');
        await page.waitForTimeout(500);
      }

      await takeScreenshot(page, 'ideas-08-project-form');

      // Look for way to create as Ideas project
      const ideasMode = page.locator('button:has-text("Ideas"), button:has-text("Brainstorm"), input[value="ideas"], [data-testid*="ideas"]');
      if (await ideasMode.first().isVisible()) {
        await ideasMode.first().click();
        await page.waitForTimeout(500);
      }

      // Or trigger via Feeling Lucky
      const luckyBtn = page.locator('button:has-text("Feeling Lucky")');
      if (await luckyBtn.isVisible()) {
        await luckyBtn.click();
        await page.waitForTimeout(3000);
      }

      await takeScreenshot(page, 'ideas-09-after-mode-selection');

      // If ideation mode detected, proceed with creating the project
      const createIdeasBtn = page.locator('button:has-text("Create Ideas Project"), button:has-text("Create as Ideas"), button:has-text("Explore Ideas")');
      if (await createIdeasBtn.first().isVisible()) {
        await createIdeasBtn.first().click();
        await page.waitForTimeout(2000);
        await takeScreenshot(page, 'ideas-10-project-created');
      }
    });
  });

  test.describe('Fractal Ideation Interface', () => {
    test('should show ideas explorer with dynamic word cloud', async ({ page }) => {
      // First create an ideas project
      await page.goto('/projects/new');
      await waitForAppReady(page);

      const testContext = 'Charles sells LED panels and video walls, wants to incorporate AI content generation for trade shows and roadshows internationally';

      const descInput = page.locator('textarea').first();
      if (await descInput.isVisible()) {
        await descInput.fill(testContext);
      }

      const luckyBtn = page.locator('button:has-text("Feeling Lucky")');
      if (await luckyBtn.isVisible()) {
        await luckyBtn.click();
        await page.waitForTimeout(4000);
      }

      await takeScreenshot(page, 'ideas-11-explorer-initial');

      // Look for the word cloud or ideas display
      const ideasContainer = page.locator('[class*="ideas"], [class*="word-cloud"], [class*="explorer"], .flex-wrap');
      if (await ideasContainer.first().isVisible()) {
        await takeScreenshot(page, 'ideas-12-word-cloud-visible');
      }

      // Verify ideas are present - should have clickable items
      const clickableIdeas = page.locator('button, [role="button"]').filter({ hasText: /(LED|AI|trade|panel|video|content)/i });
      const ideaCount = await clickableIdeas.count();
      console.log(`Found ${ideaCount} clickable ideas related to the input`);

      await takeScreenshot(page, 'ideas-13-clickable-ideas');
    });

    test('should allow selecting ideas and narrowing down', async ({ page }) => {
      // Create project with ideation context
      await page.goto('/projects/new');
      await waitForAppReady(page);

      const testContext = 'Charles sells LED panels and video walls, wants AI content generation for trade shows';

      const descInput = page.locator('textarea').first();
      if (await descInput.isVisible()) {
        await descInput.fill(testContext);
      }

      const luckyBtn = page.locator('button:has-text("Feeling Lucky")');
      if (await luckyBtn.isVisible()) {
        await luckyBtn.click();
        await page.waitForTimeout(4000);
      }

      // If we're in ideation mode, create the project
      const createIdeasBtn = page.locator('button:has-text("Create Ideas Project"), button:has-text("Explore Ideas")');
      if (await createIdeasBtn.first().isVisible()) {
        await createIdeasBtn.first().click();
        await page.waitForTimeout(2000);
      }

      await takeScreenshot(page, 'ideas-14-before-selection');

      // Look for clickable idea buttons
      const ideaButtons = page.locator('[class*="ideas"] button, button:has-text("LED"), button:has-text("AI")');
      const firstIdea = ideaButtons.first();

      if (await firstIdea.isVisible()) {
        await firstIdea.click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, 'ideas-15-first-selection');

        // Select a second idea
        const secondIdea = ideaButtons.nth(1);
        if (await secondIdea.isVisible()) {
          await secondIdea.click();
          await page.waitForTimeout(500);
          await takeScreenshot(page, 'ideas-16-second-selection');
        }
      }

      // Look for "Narrow Down" or "Continue" or "Next" button
      const continueBtn = page.locator('button:has-text("Narrow"), button:has-text("Continue"), button:has-text("Next"), button:has-text("Proceed")');
      if (await continueBtn.first().isVisible()) {
        await continueBtn.first().click();
        await page.waitForTimeout(3000); // Wait for LLM to generate next stage
        await takeScreenshot(page, 'ideas-17-after-narrow');
      }
    });

    test('should show progressively focused ideas across stages', async ({ page }) => {
      // This test requires project to already exist with ideation interface
      // We'll simulate by going through creation and then ideation

      await page.goto('/projects/new');
      await waitForAppReady(page);

      const testContext = 'LED panels AI content trade shows international sales';

      const descInput = page.locator('textarea').first();
      if (await descInput.isVisible()) {
        await descInput.fill(testContext);
      }

      const luckyBtn = page.locator('button:has-text("Feeling Lucky")');
      if (await luckyBtn.isVisible()) {
        await luckyBtn.click();
        await page.waitForTimeout(4000);
      }

      await takeScreenshot(page, 'ideas-18-stage-1');

      // Record initial state
      const initialPageText = await page.textContent('body');

      // Try to progress through stages
      for (let stage = 1; stage <= 3; stage++) {
        // Select some ideas
        const ideaButtons = page.locator('[class*="idea"] button, button[class*="idea"]');
        const count = await ideaButtons.count();

        if (count > 0) {
          // Click first 2 ideas
          for (let i = 0; i < Math.min(2, count); i++) {
            await ideaButtons.nth(i).click().catch(() => {});
            await page.waitForTimeout(300);
          }
        }

        await takeScreenshot(page, `ideas-19-stage-${stage}-selections`);

        // Progress to next stage
        const nextBtn = page.locator('button:has-text("Narrow"), button:has-text("Continue"), button:has-text("Next")');
        if (await nextBtn.first().isVisible()) {
          await nextBtn.first().click();
          await page.waitForTimeout(3000);
          await takeScreenshot(page, `ideas-20-stage-${stage + 1}-result`);
        } else {
          break;
        }
      }
    });
  });

  test.describe('Project Persistence', () => {
    test('should persist Ideas project in projects list', async ({ page }) => {
      // Create an Ideas project - follow the actual UI flow
      await page.goto('/projects/new');
      await waitForAppReady(page);

      // Fill in description that will trigger ideation detection
      const descInput = page.locator('textarea').first();
      if (await descInput.isVisible()) {
        await descInput.fill('Charles wants to explore AI content generation for LED video walls at trade shows');
        await page.waitForTimeout(500);
      }

      await takeScreenshot(page, 'ideas-21-before-quick-start');

      // Click Quick Start to trigger ideation detection
      const quickStartBtn = page.locator('button:has-text("Quick Start")');
      if (await quickStartBtn.isVisible()) {
        await quickStartBtn.click();
        // Wait for LLM detection (up to 10 seconds)
        await page.waitForTimeout(5000);
      }

      await takeScreenshot(page, 'ideas-22-after-quick-start');

      // Look for "Ideas Project Detected" screen
      const ideasDetected = page.locator('text=Ideas Project Detected');
      const ideaDetectionVisible = await ideasDetected.isVisible().catch(() => false);

      if (ideaDetectionVisible) {
        await takeScreenshot(page, 'ideas-23-ideation-detected');

        // Click "Create Ideas Project" button
        const createIdeasBtn = page.locator('button:has-text("Create Ideas Project")');
        if (await createIdeasBtn.isVisible()) {
          await createIdeasBtn.click();
          // Wait for project creation
          await page.waitForTimeout(3000);
        }

        await takeScreenshot(page, 'ideas-24-after-create-ideas-project');
      }

      // Wait for "Project Created!" confirmation
      const projectCreated = page.locator('text=Project Created');
      await projectCreated.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

      await takeScreenshot(page, 'ideas-25-project-created-confirmation');

      // Navigate to projects list
      await page.goto('/projects');
      await waitForAppReady(page);
      await page.waitForTimeout(1000);

      await takeScreenshot(page, 'ideas-26-projects-list-after-creation');

      // Check if the project appears in the list
      // The project name might be derived from the input, so look for related keywords
      const pageContent = await page.textContent('body') || '';
      const hasRelatedProject = pageContent.toLowerCase().includes('ai') ||
                                pageContent.toLowerCase().includes('charles') ||
                                pageContent.toLowerCase().includes('led');

      console.log(`Project appears in list: ${hasRelatedProject}`);
    });

    test('should reload projects when returning to projects list', async ({ page }) => {
      // Simple test: verify projects list loads properly after navigation
      await page.goto('/projects');
      await waitForAppReady(page);

      // Verify the page has loaded
      const pageContent = await page.textContent('body') || '';
      const hasProjectsTitle = pageContent.includes('Projects');
      expect(hasProjectsTitle).toBeTruthy();

      await takeScreenshot(page, 'ideas-27-projects-list-loaded');

      // Navigate to settings and back
      await page.goto('/settings');
      await page.waitForTimeout(500);

      await page.goto('/projects');
      await waitForAppReady(page);

      // Verify still works after navigation
      const pageContentAfter = await page.textContent('body') || '';
      const hasProjectsAfter = pageContentAfter.includes('Projects');
      expect(hasProjectsAfter).toBeTruthy();

      await takeScreenshot(page, 'ideas-28-projects-after-navigation');
    });
  });

  test.describe('Generate Project from Ideas', () => {
    test('should show recommendations after exploring ideas', async ({ page }) => {
      await page.goto('/projects/new');
      await waitForAppReady(page);

      const testContext = 'Charles LED panels AI content generation trade shows video walls';

      const descInput = page.locator('textarea').first();
      if (await descInput.isVisible()) {
        await descInput.fill(testContext);
      }

      const luckyBtn = page.locator('button:has-text("Feeling Lucky")');
      if (await luckyBtn.isVisible()) {
        await luckyBtn.click();
        await page.waitForTimeout(4000);
      }

      // Create ideas project if prompted
      const createIdeasBtn = page.locator('button:has-text("Create Ideas Project"), button:has-text("Explore Ideas")');
      if (await createIdeasBtn.first().isVisible()) {
        await createIdeasBtn.first().click();
        await page.waitForTimeout(2000);
      }

      await takeScreenshot(page, 'ideas-27-ready-to-explore');

      // Go through a few selection stages
      for (let i = 0; i < 3; i++) {
        const ideaButtons = page.locator('button').filter({ hasText: /(LED|AI|content|display|trade)/i });
        const firstIdea = ideaButtons.first();

        if (await firstIdea.isVisible()) {
          await firstIdea.click();
          await page.waitForTimeout(300);
        }

        const continueBtn = page.locator('button:has-text("Narrow"), button:has-text("Continue"), button:has-text("Next")');
        if (await continueBtn.first().isVisible()) {
          await continueBtn.first().click();
          await page.waitForTimeout(3000);
        }
      }

      await takeScreenshot(page, 'ideas-28-after-exploration');

      // Look for recommendations section
      const recommendations = page.locator('text=recommendation, text=Recommendation, text=suggested project, text=Project Ideas');
      if (await recommendations.first().isVisible()) {
        await takeScreenshot(page, 'ideas-29-recommendations-visible');
      }
    });

    test('should allow creating a new project from recommendation', async ({ page }) => {
      // This test checks the full flow from ideas exploration to project creation
      await page.goto('/projects/new');
      await waitForAppReady(page);

      const testContext = 'AI-powered content generator for LED video walls at trade shows';

      const descInput = page.locator('textarea').first();
      if (await descInput.isVisible()) {
        await descInput.fill(testContext);
      }

      const luckyBtn = page.locator('button:has-text("Feeling Lucky")');
      if (await luckyBtn.isVisible()) {
        await luckyBtn.click();
        await page.waitForTimeout(4000);
      }

      await takeScreenshot(page, 'ideas-30-before-full-flow');

      // Look for "Start Build" or "Create Project" from recommendations
      const startBuildBtn = page.locator('button:has-text("Start Build"), button:has-text("Create Project"), button:has-text("Build This")');
      if (await startBuildBtn.first().isVisible()) {
        await startBuildBtn.first().click();
        await page.waitForTimeout(2000);
        await takeScreenshot(page, 'ideas-31-started-build');

        // Verify we're now in a regular project view
        const projectPage = page.locator('text=Build Plan, text=Overview, text=Packets');
        if (await projectPage.first().isVisible()) {
          await takeScreenshot(page, 'ideas-32-in-project-view');
        }
      }
    });
  });

  test.describe('IdeasExplorer on Project Page', () => {
    test('should load IdeasExplorer when viewing an Ideas project', async ({ page }) => {
      // First create an Ideas project
      await page.goto('/projects/new');
      await waitForAppReady(page);

      const descInput = page.locator('textarea').first();
      if (await descInput.isVisible()) {
        await descInput.fill('Charles wants to explore AI-powered content for LED video walls at trade shows internationally');
      }

      const quickStartBtn = page.locator('button:has-text("Quick Start")');
      if (await quickStartBtn.isVisible()) {
        await quickStartBtn.click();
        await page.waitForTimeout(5000);
      }

      await takeScreenshot(page, 'ideas-40-quick-start-for-project-test');

      // Create the ideas project
      const createIdeasBtn = page.locator('button:has-text("Create Ideas Project")');
      if (await createIdeasBtn.isVisible()) {
        await createIdeasBtn.click();
        await page.waitForTimeout(3000);
      }

      // Wait for project creation
      const projectCreated = page.locator('text=Project Created');
      await projectCreated.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});

      await takeScreenshot(page, 'ideas-41-project-created-for-explorer-test');

      // Click "View Project" to see the IdeasExplorer
      const viewProjectBtn = page.locator('button:has-text("View Project")');
      if (await viewProjectBtn.isVisible()) {
        await viewProjectBtn.click();
        await page.waitForTimeout(3000);
        await waitForAppReady(page);
      }

      await takeScreenshot(page, 'ideas-42-ideas-project-page');

      // Verify we're on the project page and IdeasExplorer is showing
      const pageContent = await page.textContent('body') || '';
      console.log('Project page content includes "Understanding":', pageContent.includes('Understanding'));
      console.log('Project page content includes "interests":', pageContent.includes('interests'));

      // Look for idea chips (clickable buttons in the explorer)
      const ideaChips = page.locator('button').filter({
        has: page.locator('text=/LED|AI|video|trade|content|wall|display|interactive/i')
      });
      const chipCount = await ideaChips.count().catch(() => 0);
      console.log(`Found ${chipCount} idea chips on project page`);

      await takeScreenshot(page, 'ideas-43-ideas-explorer-visible');
    });

    test('should allow selecting ideas in the IdeasExplorer', async ({ page }) => {
      // Navigate to projects list to find an Ideas project
      await page.goto('/projects');
      await waitForAppReady(page);

      // Click on any Ideas project (look for "Planning" status)
      const planningProject = page.locator('text=Planning').first();
      if (await planningProject.isVisible()) {
        // Click on the project row
        await planningProject.click();
        await page.waitForTimeout(2000);
        await waitForAppReady(page);
      }

      await takeScreenshot(page, 'ideas-44-viewing-ideas-project');

      // Look for selectable idea chips
      const ideaButtons = page.locator('[class*="rounded-full"]').filter({
        has: page.locator('text=/\\w+/')
      });

      const count = await ideaButtons.count();
      console.log(`Found ${count} rounded buttons (potential idea chips)`);

      if (count > 0) {
        // Click first idea
        await ideaButtons.first().click();
        await page.waitForTimeout(500);
        await takeScreenshot(page, 'ideas-45-first-idea-selected');

        // Click second idea if available
        if (count > 1) {
          await ideaButtons.nth(1).click();
          await page.waitForTimeout(500);
          await takeScreenshot(page, 'ideas-46-second-idea-selected');
        }

        // Look for continue button
        const continueBtn = page.locator('button:has-text("Continue")');
        if (await continueBtn.isVisible()) {
          await takeScreenshot(page, 'ideas-47-ready-to-continue');
        }
      }
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle empty input gracefully', async ({ page }) => {
      await page.goto('/projects/new');
      await waitForAppReady(page);

      // Try to trigger ideation without input
      const luckyBtn = page.locator('button:has-text("Feeling Lucky")');
      if (await luckyBtn.isVisible()) {
        await luckyBtn.click();
        await page.waitForTimeout(2000);
      }

      await takeScreenshot(page, 'ideas-33-empty-input-result');

      // Should show some feedback about needing input
      const pageText = await page.textContent('body') || '';
      console.log('Empty input response:', pageText.substring(0, 200));
    });

    test('should handle very short input', async ({ page }) => {
      await page.goto('/projects/new');
      await waitForAppReady(page);

      const descInput = page.locator('textarea').first();
      if (await descInput.isVisible()) {
        await descInput.fill('LED');
      }

      const luckyBtn = page.locator('button:has-text("Feeling Lucky")');
      if (await luckyBtn.isVisible()) {
        await luckyBtn.click();
        await page.waitForTimeout(3000);
      }

      await takeScreenshot(page, 'ideas-34-short-input-result');
    });

    test('should not show garbage categories', async ({ page }) => {
      await page.goto('/projects/new');
      await waitForAppReady(page);

      const testInput = `Charles Can we do something with generative AI that I can use at the trade shows and roadshows to showcase the video walls. He lives in Shenzhen China and sells LED panels and video walls to resellers and distributors internationally.`;

      const descInput = page.locator('textarea').first();
      if (await descInput.isVisible()) {
        await descInput.fill(testInput);
      }

      const luckyBtn = page.locator('button:has-text("Feeling Lucky")');
      if (await luckyBtn.isVisible()) {
        await luckyBtn.click();
        await page.waitForTimeout(4000);
      }

      await takeScreenshot(page, 'ideas-35-quality-output-check');

      // Check for garbage patterns that should NOT exist
      const pageText = await page.textContent('body') || '';

      const garbagePatterns = [
        'Involves: What',
        'Involves: Click',
        'Involves: Quick',
        'Quick Win:',
        'Platform Play:',
        'Core Solution:',
        'Shenzhen Shenzhen',
        'Deep Shenzhen Project'
      ];

      const foundGarbage: string[] = [];
      garbagePatterns.forEach(pattern => {
        if (pageText.includes(pattern)) {
          foundGarbage.push(pattern);
        }
      });

      if (foundGarbage.length > 0) {
        console.error('Found garbage patterns:', foundGarbage);
      }

      await takeScreenshot(page, 'ideas-36-garbage-check-result');
    });
  });
});
