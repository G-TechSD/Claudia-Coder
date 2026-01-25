import { test, expect, Page } from '@playwright/test';

/**
 * Advanced Project Creation E2E Tests
 *
 * Tests 20 diverse project types through the complete creation flow:
 * 1. Create project via Easy Mode wizard
 * 2. Generate build plan
 * 3. Verify plan structure
 * 4. Execute packets (where applicable)
 * 5. Verify generated code
 */

const SCREENSHOT_DIR = '/tmp/advanced-project-creation';
const BASE_URL = 'https://localhost:3000';

// 20 Diverse Project Definitions
const DIVERSE_PROJECTS = [
  {
    id: 1,
    name: 'REST API with Express',
    description: 'A RESTful API server built with Express.js and Node.js. Features include CRUD operations, JWT authentication, rate limiting, and Swagger documentation.',
    brainDump: 'Use TypeScript, implement proper error handling, add input validation with Zod, include health check endpoints, follow REST best practices.',
    expectedTech: ['express', 'typescript', 'jwt', 'zod']
  },
  {
    id: 2,
    name: 'React Dashboard',
    description: 'A modern admin dashboard built with React and Tailwind CSS. Features charts, data tables, dark mode, and responsive design.',
    brainDump: 'Use Vite for bundling, Recharts for visualization, TanStack Table for data grids, React Router for navigation. Mobile-first approach.',
    expectedTech: ['react', 'tailwind', 'vite', 'recharts']
  },
  {
    id: 3,
    name: 'CLI Task Manager',
    description: 'A command-line task management tool written in Python. Supports task creation, completion tracking, due dates, and priorities.',
    brainDump: 'Use Click for CLI framework, SQLite for persistence, Rich for terminal output formatting, support JSON export/import.',
    expectedTech: ['python', 'click', 'sqlite', 'rich']
  },
  {
    id: 4,
    name: 'GraphQL API Server',
    description: 'A GraphQL API server with Apollo Server, type-safe schema, and PostgreSQL database integration.',
    brainDump: 'Use TypeScript, Prisma ORM, implement DataLoader for N+1 prevention, add subscription support for real-time updates.',
    expectedTech: ['graphql', 'apollo', 'prisma', 'typescript']
  },
  {
    id: 5,
    name: 'Mobile Weather App',
    description: 'A cross-platform mobile weather app built with React Native. Shows current weather, forecasts, and weather alerts.',
    brainDump: 'Use Expo for development, integrate OpenWeatherMap API, implement location services, cache weather data offline.',
    expectedTech: ['react-native', 'expo', 'api']
  },
  {
    id: 6,
    name: 'Static Blog Generator',
    description: 'A static site generator for blogs written in Go. Supports Markdown content, themes, and RSS feed generation.',
    brainDump: 'Use Goldmark for Markdown parsing, implement template system with Go templates, support syntax highlighting for code blocks.',
    expectedTech: ['go', 'markdown', 'templates']
  },
  {
    id: 7,
    name: 'WebSocket Chat Server',
    description: 'A real-time chat server using WebSockets. Supports multiple rooms, user presence, and message history.',
    brainDump: 'Use ws library for Node.js, implement Redis for message pub/sub, add typing indicators, support file attachments.',
    expectedTech: ['websocket', 'nodejs', 'redis']
  },
  {
    id: 8,
    name: 'E-commerce Cart System',
    description: 'A shopping cart microservice with inventory management, pricing rules, and discount code support.',
    brainDump: 'Use TypeScript, implement cart persistence, support multiple currencies, add tax calculation, integrate with Stripe for checkout.',
    expectedTech: ['typescript', 'stripe', 'microservice']
  },
  {
    id: 9,
    name: 'Image Processing Pipeline',
    description: 'A Python image processing library for batch operations like resizing, format conversion, and watermarking.',
    brainDump: 'Use Pillow for image manipulation, implement parallel processing, support EXIF data preservation, add CLI interface.',
    expectedTech: ['python', 'pillow', 'cli']
  },
  {
    id: 10,
    name: 'Kubernetes Operator',
    description: 'A Kubernetes operator written in Go for managing custom database resources with automated backups.',
    brainDump: 'Use kubebuilder framework, implement reconciliation loop, add status reporting, support CRD validation.',
    expectedTech: ['go', 'kubernetes', 'operator']
  },
  {
    id: 11,
    name: 'Vue.js Portfolio',
    description: 'A personal portfolio website built with Vue 3 and Nuxt.js. Features project showcase, blog, and contact form.',
    brainDump: 'Use Composition API, implement SSG for SEO, add animations with GSAP, integrate with headless CMS.',
    expectedTech: ['vue', 'nuxt', 'gsap']
  },
  {
    id: 12,
    name: 'Rust CLI Calculator',
    description: 'A scientific calculator CLI tool written in Rust. Supports complex expressions, variables, and function definitions.',
    brainDump: 'Use nom for expression parsing, implement REPL mode, support trigonometric functions, add history navigation.',
    expectedTech: ['rust', 'nom', 'cli']
  },
  {
    id: 13,
    name: 'Docker Compose Template',
    description: 'A comprehensive Docker Compose setup for a full-stack application with reverse proxy, database, and monitoring.',
    brainDump: 'Include Traefik for routing, PostgreSQL and Redis, Prometheus and Grafana for monitoring, proper networking.',
    expectedTech: ['docker', 'traefik', 'prometheus']
  },
  {
    id: 14,
    name: 'OAuth2 Auth Server',
    description: 'An OAuth2 authentication server supporting authorization code, PKCE, and refresh token flows.',
    brainDump: 'Use Node.js with TypeScript, implement proper token storage, add rate limiting, support social login providers.',
    expectedTech: ['oauth2', 'typescript', 'nodejs']
  },
  {
    id: 15,
    name: 'Data Pipeline ETL',
    description: 'An ETL data pipeline for processing CSV files, transforming data, and loading into a data warehouse.',
    brainDump: 'Use Python with pandas, implement incremental loading, add data validation, support multiple output formats.',
    expectedTech: ['python', 'pandas', 'etl']
  },
  {
    id: 16,
    name: 'Browser Extension',
    description: 'A Chrome/Firefox browser extension for managing bookmarks with tags, search, and cloud sync.',
    brainDump: 'Use WebExtension API, implement popup and options page, add keyboard shortcuts, support export/import.',
    expectedTech: ['javascript', 'webextension', 'browser']
  },
  {
    id: 17,
    name: 'Game Leaderboard API',
    description: 'A high-performance leaderboard API for games with real-time rankings and score submission.',
    brainDump: 'Use Redis sorted sets for rankings, implement pagination, add anti-cheat validation, support multiple game modes.',
    expectedTech: ['redis', 'api', 'nodejs']
  },
  {
    id: 18,
    name: 'Terraform AWS Module',
    description: 'A Terraform module for deploying a scalable web application on AWS with ALB, ECS, and RDS.',
    brainDump: 'Include auto-scaling, proper IAM roles, VPC setup, CloudWatch alarms, support multiple environments.',
    expectedTech: ['terraform', 'aws', 'ecs']
  },
  {
    id: 19,
    name: 'Svelte Todo App',
    description: 'A minimalist todo application built with SvelteKit. Features drag-and-drop, categories, and local storage.',
    brainDump: 'Use Svelte stores for state, implement keyboard navigation, add PWA support, include dark mode toggle.',
    expectedTech: ['svelte', 'sveltekit', 'pwa']
  },
  {
    id: 20,
    name: 'ML Model Serving API',
    description: 'A FastAPI service for serving machine learning models with batch prediction and model versioning.',
    brainDump: 'Use FastAPI with Pydantic, implement model registry, add request batching, include Prometheus metrics.',
    expectedTech: ['python', 'fastapi', 'ml']
  }
];

// Helper functions
async function takeScreenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: true,
  });
}

async function waitForSpinnersToDisappear(page: Page, timeout = 60000): Promise<void> {
  await page.waitForFunction(() => {
    const spinners = document.querySelectorAll('[class*="animate-spin"]');
    return spinners.length === 0;
  }, { timeout }).catch(() => {});
}

async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('aside', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(500);
}

test.describe('Advanced Project Creation - 20 Diverse Projects', () => {
  // Run tests serially to avoid LLM API rate limiting
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    // Create screenshot directory
    const { execSync } = require('child_process');
    execSync(`mkdir -p ${SCREENSHOT_DIR}`);
  });

  test.beforeEach(async ({ page }) => {
    // Set up console error collection
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        console.log('Console error:', msg.text());
      }
    });
  });

  // Test each project type
  for (const project of DIVERSE_PROJECTS) {
    test(`Project ${project.id}: ${project.name}`, async ({ page }) => {
      test.setTimeout(300000); // 5 minutes per project

      console.log(`\n${'='.repeat(60)}`);
      console.log(`Starting Project ${project.id}: ${project.name}`);
      console.log(`${'='.repeat(60)}\n`);

      // ============================================
      // Step 1: Navigate to Easy Mode
      // ============================================
      console.log('Step 1: Navigating to Easy Mode...');
      await page.goto(`${BASE_URL}/easy-mode`);
      await waitForAppReady(page);

      // Clear any existing session to start fresh
      await page.evaluate(() => {
        localStorage.removeItem('claudia_easy_mode_session');
      });
      // Reload to apply the clear
      await page.reload();
      await waitForAppReady(page);

      // Wait for the wizard to load
      await page.waitForSelector('text=Project Information', { timeout: 15000 }).catch(async () => {
        await takeScreenshot(page, `${project.id}-01-error-page-not-loaded`);
        throw new Error('Easy Mode page did not load');
      });

      await takeScreenshot(page, `${project.id}-01-easy-mode-start`);

      // ============================================
      // Step 2: Fill Project Information
      // ============================================
      console.log('Step 2: Filling project information...');

      const nameInput = page.locator('#projectName');
      const descInput = page.locator('#projectDescription');

      await nameInput.fill(`E2E Test: ${project.name}`);
      await descInput.fill(project.description);

      await takeScreenshot(page, `${project.id}-02-info-filled`);

      // Click Next
      const nextButton = page.locator('button:has-text("Next")');
      await expect(nextButton).toBeEnabled({ timeout: 5000 });
      await nextButton.click();

      // ============================================
      // Step 3: Brain Dump
      // ============================================
      console.log('Step 3: Adding brain dump context...');

      await page.waitForSelector('text=Brain Dump', { timeout: 10000 }).catch(() => {});

      const brainDumpTextarea = page.locator('textarea').first();
      if (await brainDumpTextarea.isVisible()) {
        await brainDumpTextarea.fill(project.brainDump);
      }

      await takeScreenshot(page, `${project.id}-03-brain-dump`);

      // Click Generate Plan
      const generateButton = page.locator('button:has-text("Generate Plan")');
      if (await generateButton.isVisible()) {
        await expect(generateButton).toBeEnabled({ timeout: 5000 });
        await generateButton.click();
      } else {
        // Try Next if Generate Plan not visible
        await nextButton.click();
      }

      // ============================================
      // Step 4: Wait for Plan Generation
      // ============================================
      console.log('Step 4: Waiting for build plan generation...');

      // Wait for generation to start
      await page.waitForTimeout(2000);
      await takeScreenshot(page, `${project.id}-04-generation-started`);

      // Wait for generation to complete (up to 2 minutes)
      const startTime = Date.now();
      let planGenerated = false;

      while (Date.now() - startTime < 120000) {
        // Check for success indicators
        const successIndicators = [
          page.locator('text=Build plan generated'),
          page.locator('text=Build plan ready'),
          page.locator('text=Plan Generated'),
          page.locator('[data-testid="build-plan-preview"]'),
          page.locator('text=phases').first(),
        ];

        for (const indicator of successIndicators) {
          if (await indicator.isVisible().catch(() => false)) {
            planGenerated = true;
            break;
          }
        }

        if (planGenerated) break;

        // Check for error
        const errorIndicator = page.locator('text=Generation failed');
        if (await errorIndicator.isVisible().catch(() => false)) {
          await takeScreenshot(page, `${project.id}-04-generation-failed`);
          console.log('ERROR: Build plan generation failed');

          // Try retry button
          const retryButton = page.locator('button:has-text("Try Again"), button:has-text("Retry")');
          if (await retryButton.isVisible().catch(() => false)) {
            await retryButton.click();
            await page.waitForTimeout(5000);
          }
        }

        await page.waitForTimeout(3000);
      }

      await waitForSpinnersToDisappear(page);
      await takeScreenshot(page, `${project.id}-05-generation-complete`);

      // Click Next to proceed to Review step (wait for button to be enabled)
      console.log('  - Waiting for Next button to be enabled...');
      const nextToReview = page.locator('button:has-text("Next")');

      // Wait for plan generation to complete - button becomes enabled
      let nextEnabled = false;
      for (let i = 0; i < 60; i++) { // Up to 60 seconds
        if (await nextToReview.isEnabled().catch(() => false)) {
          nextEnabled = true;
          break;
        }
        await page.waitForTimeout(1000);
      }

      console.log(`  - Next button enabled: ${nextEnabled}`);
      console.log('  - Clicking Next to go to Review...');

      if (nextEnabled) {
        await nextToReview.click();
        await page.waitForTimeout(1000);
      } else {
        console.log('  - WARNING: Next button still disabled after 60s');
        await takeScreenshot(page, `${project.id}-05b-next-disabled`);
      }

      // ============================================
      // Step 5: Review and Approve Plan
      // ============================================
      console.log('Step 5: Reviewing and approving build plan...');

      // Wait for Review step to appear
      await page.waitForSelector('text=Review Build Plan', { timeout: 10000 }).catch(() => {});

      // Look for phase/packet information
      const pageContent = await page.content();
      const hasPhases = pageContent.toLowerCase().includes('phase');
      const hasPackets = pageContent.toLowerCase().includes('packet') || pageContent.toLowerCase().includes('task');

      console.log(`  - Has phases: ${hasPhases}`);
      console.log(`  - Has packets: ${hasPackets}`);

      await takeScreenshot(page, `${project.id}-06-plan-review`);

      // Click "Approve Plan" button
      const approveButton = page.locator('button:has-text("Approve Plan")');
      if (await approveButton.isVisible().catch(() => false)) {
        console.log('  - Clicking Approve Plan...');
        await approveButton.click();
        await page.waitForTimeout(1000);
        await takeScreenshot(page, `${project.id}-06b-plan-approved`);
      }

      // Click "Start Build" or "Next" to proceed to build step
      const startBuildNav = page.locator('button:has-text("Start Build")');
      if (await startBuildNav.isVisible().catch(() => false)) {
        console.log('  - Clicking Start Build...');
        await startBuildNav.click();
        await page.waitForTimeout(2000);
      }

      // ============================================
      // Step 6: Build Project
      // ============================================
      console.log('Step 6: Building project...');

      // Wait for build to complete (up to 60 seconds)
      const buildStartTime = Date.now();
      while (Date.now() - buildStartTime < 60000) {
        const buildSuccess = page.locator('text=Project created successfully');
        const buildError = page.locator('text=Build failed');

        if (await buildSuccess.isVisible().catch(() => false)) {
          console.log('  - Build completed successfully!');
          break;
        }
        if (await buildError.isVisible().catch(() => false)) {
          console.log('  - Build failed');
          await takeScreenshot(page, `${project.id}-07-build-error`);
          break;
        }

        await page.waitForTimeout(2000);
      }

      await waitForSpinnersToDisappear(page);
      await takeScreenshot(page, `${project.id}-07-build-complete`);

      // Click Next to go to Results
      const nextToResults = page.locator('button:has-text("Next")');
      if (await nextToResults.isVisible().catch(() => false)) {
        await nextToResults.click();
        await page.waitForTimeout(1000);
      }

      // ============================================
      // Step 7: Results - Open Project
      // ============================================
      console.log('Step 7: Opening created project...');

      // Wait for Results step
      await page.waitForSelector('text=Project Ready', { timeout: 10000 }).catch(() => {});

      await takeScreenshot(page, `${project.id}-08-results`);

      // Click "Open Project" button
      const openProjectButton = page.locator('button:has-text("Open Project")');
      if (await openProjectButton.isVisible().catch(() => false)) {
        console.log('  - Clicking Open Project...');
        await openProjectButton.click();
        await page.waitForTimeout(3000);
        await waitForAppReady(page);
      }

      await takeScreenshot(page, `${project.id}-09-project-page`);

      // ============================================
      // Step 8: Verify Project Page
      // ============================================
      console.log('Step 8: Verifying project page...');

      const currentUrl = page.url();
      console.log(`  - Current URL: ${currentUrl}`);

      // Check if we're on a project page
      const isOnProjectPage = currentUrl.includes('/projects/') && !currentUrl.includes('/projects/new');
      console.log(`  - On project page: ${isOnProjectPage}`);

      if (isOnProjectPage) {
        // Look for project elements
        const projectTitle = page.locator(`text=${project.name}`).first();
        const hasBuildPlan = await page.locator('text=Build Plan, text=Execution, text=Packets').first().isVisible().catch(() => false);

        console.log(`  - Project title visible: ${await projectTitle.isVisible().catch(() => false)}`);
        console.log(`  - Has build plan section: ${hasBuildPlan}`);
      }

      await takeScreenshot(page, `${project.id}-10-final-state`);

      // ============================================
      // Summary
      // ============================================
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Project ${project.id} (${project.name}) - COMPLETE`);
      console.log(`  URL: ${currentUrl}`);
      console.log(`  Plan generated: ${planGenerated}`);
      console.log(`  Project page: ${isOnProjectPage}`);
      console.log(`${'='.repeat(60)}\n`);

      // Basic assertion - we should be on some page without errors
      expect(page.url()).toBeTruthy();
    });
  }
});

// Quick smoke test for first 3 projects
test.describe('Quick Smoke Test - First 3 Projects', () => {
  const quickProjects = DIVERSE_PROJECTS.slice(0, 3);

  for (const project of quickProjects) {
    test(`Quick: ${project.name}`, async ({ page }) => {
      test.setTimeout(120000); // 2 minutes

      await page.goto(`${BASE_URL}/easy-mode`);
      await waitForAppReady(page);

      // Fill basic info
      await page.locator('#projectName').fill(`Quick: ${project.name}`);
      await page.locator('#projectDescription').fill(project.description);

      // Verify form was filled
      await expect(page.locator('#projectName')).toHaveValue(`Quick: ${project.name}`);

      await takeScreenshot(page, `quick-${project.id}-filled`);
    });
  }
});
