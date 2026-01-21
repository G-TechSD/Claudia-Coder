/**
 * Touchdown API
 *
 * POST /api/projects/[id]/touchdown
 *
 * Executes the "touchdown" phase - the completion and refinement phase after
 * work packets have been executed. This phase:
 * 1. Analyzes the codebase for issues
 * 2. Runs quality gates
 * 3. Fixes errors and refines code
 * 4. Generates TOUCHDOWN.md documentation
 *
 * Supports both local (LM Studio/Ollama) and cloud (Claude Code) execution.
 */

import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import { existsSync } from "fs"
import path from "path"
import os from "os"
import { exec } from "child_process"
import { promisify } from "util"

import { getProject } from "@/lib/data/projects"
import { getBuildPlanForProject } from "@/lib/data/build-plans"
import { getRunHistoryList } from "@/lib/data/execution-sessions"
import {
  generateTouchdownMarkdown,
  generateTouchdownAnalysisPrompt,
  TouchdownContext
} from "@/lib/project-files/generators"
import { generateWithLocalLLM, getAvailableServer } from "@/lib/llm/local-llm"
import type { WorkPacket } from "@/lib/ai/build-plan"

const execAsync = promisify(exec)

interface RouteParams {
  params: Promise<{ id: string }>
}

interface TouchdownRequest {
  workingDirectory: string
  packets: WorkPacket[]
  mode?: "local" | "cloud" | "auto"  // Default: auto
  runQualityGates?: boolean  // Default: true
  generateAnalysis?: boolean  // Use AI to analyze codebase - Default: true
  executeRefinements?: boolean  // Actually execute the fixes - Default: false (just generate doc)
  // Project info passed from client (since localStorage is client-side only)
  project?: {
    id: string
    name: string
    description?: string
  }
}

/**
 * Expand ~ to home directory
 */
function expandPath(p: string): string {
  if (!p) return p
  return p.replace(/^~/, os.homedir())
}

/**
 * Run a command and capture output
 */
async function runCommand(
  command: string,
  cwd: string
): Promise<{ success: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd,
      timeout: 120000, // 2 minute timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    })
    return {
      success: true,
      output: stdout + (stderr ? `\n${stderr}` : "")
    }
  } catch (error) {
    const err = error as { stdout?: string; stderr?: string; message?: string }
    return {
      success: false,
      output: (err.stdout || "") + (err.stderr || "") + (err.message || "Command failed")
    }
  }
}

/**
 * Run quality gates and return results
 */
async function runQualityGates(cwd: string): Promise<TouchdownContext["qualityGates"]> {
  // Check if package.json exists
  const packageJsonPath = path.join(cwd, "package.json")
  if (!existsSync(packageJsonPath)) {
    return {
      tests: { passed: true, output: "No package.json found - skipping tests" },
      typeCheck: { passed: true, output: "No package.json found - skipping TypeScript check" },
      build: { passed: true, output: "No package.json found - skipping build" },
    }
  }

  // Run tests
  const testsResult = await runCommand("npm test 2>&1 || true", cwd)
  const testsPassed = testsResult.success &&
    !testsResult.output.toLowerCase().includes("failed") &&
    !testsResult.output.toLowerCase().includes("error")

  // Run TypeScript check
  const tsResult = await runCommand("npx tsc --noEmit 2>&1 || true", cwd)
  const tsPassed = tsResult.success && !tsResult.output.includes("error TS")

  // Run build
  const buildResult = await runCommand("npm run build 2>&1 || true", cwd)
  const buildPassed = buildResult.success &&
    !buildResult.output.toLowerCase().includes("error") &&
    !buildResult.output.toLowerCase().includes("failed")

  return {
    tests: { passed: testsPassed, output: testsResult.output.slice(0, 5000) },
    typeCheck: { passed: tsPassed, output: tsResult.output.slice(0, 5000) },
    build: { passed: buildPassed, output: buildResult.output.slice(0, 5000) },
  }
}

/**
 * Analyze codebase for stats
 */
async function analyzeCodebase(cwd: string): Promise<TouchdownContext["codebaseAnalysis"]> {
  try {
    // Count files
    const findResult = await runCommand(
      "find . -type f \\( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \\) -not -path './node_modules/*' -not -path './.next/*' | wc -l",
      cwd
    )
    const filesCreated = parseInt(findResult.output.trim()) || 0

    // Count lines of code
    const locResult = await runCommand(
      "find . -type f \\( -name '*.ts' -o -name '*.tsx' -o -name '*.js' -o -name '*.jsx' \\) -not -path './node_modules/*' -not -path './.next/*' -exec wc -l {} + 2>/dev/null | tail -1 | awk '{print $1}'",
      cwd
    )
    const linesOfCode = parseInt(locResult.output.trim()) || 0

    return {
      filesCreated,
      filesModified: 0, // Would need git diff to determine
      linesOfCode,
    }
  } catch {
    return {
      filesCreated: 0,
      filesModified: 0,
      linesOfCode: 0,
    }
  }
}

/**
 * Execute touchdown with Claude Code (cloud)
 */
async function executeTouchdownWithClaudeCode(
  cwd: string,
  touchdownDoc: string
): Promise<{ success: boolean; output: string }> {
  // Write touchdown doc first
  const touchdownPath = path.join(cwd, "TOUCHDOWN.md")
  await fs.writeFile(touchdownPath, touchdownDoc, "utf-8")

  // Build the prompt for Claude Code
  const prompt = `Read TOUCHDOWN.md and execute the touchdown phase for this project.

Focus on:
1. Fix any TypeScript errors
2. Fix any failing tests
3. Ensure build succeeds
4. Review code and make obvious improvements
5. Add any missing error handling

Run quality gates after each fix to verify.
Commit changes with descriptive messages.
Stop when all quality gates pass.`

  try {
    // Try to run Claude Code CLI
    const result = await runCommand(
      `claude -p "${prompt.replace(/"/g, '\\"')}" --dangerously-skip-permissions`,
      cwd
    )
    return result
  } catch (error) {
    return {
      success: false,
      output: `Claude Code execution failed: ${error instanceof Error ? error.message : "Unknown error"}`
    }
  }
}

/**
 * Execute touchdown with local LLM (generates analysis only)
 */
async function executeTouchdownWithLocalLLM(
  context: TouchdownContext
): Promise<{ success: boolean; analysis: string }> {
  const server = await getAvailableServer()

  if (!server) {
    return {
      success: false,
      analysis: "No local LLM server available. Please start LM Studio or Ollama."
    }
  }

  const prompt = generateTouchdownAnalysisPrompt(context)

  const result = await generateWithLocalLLM(
    "You are a senior software engineer performing a code review and refinement analysis.",
    prompt,
    {
      max_tokens: 4000,
      temperature: 0.3,
      preferredServer: server.name,
    }
  )

  return {
    success: !result.error,
    analysis: result.content || result.error || "No analysis generated"
  }
}

/**
 * POST /api/projects/[id]/touchdown
 */
export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id: projectId } = await params
    const body: TouchdownRequest = await request.json()

    // Validate
    if (!projectId) {
      return NextResponse.json(
        { error: "Project ID is required" },
        { status: 400 }
      )
    }

    if (!body.workingDirectory) {
      return NextResponse.json(
        { error: "workingDirectory is required" },
        { status: 400 }
      )
    }

    const workingDirectory = expandPath(body.workingDirectory)
    const mode = body.mode || "auto"
    const runQG = body.runQualityGates !== false
    const generateAnalysis = body.generateAnalysis !== false
    const executeRefinements = body.executeRefinements === true

    // Get project info - prefer from request body (since localStorage is client-side only)
    // Fall back to getProject for backwards compatibility (works if called from client-side code)
    let project: { id: string; name: string; description?: string } | null = body.project || null

    if (!project) {
      // Try to get from storage (will only work if this code runs client-side, which it doesn't)
      const storedProject = getProject(projectId, undefined)
      if (storedProject) {
        project = {
          id: storedProject.id,
          name: storedProject.name,
          description: storedProject.description
        }
      }
    }

    if (!project) {
      return NextResponse.json(
        { error: "Project not found. Please pass project info in the request body." },
        { status: 404 }
      )
    }

    const storedBuildPlan = getBuildPlanForProject(projectId)

    // Convert stored build plan to the format expected by generators
    const buildPlan = storedBuildPlan ? {
      id: storedBuildPlan.id,
      projectId: storedBuildPlan.projectId,
      version: storedBuildPlan.revisionNumber || 1,
      createdAt: storedBuildPlan.createdAt,
      status: storedBuildPlan.status as "draft" | "approved",
      spec: storedBuildPlan.originalPlan.spec,
      phases: storedBuildPlan.originalPlan.phases.map(p => ({
        ...p,
        packetIds: [],
        dependencies: [],
        estimatedEffort: { optimistic: 8, realistic: 16, pessimistic: 32, confidence: "medium" as const },
        successCriteria: []
      })),
      packets: body.packets,
      constraints: { requireLocalFirst: true, requireHumanApproval: ["planning"] as ("planning" | "deployment" | "coding")[], maxParallelPackets: 3 },
      generatedBy: `${storedBuildPlan.generatedBy?.server || "unknown"}:${storedBuildPlan.generatedBy?.model || "unknown"}`,
      modelAssignments: []
    } : undefined

    // Get run history
    const runHistory = await getRunHistoryList({ projectId, limit: 20 })
    const runHistorySummary = {
      totalRuns: runHistory.length,
      successfulRuns: runHistory.filter(r => r.status === "complete").length,
      failedRuns: runHistory.filter(r => r.status === "error").length,
      lastRunAt: runHistory[0]?.startedAt,
    }

    // Run quality gates if requested
    let qualityGates: TouchdownContext["qualityGates"] | undefined
    if (runQG && existsSync(workingDirectory)) {
      qualityGates = await runQualityGates(workingDirectory)
    }

    // Analyze codebase
    let codebaseAnalysis: TouchdownContext["codebaseAnalysis"] | undefined
    if (existsSync(workingDirectory)) {
      codebaseAnalysis = await analyzeCodebase(workingDirectory)
    }

    // Build context
    const context: TouchdownContext = {
      project,
      buildPlan,
      packets: body.packets,
      runHistory: runHistorySummary,
      qualityGates,
      codebaseAnalysis,
    }

    // Generate touchdown markdown
    const touchdownMarkdown = generateTouchdownMarkdown(context)

    // Write TOUCHDOWN.md
    if (existsSync(workingDirectory)) {
      const touchdownPath = path.join(workingDirectory, "TOUCHDOWN.md")
      await fs.writeFile(touchdownPath, touchdownMarkdown, "utf-8")
    }

    // Generate AI analysis if requested
    let aiAnalysis: string | undefined
    if (generateAnalysis) {
      // Determine which mode to use
      let useCloud = mode === "cloud"

      if (mode === "auto") {
        // Auto mode: use local if available, otherwise cloud
        const server = await getAvailableServer()
        useCloud = !server
      }

      if (useCloud && executeRefinements) {
        // Execute with Claude Code
        const result = await executeTouchdownWithClaudeCode(workingDirectory, touchdownMarkdown)
        aiAnalysis = result.output
      } else {
        // Generate analysis with local LLM
        const result = await executeTouchdownWithLocalLLM(context)
        aiAnalysis = result.analysis
      }
    }

    // Re-run quality gates after execution if we executed refinements
    let finalQualityGates = qualityGates
    if (executeRefinements && existsSync(workingDirectory)) {
      finalQualityGates = await runQualityGates(workingDirectory)
    }

    return NextResponse.json({
      success: true,
      projectId,
      workingDirectory,
      touchdownPath: path.join(workingDirectory, "TOUCHDOWN.md"),
      touchdownMarkdown,
      qualityGates: finalQualityGates,
      codebaseAnalysis,
      aiAnalysis,
      runHistory: runHistorySummary,
      mode: mode === "auto" ? (aiAnalysis?.includes("Claude Code") ? "cloud" : "local") : mode,
      executedRefinements: executeRefinements,
      allGatesPassing: finalQualityGates ?
        (finalQualityGates.tests.passed && finalQualityGates.typeCheck.passed && finalQualityGates.build.passed)
        : undefined,
      generatedAt: new Date().toISOString(),
    })

  } catch (error) {
    console.error("[touchdown] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Touchdown failed" },
      { status: 500 }
    )
  }
}
