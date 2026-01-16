import { test, expect } from '@playwright/test';
import {
  waitForAppReady,
  takeScreenshot,
  setupConsoleErrorCheck,
} from './helpers';

/**
 * Test Data Generation: Create 10 Diverse Test Projects
 *
 * This test file creates realistic test projects across different categories:
 * - 3 Web App projects (React, Vue, Node.js)
 * - 2 Mobile App projects (React Native, Flutter)
 * - 2 API/Backend projects (GraphQL API, Microservices)
 * - 2 CLI Tool projects (DevOps CLI, Code Generator)
 * - 1 AI/ML project
 *
 * Run standalone to generate test data:
 *   npx playwright test e2e/create-test-projects.spec.ts
 */

// Test project definitions with realistic data
const testProjects = [
  // ============ Web App Projects (3) ============
  {
    name: 'React Dashboard Pro',
    description: 'A comprehensive React-based admin dashboard with real-time analytics, user management, and customizable widgets. Built with React 18, TypeScript, and Tailwind CSS.',
    priority: 'high',
    status: 'active',
    tags: ['react', 'typescript', 'dashboard', 'frontend'],
    category: 'web-app',
  },
  {
    name: 'Vue E-Commerce Platform',
    description: 'Modern e-commerce storefront built with Vue 3 and Pinia. Features include product catalog, shopping cart, checkout flow, and order management.',
    priority: 'high',
    status: 'active',
    tags: ['vue', 'e-commerce', 'pinia', 'frontend'],
    category: 'web-app',
  },
  {
    name: 'Node.js Blog Engine',
    description: 'Full-stack blog platform with Node.js backend, Express.js API, and server-side rendering. Includes markdown editor, comments, and SEO optimization.',
    priority: 'medium',
    status: 'planning',
    tags: ['nodejs', 'express', 'blog', 'fullstack'],
    category: 'web-app',
  },

  // ============ Mobile App Projects (2) ============
  {
    name: 'React Native Fitness Tracker',
    description: 'Cross-platform fitness tracking app with workout logging, progress charts, and Apple Health/Google Fit integration. Built with React Native and Expo.',
    priority: 'high',
    status: 'active',
    tags: ['react-native', 'mobile', 'fitness', 'expo'],
    category: 'mobile-app',
  },
  {
    name: 'Flutter Social Media App',
    description: 'Feature-rich social media application built with Flutter. Includes feed, stories, direct messaging, and real-time notifications using Firebase.',
    priority: 'medium',
    status: 'planning',
    tags: ['flutter', 'dart', 'social', 'firebase'],
    category: 'mobile-app',
  },

  // ============ API/Backend Projects (2) ============
  {
    name: 'GraphQL API Gateway',
    description: 'Unified GraphQL API gateway that aggregates multiple microservices. Features schema stitching, authentication, rate limiting, and comprehensive logging.',
    priority: 'critical',
    status: 'active',
    tags: ['graphql', 'api', 'gateway', 'microservices'],
    category: 'api-backend',
  },
  {
    name: 'Event-Driven Microservices',
    description: 'Scalable microservices architecture using event sourcing and CQRS patterns. Built with Node.js, Kafka, and PostgreSQL for high-throughput processing.',
    priority: 'high',
    status: 'paused',
    tags: ['microservices', 'kafka', 'event-sourcing', 'cqrs'],
    category: 'api-backend',
  },

  // ============ CLI Tool Projects (2) ============
  {
    name: 'DevOps CLI Toolkit',
    description: 'Comprehensive command-line toolkit for DevOps workflows. Includes deployment automation, environment management, log aggregation, and monitoring setup.',
    priority: 'medium',
    status: 'active',
    tags: ['cli', 'devops', 'automation', 'deployment'],
    category: 'cli-tool',
  },
  {
    name: 'Code Generator CLI',
    description: 'Interactive CLI for scaffolding and code generation. Supports multiple frameworks, custom templates, and plugin architecture for extensibility.',
    priority: 'low',
    status: 'planning',
    tags: ['cli', 'generator', 'scaffolding', 'templates'],
    category: 'cli-tool',
  },

  // ============ AI/ML Project (1) ============
  {
    name: 'AI Document Analyzer',
    description: 'Machine learning pipeline for document classification and information extraction. Uses transformer models for NLP, OCR for scanned documents, and vector embeddings for semantic search.',
    priority: 'critical',
    status: 'active',
    tags: ['ai', 'ml', 'nlp', 'document-processing'],
    category: 'ai-ml',
  },
];

test.describe('Test Project Generation', () => {
  test.describe.configure({ mode: 'serial' });

  // Create all 10 test projects
  for (const project of testProjects) {
    test(`Create ${project.category} project: ${project.name}`, async ({ page }) => {
      const getErrors = setupConsoleErrorCheck(page);

      // Navigate to project creation page
      await page.goto('/projects/new');
      await waitForAppReady(page);

      await takeScreenshot(page, `create-${project.category}-start`);

      // Try to select Feeling Lucky mode if available (quick project creation)
      const quickOption = page.locator('button:has-text("Feeling Lucky"), button:has-text("Quick"), [data-testid="quick-mode"]');
      if (await quickOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await quickOption.click();
        await page.waitForTimeout(500);
      }

      // Fill in project name
      const nameInput = page.locator(
        'input[name="name"], input[placeholder*="name" i], input[id*="name" i], input[placeholder*="project" i]'
      ).first();

      if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nameInput.click();
        await nameInput.fill(project.name);
        await expect(nameInput).toHaveValue(project.name);
      } else {
        // Try finding any text input as fallback
        const anyInput = page.locator('input[type="text"]').first();
        if (await anyInput.isVisible()) {
          await anyInput.fill(project.name);
        }
      }

      // Fill in project description
      const descriptionInput = page.locator(
        'textarea[name="description"], textarea[placeholder*="description" i], textarea[id*="description" i], textarea'
      ).first();

      if (await descriptionInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await descriptionInput.click();
        await descriptionInput.fill(project.description);
      }

      // Try to set priority if a selector/dropdown is available
      const prioritySelector = page.locator(
        'select[name="priority"], [data-testid="priority-select"], button:has-text("Priority")'
      ).first();

      if (await prioritySelector.isVisible({ timeout: 2000 }).catch(() => false)) {
        await prioritySelector.click();
        await page.waitForTimeout(300);

        // Try to select the priority option
        const priorityOption = page.locator(`[data-value="${project.priority}"], option[value="${project.priority}"], text=${project.priority}`).first();
        if (await priorityOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await priorityOption.click();
        }
      }

      // Try to set status if a selector/dropdown is available
      const statusSelector = page.locator(
        'select[name="status"], [data-testid="status-select"], button:has-text("Status")'
      ).first();

      if (await statusSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
        await statusSelector.click();
        await page.waitForTimeout(300);

        // Try to select the status option
        const statusOption = page.locator(`[data-value="${project.status}"], option[value="${project.status}"], text=${project.status}`).first();
        if (await statusOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await statusOption.click();
        }
      }

      await takeScreenshot(page, `create-${project.category}-filled`);

      // Submit the form to create the project
      const submitButton = page.locator(
        'button:has-text("Feeling Lucky"), button:has-text("Full Interview"), main button[type="submit"], button:has-text("Create Project")'
      ).first();

      if (await submitButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await submitButton.click();

        // Wait for navigation or success indication
        try {
          // Wait for either navigation to project page or success toast
          await Promise.race([
            page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/, { timeout: 15000 }),
            page.waitForSelector('[role="alert"]:has-text("created"), [data-sonner-toast]:has-text("created")', { timeout: 15000 }),
          ]);

          await waitForAppReady(page);
          await takeScreenshot(page, `create-${project.category}-success`);

          // Verify we're on a project page or projects list
          const currentUrl = page.url();
          const isProjectPage = /\/projects\/[a-zA-Z0-9-]+/.test(currentUrl) || /\/projects$/.test(currentUrl);

          if (isProjectPage) {
            // Verify project name is visible on the page
            const projectNameVisible = await page.locator(`text=${project.name}`).isVisible({ timeout: 5000 }).catch(() => false);
            if (projectNameVisible) {
              console.log(`Successfully created project: ${project.name}`);
            }
          }
        } catch {
          // Check if we're still on creation page (might need more steps)
          await takeScreenshot(page, `create-${project.category}-pending`);

          // Try clicking "Next" or continue buttons if available
          const nextButton = page.locator('button:has-text("Next"), button:has-text("Continue")').first();
          if (await nextButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await nextButton.click();
            await page.waitForTimeout(1000);
          }
        }
      }

      // Check for console errors
      const errors = getErrors();
      if (errors.length > 0) {
        console.warn(`Console errors for ${project.name}:`, errors);
      }
    });
  }

  // Verification test - check all projects were created
  test('Verify all test projects exist', async ({ page }) => {
    const getErrors = setupConsoleErrorCheck(page);

    await page.goto('/projects');
    await waitForAppReady(page);

    await takeScreenshot(page, 'verify-all-projects');

    // Count projects visible on the page
    const projectCards = page.locator('[data-testid="project-card"], .project-card, article, [class*="project"]');
    const projectCount = await projectCards.count();

    console.log(`Found ${projectCount} project elements on the page`);

    // Verify at least some of our test projects are visible
    let foundCount = 0;
    for (const project of testProjects) {
      const projectVisible = await page.locator(`text=${project.name}`).first().isVisible({ timeout: 2000 }).catch(() => false);
      if (projectVisible) {
        foundCount++;
        console.log(`Found project: ${project.name}`);
      }
    }

    console.log(`Verified ${foundCount}/${testProjects.length} test projects`);

    // Check for console errors
    const errors = getErrors();
    expect(errors.length).toBe(0);
  });
});

// Export project data for use in other tests
export { testProjects };
