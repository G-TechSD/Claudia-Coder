/**
 * Test Execution Script
 *
 * Tests the packet execution pipeline end-to-end.
 * Run with: npx tsx scripts/test-execution.ts
 */

import * as fs from 'fs'
import * as path from 'path'

// Load .env.local BEFORE importing LLM module
const envPath = path.join(__dirname, '..', '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=')
      const value = valueParts.join('=')
      if (key && value !== undefined) {
        process.env[key] = value
      }
    }
  }
  console.log('Loaded .env.local')
  console.log('LMSTUDIO_BEAST:', process.env.NEXT_PUBLIC_LMSTUDIO_BEAST)
  console.log('LMSTUDIO_BEDROOM:', process.env.NEXT_PUBLIC_LMSTUDIO_BEDROOM)
}

// Now dynamically import the LLM module after env is loaded
async function runTests() {
  const { generateWithLocalLLM, checkServerStatus, getConfiguredServers } = await import('../src/lib/llm/local-llm')

  // Configuration
  // LM Studio server URLs - configured via environment variables
  const LM_STUDIO_BEAST = process.env.NEXT_PUBLIC_LMSTUDIO_BEAST || 'http://localhost:1234'
  const LM_STUDIO_BEDROOM = process.env.NEXT_PUBLIC_LMSTUDIO_BEDROOM || ''

  interface TestResult {
    test: string
    passed: boolean
    duration: number
    details?: string
    error?: string
  }

  const results: TestResult[] = []

  function log(message: string) {
    console.log(`[${new Date().toISOString()}] ${message}`)
  }

  async function test(name: string, fn: () => Promise<void>): Promise<void> {
    const start = Date.now()
    try {
      log(`Running: ${name}`)
      await fn()
      results.push({
        test: name,
        passed: true,
        duration: Date.now() - start
      })
      log(`✓ PASSED: ${name} (${Date.now() - start}ms)`)
    } catch (error) {
      results.push({
        test: name,
        passed: false,
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : String(error)
      })
      log(`✗ FAILED: ${name} - ${error}`)
    }
  }

  // Test LLM Server Connectivity
  async function testLLMServers() {
    const servers = getConfiguredServers()
    log(`  Found ${servers.length} configured servers`)

    if (servers.length === 0) {
      throw new Error('No servers configured. Check NEXT_PUBLIC_LMSTUDIO_BEAST and NEXT_PUBLIC_LMSTUDIO_BEDROOM env vars')
    }

    for (const server of servers) {
      log(`  Checking ${server.name} at ${server.url}...`)
      const status = await checkServerStatus(server)
      if (status.status !== 'online') {
        throw new Error(`${server.name} is not online`)
      }
      log(`  ${server.name}: ${status.currentModel}`)
    }
  }

  // Test Code Generation
  async function testCodeGeneration() {
    const systemPrompt = `You are a senior developer implementing features.
Output ONLY valid code. Use this format for each file:

=== FILE: path/to/file.ts ===
\`\`\`typescript
// file contents here
\`\`\`

Rules:
- Output complete, working code
- Do not explain - just write code`

    const userPrompt = `PROJECT: Example App
TECH STACK: Next.js, TypeScript, Tailwind CSS

FEATURE: Create a simple hello world page
Create a basic Next.js page that displays "Welcome to Example App".

ACCEPTANCE CRITERIA:
- Page displays "Welcome to Example App" heading
- Uses Tailwind CSS for styling
- Located at /app/page.tsx

Generate the code to complete this task.`

    const result = await generateWithLocalLLM(systemPrompt, userPrompt, {
      temperature: 0.3,
      max_tokens: 2048
    })

    if (result.error) {
      throw new Error(`LLM error: ${result.error}`)
    }

    if (!result.content) {
      throw new Error('No content generated')
    }

    log(`  Generated ${result.content.length} chars using ${result.server}/${result.model}`)

    // Check for expected output format
    if (!result.content.includes('=== FILE:') && !result.content.includes('```')) {
      throw new Error('Output does not match expected format')
    }

    // Parse and validate
    const filePattern = /===\s*FILE:\s*(.+?)\s*===\s*\n```\w*\n([\s\S]*?)```/g
    const files: { path: string; content: string }[] = []
    let match
    while ((match = filePattern.exec(result.content)) !== null) {
      files.push({ path: match[1].trim(), content: match[2].trim() })
    }

    if (files.length === 0) {
      log(`  Warning: No files parsed, raw output:`)
      log(`  ${result.content.slice(0, 500)}...`)
      throw new Error('No files could be parsed from output')
    }

    log(`  Parsed ${files.length} file(s): ${files.map(f => f.path).join(', ')}`)

    // Validate code looks reasonable
    for (const file of files) {
      if (file.content.length < 10) {
        throw new Error(`File ${file.path} has suspiciously short content`)
      }
    }
  }

  // Test Complex Code Generation
  async function testComplexCodeGeneration() {
    const systemPrompt = `You are a senior developer implementing features.
Output ONLY valid code. Use this format for each file:

=== FILE: path/to/file.ts ===
\`\`\`typescript
// file contents here
\`\`\`

Rules:
- Output complete, working code
- Use proper imports and exports
- Follow existing code patterns
- Do not explain - just write code
- Create all necessary files`

    const userPrompt = `PROJECT: Example App
TECH STACK: Next.js 14, TypeScript, Tailwind CSS, React

FEATURE: Encrypted SQLite Database Setup
Implement an encrypted SQLite database for storing patient health records.

TASKS TO COMPLETE:
1. Create database schema for patient records
2. Implement encryption layer using AES-256
3. Create CRUD operations for records
4. Add TypeScript interfaces for data types

ACCEPTANCE CRITERIA:
- Database uses SQLite with better-sqlite3
- All data is encrypted at rest
- TypeScript interfaces for all data types
- Basic CRUD operations work

Generate all the code needed to complete this feature.`

    const result = await generateWithLocalLLM(systemPrompt, userPrompt, {
      temperature: 0.3,
      max_tokens: 4096,
      preferredServer: 'Beast'  // Use the larger model
    })

    if (result.error) {
      throw new Error(`LLM error: ${result.error}`)
    }

    log(`  Generated ${result.content.length} chars using ${result.server}/${result.model}`)

    // Parse files
    const filePattern = /===\s*FILE:\s*(.+?)\s*===\s*\n```\w*\n([\s\S]*?)```/g
    const files: { path: string; content: string }[] = []
    let match
    while ((match = filePattern.exec(result.content)) !== null) {
      files.push({ path: match[1].trim(), content: match[2].trim() })
    }

    log(`  Parsed ${files.length} file(s)`)
    files.forEach(f => log(`    - ${f.path} (${f.content.length} chars)`))

    if (files.length === 0) {
      // Check for alternative formats
      log(`  Raw output preview: ${result.content.slice(0, 1000)}`)
      throw new Error('No files parsed from complex generation')
    }

    // Validate we got multiple files for a complex feature
    if (files.length < 2) {
      log(`  Warning: Expected multiple files for complex feature, got ${files.length}`)
    }
  }

  // Test Self-Critique
  async function testSelfCritique() {
    const systemPrompt = `You are a senior code reviewer evaluating generated code.
Be critical and thorough. Output your analysis as JSON:

{
  "issues": ["list of problems found"],
  "suggestions": ["list of improvements"],
  "confidence": 0.0 to 1.0,
  "passesAcceptanceCriteria": true/false,
  "criteriaMet": ["criteria that are met"],
  "criteriaMissing": ["criteria that are NOT met"]
}

Rules:
- Be honest and critical
- Check for bugs, security issues, edge cases
- Rate confidence based on code quality`

    const userPrompt = `PROJECT: Example App
TECH STACK: Next.js, TypeScript

FEATURE: Hello World Page
A simple page that displays "Welcome to Example App"

ACCEPTANCE CRITERIA:
- Page displays "Welcome to Example App" heading
- Uses Tailwind CSS for styling

GENERATED CODE:
// app/page.tsx
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">Welcome to Example App</h1>
    </main>
  )
}

Review this code and provide your analysis.`

    const result = await generateWithLocalLLM(systemPrompt, userPrompt, {
      temperature: 0.2,
      max_tokens: 1024
    })

    if (result.error) {
      throw new Error(`LLM error: ${result.error}`)
    }

    log(`  Critique response: ${result.content.slice(0, 200)}...`)

    // Try to parse JSON
    try {
      let jsonStr = result.content
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) {
        jsonStr = jsonMatch[1]
      }

      const critique = JSON.parse(jsonStr)
      log(`  Confidence: ${critique.confidence}`)
      log(`  Passes criteria: ${critique.passesAcceptanceCriteria}`)

      if (typeof critique.confidence !== 'number') {
        throw new Error('Confidence is not a number')
      }
    } catch (e) {
      log(`  Warning: Could not parse critique as JSON, continuing...`)
      // Not a hard failure - LLM might format differently
    }
  }

  // Main test runner
  log('========================================')
  log('Example App Execution Pipeline Test')
  log('========================================')
  log('')

  await test('LLM Server Connectivity', testLLMServers)
  await test('Simple Code Generation', testCodeGeneration)
  await test('Complex Code Generation', testComplexCodeGeneration)
  await test('Self-Critique System', testSelfCritique)

  log('')
  log('========================================')
  log('Test Results Summary')
  log('========================================')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  log(`Passed: ${passed}/${results.length}`)
  log(`Failed: ${failed}/${results.length}`)

  if (failed > 0) {
    log('')
    log('Failed tests:')
    results.filter(r => !r.passed).forEach(r => {
      log(`  - ${r.test}: ${r.error}`)
    })
  }

  log('')
  log('Total duration: ' + results.reduce((sum, r) => sum + r.duration, 0) + 'ms')

  process.exit(failed > 0 ? 1 : 0)
}

runTests().catch(console.error)
