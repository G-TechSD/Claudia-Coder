/**
 * Touchdown Process API
 *
 * POST /api/projects/[id]/touchdown/process
 *
 * Processes touchdown results (quality gate failures, AI analysis) into
 * work packets that can be executed to fix issues.
 */

import { NextRequest, NextResponse } from "next/server"

interface RouteParams {
  params: Promise<{ id: string }>
}

interface QualityGates {
  tests: { passed: boolean; output?: string }
  typeCheck: { passed: boolean; output?: string }
  build: { passed: boolean; output?: string }
}

interface ProcessRequest {
  projectId: string
  projectName: string
  qualityGates?: QualityGates
  aiAnalysis?: string
  touchdownMarkdown?: string
}

interface RefinementPacket {
  id: string
  title: string
  description: string
  type: string
  priority: string
  status: string
  tasks: Array<{ id: string; description: string; completed: boolean }>
  acceptanceCriteria: string[]
}

/**
 * Storage for saving packets to server
 */
import * as fs from "fs/promises"
import * as path from "path"

const STORAGE_DIR = path.join(process.cwd(), ".local-storage")
const PACKETS_FILE = path.join(STORAGE_DIR, "packets.json")

interface PacketsStore {
  packets: Record<string, RefinementPacket[]>
  lastUpdated: string
}

async function readPacketsStore(): Promise<PacketsStore> {
  try {
    const data = await fs.readFile(PACKETS_FILE, "utf-8")
    return JSON.parse(data) as PacketsStore
  } catch {
    return { packets: {}, lastUpdated: new Date().toISOString() }
  }
}

async function addPacketsToProject(projectId: string, newPackets: RefinementPacket[]): Promise<void> {
  const store = await readPacketsStore()
  const existingPackets = store.packets[projectId] || []
  const existingIds = new Set(existingPackets.map(p => p.id))

  // Add new packets that don't already exist
  for (const packet of newPackets) {
    if (!existingIds.has(packet.id)) {
      existingPackets.push(packet)
    }
  }

  store.packets[projectId] = existingPackets
  store.lastUpdated = new Date().toISOString()

  await fs.mkdir(STORAGE_DIR, { recursive: true })
  await fs.writeFile(PACKETS_FILE, JSON.stringify(store, null, 2), "utf-8")
  console.log(`[touchdown/process] Added ${newPackets.length} packets to project ${projectId}`)
}

/**
 * Parse TypeScript errors from output - ENHANCED with file paths
 */
function parseTypeScriptErrors(output: string): Array<{ file: string; error: string; line?: number }> {
  const errors: Array<{ file: string; error: string; line?: number }> = []
  const lines = output.split("\n")

  for (const line of lines) {
    // Match TS error pattern: filename(line,col): error TS1234: message
    const match = line.match(/(.+?)\((\d+),\d+\):\s*error TS\d+:\s*(.+)/)
    if (match) {
      errors.push({
        file: match[1].trim(),
        line: parseInt(match[2]),
        error: match[3].trim()
      })
    } else {
      // Simpler pattern without line numbers
      const simpleMatch = line.match(/error TS\d+:\s*(.+)/)
      if (simpleMatch) {
        errors.push({ file: "unknown", error: simpleMatch[1].trim() })
      }
    }
  }

  // Deduplicate by error message
  const seen = new Set<string>()
  return errors.filter(e => {
    const key = `${e.file}:${e.error}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 15)
}

/**
 * Parse test failures from output
 */
function parseTestFailures(output: string): string[] {
  const failures: string[] = []
  const lines = output.split("\n")

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // Match common test failure patterns
    if (line.includes("FAIL") || line.includes("✕") || line.includes("failed")) {
      // Get the test name from surrounding context
      const testMatch = line.match(/(?:FAIL|✕)\s*(.+)/) ||
                        line.match(/failed:\s*(.+)/) ||
                        line.match(/Test\s+(.+)\s+failed/)
      if (testMatch) {
        failures.push(testMatch[1].trim())
      }
    }
  }

  return [...new Set(failures)].slice(0, 10)
}

/**
 * Parse build errors from output
 */
function parseBuildErrors(output: string): string[] {
  const errors: string[] = []
  const lines = output.split("\n")

  for (const line of lines) {
    if (line.toLowerCase().includes("error") && !line.includes("0 errors")) {
      const cleaned = line.replace(/^\s*[>\-\*]\s*/, "").trim()
      if (cleaned.length > 10 && cleaned.length < 200) {
        errors.push(cleaned)
      }
    }
  }

  return [...new Set(errors)].slice(0, 10)
}

/**
 * Parse AI analysis for suggested improvements
 */
function parseAIAnalysis(analysis: string): Array<{ title: string; description: string; priority: string }> {
  const suggestions: Array<{ title: string; description: string; priority: string }> = []

  // Look for numbered lists or bullet points with suggestions
  const lines = analysis.split("\n")
  let currentSuggestion: { title: string; description: string; priority: string } | null = null

  for (const line of lines) {
    // Match numbered items: "1. Fix X" or "- Fix X"
    const itemMatch = line.match(/^(?:\d+\.|[-*])\s*(.+)/)
    if (itemMatch) {
      const text = itemMatch[1].trim()

      // Determine priority based on keywords
      let priority = "medium"
      if (text.toLowerCase().includes("critical") || text.toLowerCase().includes("security") || text.toLowerCase().includes("crash")) {
        priority = "critical"
      } else if (text.toLowerCase().includes("error") || text.toLowerCase().includes("bug") || text.toLowerCase().includes("fix")) {
        priority = "high"
      } else if (text.toLowerCase().includes("improve") || text.toLowerCase().includes("optimize") || text.toLowerCase().includes("refactor")) {
        priority = "medium"
      } else if (text.toLowerCase().includes("style") || text.toLowerCase().includes("cleanup") || text.toLowerCase().includes("minor")) {
        priority = "low"
      }

      // Create suggestion if it looks actionable
      if (text.length > 10 && text.length < 200) {
        currentSuggestion = {
          title: text.substring(0, 60) + (text.length > 60 ? "..." : ""),
          description: text,
          priority
        }
        suggestions.push(currentSuggestion)
      }
    }
  }

  return suggestions.slice(0, 10)
}

/**
 * POST /api/projects/[id]/touchdown/process
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId } = await params
    const body: ProcessRequest = await request.json()

    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      )
    }

    const packets: RefinementPacket[] = []
    const timestamp = Date.now()

    // Process TypeScript errors - Create detailed packets per file
    if (body.qualityGates?.typeCheck && !body.qualityGates.typeCheck.passed && body.qualityGates.typeCheck.output) {
      const tsErrors = parseTypeScriptErrors(body.qualityGates.typeCheck.output)

      if (tsErrors.length > 0) {
        // Group errors by file for better organization
        const errorsByFile: Record<string, typeof tsErrors> = {}
        for (const err of tsErrors) {
          if (!errorsByFile[err.file]) errorsByFile[err.file] = []
          errorsByFile[err.file].push(err)
        }

        // Create a packet for each file with errors (up to 5 files)
        const files = Object.keys(errorsByFile).slice(0, 5)
        for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
          const file = files[fileIdx]
          const fileErrors = errorsByFile[file]

          packets.push({
            id: `touchdown-ts-${timestamp}-${fileIdx}`,
            title: `Fix TypeScript Errors in ${file.split("/").pop() || file}`,
            description: `Fix TypeScript compilation errors in \`${file}\`:

**Errors to fix:**
${fileErrors.map((e, i) => `${i + 1}. Line ${e.line || "?"}: ${e.error}`).join("\n")}

**Steps:**
1. Open \`${file}\`
2. Go to each line number listed above
3. Fix the type error by:
   - Adding proper type annotations
   - Fixing import statements
   - Correcting variable types
   - Adding null checks where needed
4. Run \`npx tsc --noEmit\` to verify

**Integration Note:** After fixing, ensure any exported types/functions still work correctly with importing files.`,
            type: "bug_fix",
            priority: "high",
            status: "queued",
            tasks: fileErrors.slice(0, 5).map((error, i) => ({
              id: `task-ts-${fileIdx}-${i}`,
              description: `Fix line ${error.line || "?"}: ${error.error}`,
              completed: false
            })),
            acceptanceCriteria: [
              `No TypeScript errors in \`${file}\``,
              "`npx tsc --noEmit` passes for this file",
              "No type: any added to bypass errors",
              "All imports and exports still work"
            ]
          })
        }

        // Add summary/verification packet if multiple files
        if (files.length > 1) {
          packets.push({
            id: `touchdown-ts-verify-${timestamp}`,
            title: `Verify All TypeScript Errors Fixed`,
            description: `After fixing TypeScript errors in individual files, verify the entire codebase compiles:

1. Run \`npx tsc --noEmit\`
2. Verify zero errors
3. Run \`npm run build\` to ensure build works
4. Check that all fixed files integrate correctly

This packet depends on: ${files.map((_, i) => `touchdown-ts-${timestamp}-${i}`).join(", ")}`,
            type: "verification",
            priority: "critical",
            status: "queued",
            tasks: [
              { id: `task-ts-verify-1`, description: "Run `npx tsc --noEmit` - should pass with 0 errors", completed: false },
              { id: `task-ts-verify-2`, description: "Run `npm run build` - should succeed", completed: false },
              { id: `task-ts-verify-3`, description: "Manually review any type: any additions", completed: false }
            ],
            acceptanceCriteria: [
              "TypeScript compilation succeeds with no errors",
              "Build completes successfully",
              "No new type: any declarations"
            ]
          })
        }
      }
    }

    // Process test failures
    if (body.qualityGates?.tests && !body.qualityGates.tests.passed && body.qualityGates.tests.output) {
      const testFailures = parseTestFailures(body.qualityGates.tests.output)

      if (testFailures.length > 0) {
        packets.push({
          id: `touchdown-tests-${timestamp}`,
          title: `Fix Failing Tests (${testFailures.length} failures)`,
          description: `The following tests are failing and need to be fixed:\n\n${testFailures.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\nRun \`npm test\` to verify all tests pass.`,
          type: "bug_fix",
          priority: "high",
          status: "queued",
          tasks: testFailures.slice(0, 5).map((test, i) => ({
            id: `task-test-${i}`,
            description: `Fix failing test: ${test}`,
            completed: false
          })),
          acceptanceCriteria: [
            "All tests pass",
            "`npm test` completes with 100% success",
            "No tests skipped or disabled"
          ]
        })
      }
    }

    // Process build errors
    if (body.qualityGates?.build && !body.qualityGates.build.passed && body.qualityGates.build.output) {
      const buildErrors = parseBuildErrors(body.qualityGates.build.output)

      if (buildErrors.length > 0) {
        packets.push({
          id: `touchdown-build-${timestamp}`,
          title: `Fix Build Errors (${buildErrors.length} issues)`,
          description: `The build is failing with the following errors:\n\n${buildErrors.map((e, i) => `${i + 1}. ${e}`).join("\n")}\n\nRun \`npm run build\` to verify the build succeeds.`,
          type: "bug_fix",
          priority: "critical",
          status: "queued",
          tasks: buildErrors.slice(0, 5).map((error, i) => ({
            id: `task-build-${i}`,
            description: `Fix: ${error}`,
            completed: false
          })),
          acceptanceCriteria: [
            "Build completes successfully",
            "`npm run build` exits with code 0",
            "No warnings treated as errors"
          ]
        })
      }
    }

    // Process AI analysis suggestions
    if (body.aiAnalysis) {
      const suggestions = parseAIAnalysis(body.aiAnalysis)

      for (let i = 0; i < suggestions.length && packets.length < 15; i++) {
        const suggestion = suggestions[i]
        packets.push({
          id: `touchdown-ai-${timestamp}-${i}`,
          title: suggestion.title,
          description: `AI Analysis Recommendation:\n\n${suggestion.description}`,
          type: suggestion.priority === "high" || suggestion.priority === "critical" ? "bug_fix" : "enhancement",
          priority: suggestion.priority,
          status: "queued",
          tasks: [
            {
              id: `task-ai-${i}-1`,
              description: `Implement: ${suggestion.title}`,
              completed: false
            },
            {
              id: `task-ai-${i}-2`,
              description: "Verify the change works as expected",
              completed: false
            },
            {
              id: `task-ai-${i}-3`,
              description: "Run tests to ensure no regressions",
              completed: false
            }
          ],
          acceptanceCriteria: [
            "Change implemented correctly",
            "All existing tests still pass",
            "Code follows project conventions"
          ]
        })
      }
    }

    // If no specific issues found but gates are failing, create generic fix packet
    if (packets.length === 0 && body.qualityGates) {
      const failingGates: string[] = []
      if (!body.qualityGates.tests?.passed) failingGates.push("tests")
      if (!body.qualityGates.typeCheck?.passed) failingGates.push("TypeScript")
      if (!body.qualityGates.build?.passed) failingGates.push("build")

      if (failingGates.length > 0) {
        packets.push({
          id: `touchdown-generic-${timestamp}`,
          title: `Fix Quality Gate Failures: ${failingGates.join(", ")}`,
          description: `The following quality gates are failing:\n\n${failingGates.map(g => `- ${g}`).join("\n")}\n\nInvestigate and fix the underlying issues.`,
          type: "bug_fix",
          priority: "high",
          status: "queued",
          tasks: failingGates.map((gate, i) => ({
            id: `task-generic-${i}`,
            description: `Fix ${gate} issues`,
            completed: false
          })),
          acceptanceCriteria: failingGates.map(gate => `${gate} quality gate passes`)
        })
      }
    }

    // Auto-save packets to server storage
    if (packets.length > 0) {
      try {
        await addPacketsToProject(projectId, packets)
        console.log(`[touchdown/process] Auto-saved ${packets.length} packets to server`)
      } catch (saveError) {
        console.error("[touchdown/process] Failed to auto-save packets:", saveError)
      }
    }

    // Add iteration tracking metadata
    const iterationInfo = {
      iterationNumber: 1, // Would need to track this across calls
      hasMoreIssues: packets.length > 0,
      recommendation: packets.length > 0
        ? "Execute these packets to fix issues, then run touchdown again"
        : "All quality gates passing - project ready for deployment"
    }

    return NextResponse.json({
      success: true,
      packets,
      count: packets.length,
      projectId,
      savedToServer: packets.length > 0,
      iteration: iterationInfo
    })

  } catch (error) {
    console.error("[touchdown/process] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process refinements" },
      { status: 500 }
    )
  }
}
