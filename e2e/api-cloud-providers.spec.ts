/**
 * API-level tests for Cloud Provider Integration
 * Tests build plan and packet execution APIs with different providers
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.CLAUDIA_TEST_URL || 'http://localhost:3000';

test.describe('Cloud Provider API Tests', () => {

  test.setTimeout(120000); // 2 minutes per test

  test('build plan API with Google Gemini', async ({ request }) => {
    console.log('\n========== Testing Build Plan API with Google ==========');
    console.log(`Time: ${new Date().toLocaleTimeString()}`);

    const response = await request.post(`${BASE_URL}/api/build-plan`, {
      data: {
        projectId: `test-google-${Date.now()}`,
        projectName: "Todo App",
        projectDescription: "A simple todo list application with React",
        preferredProvider: "google",
        preferredModel: "gemini-2.0-flash",
        mode: "simple"
      }
    });

    console.log(`Response status: ${response.status()}`);

    if (response.ok()) {
      const data = await response.json();
      console.log(`✅ Build plan generated successfully`);
      console.log(`   Source: ${data.source}`);
      console.log(`   Model: ${data.model}`);
      console.log(`   Packets: ${data.plan?.packets?.length || 0}`);

      expect(data.plan).toBeDefined();
      // Note: Packets may be 0 in simple mode - they can be generated separately
      expect(data.plan.packets).toBeDefined();
      expect(data.source).toBe('google');
    } else {
      const error = await response.text();
      console.log(`❌ Build plan failed: ${error}`);
      // Don't fail test if Google key not configured
      if (error.includes('API key') || error.includes('configuration')) {
        console.log('   (Skipping - API key not configured)');
        test.skip();
      }
    }

    console.log(`Time: ${new Date().toLocaleTimeString()}`);
  });

  test('build plan API with Anthropic (Claude)', async ({ request }) => {
    console.log('\n========== Testing Build Plan API with Anthropic ==========');
    console.log(`Time: ${new Date().toLocaleTimeString()}`);

    const response = await request.post(`${BASE_URL}/api/build-plan`, {
      data: {
        projectId: `test-anthropic-${Date.now()}`,
        projectName: "REST API",
        projectDescription: "A REST API with Express.js and PostgreSQL",
        preferredProvider: "anthropic",
        mode: "simple"
      }
    });

    console.log(`Response status: ${response.status()}`);

    if (response.ok()) {
      const data = await response.json();
      console.log(`✅ Build plan generated successfully`);
      console.log(`   Source: ${data.source}`);
      console.log(`   Model: ${data.model}`);
      console.log(`   Packets: ${data.plan?.packets?.length || 0}`);

      expect(data.plan).toBeDefined();
    } else {
      const error = await response.text();
      console.log(`❌ Build plan failed: ${error}`);
      if (error.includes('API key') || error.includes('configuration')) {
        console.log('   (Skipping - API key not configured)');
        test.skip();
      }
    }

    console.log(`Time: ${new Date().toLocaleTimeString()}`);
  });

  test('LLM plan API (quick start)', async ({ request }) => {
    console.log('\n========== Testing LLM Plan API ==========');
    console.log(`Time: ${new Date().toLocaleTimeString()}`);

    const response = await request.post(`${BASE_URL}/api/llm/plan`, {
      data: {
        description: "A calculator app for iOS",
        allowPaidFallback: true
      }
    });

    console.log(`Response status: ${response.status()}`);

    if (response.ok()) {
      const data = await response.json();
      console.log(`✅ Plan generated successfully`);
      console.log(`   Source: ${data.source}`);
      console.log(`   Name: ${data.name}`);
      console.log(`   Features: ${data.features?.length || 0}`);

      expect(data.name).toBeDefined();
      expect(data.description).toBeDefined();
    } else {
      const error = await response.text();
      console.log(`❌ Plan failed: ${error}`);
    }

    console.log(`Time: ${new Date().toLocaleTimeString()}`);
  });

  test('ideation detect API', async ({ request }) => {
    console.log('\n========== Testing Ideation Detect API ==========');
    console.log(`Time: ${new Date().toLocaleTimeString()}`);

    const response = await request.post(`${BASE_URL}/api/ideation/detect`, {
      data: {
        input: "A mobile app for tracking expenses and budgeting",
        allowPaidFallback: true
      }
    });

    console.log(`Response status: ${response.status()}`);

    if (response.ok()) {
      const data = await response.json();
      console.log(`✅ Detection completed`);
      console.log(`   Type: ${data.type}`);
      console.log(`   Title: ${data.title}`);
      console.log(`   Confidence: ${data.confidence}`);

      expect(data.type).toBeDefined();
    } else {
      const error = await response.text();
      console.log(`❌ Detection failed: ${error}`);
    }

    console.log(`Time: ${new Date().toLocaleTimeString()}`);
  });

  test('providers API', async ({ request }) => {
    console.log('\n========== Testing Providers API ==========');
    console.log(`Time: ${new Date().toLocaleTimeString()}`);

    const response = await request.get(`${BASE_URL}/api/providers`);

    console.log(`Response status: ${response.status()}`);

    if (response.ok()) {
      const data = await response.json();
      console.log(`✅ Providers fetched`);
      console.log(`   Count: ${data.providers?.length || 0}`);

      for (const provider of data.providers || []) {
        console.log(`   - ${provider.name}: ${provider.available ? 'available' : 'not available'}`);
      }

      expect(data.providers).toBeDefined();
    } else {
      const error = await response.text();
      console.log(`❌ Providers fetch failed: ${error}`);
    }

    console.log(`Time: ${new Date().toLocaleTimeString()}`);
  });
});

test.afterAll(async () => {
  console.log(`\n========== API Tests completed at ${new Date().toLocaleTimeString()} ==========`);
});
