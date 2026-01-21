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
 * Parse TypeScript errors from output
 */
function parseTypeScriptErrors(output: string): string[] {
  const errors: string[] = []
  const lines = output.split("\n")

  for (const line of lines) {
    // Match TS error pattern: filename(line,col): error TS1234: message
    const match = line.match(/error TS\d+:\s*(.+)/)
    if (match) {
      errors.push(match[1].trim())
    }
  }

  // Deduplicate similar errors
  return [...new Set(errors)].slice(0, 10)
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

    // Process TypeScript errors
    if (body.qualityGates?.typeCheck && !body.qualityGates.typeCheck.passed && body.qualityGates.typeCheck.output) {
      const tsErrors = parseTypeScriptErrors(body.qualityGates.typeCheck.output)

      if (tsErrors.length > 0) {
        packets.push({
          id: `touchdown-ts-${timestamp}`,
          title: `Fix TypeScript Errors (${tsErrors.length} issues)`,
          description: `TypeScript compilation found the following errors that need to be fixed:\n\n${tsErrors.map((e, i) => `${i + 1}. ${e}`).join("\n")}\n\nRun \`npx tsc --noEmit\` to verify all errors are resolved.`,
          type: "bug_fix",
          priority: "high",
          status: "queued",
          tasks: tsErrors.slice(0, 5).map((error, i) => ({
            id: `task-ts-${i}`,
            description: `Fix: ${error}`,
            completed: false
          })),
          acceptanceCriteria: [
            "All TypeScript errors are resolved",
            "`npx tsc --noEmit` completes with no errors",
            "No type: any added to bypass errors"
          ]
        })
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

    return NextResponse.json({
      success: true,
      packets,
      count: packets.length,
      projectId
    })

  } catch (error) {
    console.error("[touchdown/process] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process refinements" },
      { status: 500 }
    )
  }
}
