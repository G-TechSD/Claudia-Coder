/**
 * Run Context Generator
 *
 * Creates context files for AI during execution, providing:
 * - Recent run history summaries
 * - Previous errors and resolutions
 * - Quality gate history
 * - Files commonly changed
 */

import * as fs from "fs/promises"
import * as path from "path"
import { getRecentRunsForProject } from "@/lib/data/execution-sessions"
import type { RunHistoryEntry } from "@/lib/data/types"

interface WorkPacket {
  id: string
  title: string
  description: string
  type: string
  priority: string
  tasks: Array<{ id: string; description: string; completed: boolean }>
  acceptanceCriteria: string[]
}

/**
 * Write run context file to project directory
 *
 * Creates .claudia/run-context.md with execution history and insights
 */
export async function writeRunContext(
  workingDirectory: string,
  projectId: string,
  currentPacket: WorkPacket
): Promise<void> {
  try {
    // Get recent runs for this project
    const history = await getRecentRunsForProject(projectId, 10)

    // Generate context markdown
    const contextMarkdown = formatRunContextMarkdown(history, currentPacket)

    // Ensure .claudia directory exists
    const claudiaDir = path.join(expandTilde(workingDirectory), ".claudia")
    await fs.mkdir(claudiaDir, { recursive: true })

    // Write context file
    const contextPath = path.join(claudiaDir, "run-context.md")
    await fs.writeFile(contextPath, contextMarkdown, "utf-8")

    console.log(`[run-context] Written context to ${contextPath}`)
  } catch (error) {
    console.error("[run-context] Failed to write context:", error)
    // Don't throw - context is optional enhancement
  }
}

/**
 * Format run history into markdown for AI consumption
 */
export function formatRunContextMarkdown(
  history: RunHistoryEntry[],
  currentPacket: WorkPacket
): string {
  const lines: string[] = [
    "# Claudia Run Context",
    "",
    "> This file is auto-generated before each execution run.",
    "> It provides context about previous runs to help improve code quality.",
    "",
    "## Current Task",
    "",
    `**Title:** ${currentPacket.title}`,
    `**Type:** ${currentPacket.type}`,
    `**Priority:** ${currentPacket.priority}`,
    "",
    "### Description",
    currentPacket.description,
    "",
    "### Tasks",
    ...currentPacket.tasks.map((t, i) => `${i + 1}. ${t.description}`),
    "",
    "### Acceptance Criteria",
    ...currentPacket.acceptanceCriteria.map(c => `- ${c}`),
    "",
  ]

  // Recent runs summary
  if (history.length > 0) {
    lines.push("## Recent Run History")
    lines.push("")
    lines.push("| Run | Status | Packets | Success | Failed | Duration |")
    lines.push("|-----|--------|---------|---------|--------|----------|")

    for (const run of history.slice(0, 5)) {
      const duration = run.duration ? `${Math.round(run.duration / 1000)}s` : "-"
      const statusEmoji = {
        running: "🔄",
        complete: "✅",
        error: "❌",
        cancelled: "⚠️"
      }[run.status]

      lines.push(
        `| ${run.id.slice(-8)} | ${statusEmoji} ${run.status} | ${run.packetCount} | ${run.successCount} | ${run.failedCount} | ${duration} |`
      )
    }
    lines.push("")
  }

  // Error patterns from history
  const errors = extractErrorPatterns(history)
  if (errors.length > 0) {
    lines.push("## Previous Errors to Avoid")
    lines.push("")
    lines.push("These errors occurred in previous runs. Take care to avoid them:")
    lines.push("")
    for (const error of errors) {
      lines.push(`- **${error.type}:** ${error.message}`)
      if (error.resolution) {
        lines.push(`  - *Resolution:* ${error.resolution}`)
      }
    }
    lines.push("")
  }

  // Quality gate trends
  const qgTrends = analyzeQualityGateTrends(history)
  if (qgTrends) {
    lines.push("## Quality Gate Trends")
    lines.push("")
    lines.push(`- **Test Pass Rate:** ${qgTrends.testPassRate}%`)
    lines.push(`- **TypeScript Pass Rate:** ${qgTrends.typeCheckPassRate}%`)
    lines.push(`- **Build Pass Rate:** ${qgTrends.buildPassRate}%`)
    lines.push("")
    if (qgTrends.recommendations.length > 0) {
      lines.push("### Recommendations")
      for (const rec of qgTrends.recommendations) {
        lines.push(`- ${rec}`)
      }
      lines.push("")
    }
  }

  // Commonly changed files
  const frequentFiles = extractFrequentlyChangedFiles(history)
  if (frequentFiles.length > 0) {
    lines.push("## Frequently Changed Files")
    lines.push("")
    lines.push("These files are frequently modified. Review them carefully:")
    lines.push("")
    for (const file of frequentFiles.slice(0, 10)) {
      lines.push(`- \`${file}\``)
    }
    lines.push("")
  }

  lines.push("---")
  lines.push(`*Generated: ${new Date().toISOString()}*`)

  return lines.join("\n")
}

/**
 * Extract error patterns from run history
 */
function extractErrorPatterns(history: RunHistoryEntry[]): Array<{
  type: string
  message: string
  resolution?: string
}> {
  const errors: Array<{ type: string; message: string; resolution?: string }> = []
  const seenMessages = new Set<string>()

  for (const run of history) {
    if (run.events) {
      for (const event of run.events) {
        if (event.type === "error" && !seenMessages.has(event.message)) {
          seenMessages.add(event.message)
          errors.push({
            type: categorizeError(event.message),
            message: event.message.slice(0, 200), // Truncate long messages
            resolution: inferResolution(event.message)
          })
        }
      }
    }
  }

  return errors.slice(0, 5) // Limit to 5 most relevant errors
}

/**
 * Categorize error message into type
 */
function categorizeError(message: string): string {
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes("typescript") || lowerMessage.includes("type error")) {
    return "TypeScript"
  }
  if (lowerMessage.includes("test") || lowerMessage.includes("jest") || lowerMessage.includes("vitest")) {
    return "Test"
  }
  if (lowerMessage.includes("build") || lowerMessage.includes("compile")) {
    return "Build"
  }
  if (lowerMessage.includes("lint") || lowerMessage.includes("eslint")) {
    return "Lint"
  }
  if (lowerMessage.includes("import") || lowerMessage.includes("module")) {
    return "Import"
  }
  if (lowerMessage.includes("syntax")) {
    return "Syntax"
  }

  return "Runtime"
}

/**
 * Infer resolution from error message
 */
function inferResolution(message: string): string | undefined {
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes("cannot find module")) {
    return "Check import paths and ensure dependencies are installed"
  }
  if (lowerMessage.includes("type") && lowerMessage.includes("not assignable")) {
    return "Review type definitions and ensure proper type annotations"
  }
  if (lowerMessage.includes("test failed")) {
    return "Review test expectations and implementation"
  }
  if (lowerMessage.includes("eslint")) {
    return "Run linter and fix reported issues"
  }

  return undefined
}

/**
 * Analyze quality gate trends from history
 */
function analyzeQualityGateTrends(history: RunHistoryEntry[]): {
  testPassRate: number
  typeCheckPassRate: number
  buildPassRate: number
  recommendations: string[]
} | null {
  const runsWithQG = history.filter(r => r.qualityGates)

  if (runsWithQG.length === 0) {
    return null
  }

  let testPasses = 0
  let typeCheckPasses = 0
  let buildPasses = 0

  for (const run of runsWithQG) {
    if (run.qualityGates?.tests.success) testPasses++
    if (run.qualityGates?.typeCheck.success) typeCheckPasses++
    if (run.qualityGates?.build.success) buildPasses++
  }

  const total = runsWithQG.length
  const testPassRate = Math.round((testPasses / total) * 100)
  const typeCheckPassRate = Math.round((typeCheckPasses / total) * 100)
  const buildPassRate = Math.round((buildPasses / total) * 100)

  const recommendations: string[] = []

  if (testPassRate < 80) {
    recommendations.push("Test pass rate is low. Consider writing more robust tests and reviewing existing ones.")
  }
  if (typeCheckPassRate < 90) {
    recommendations.push("TypeScript errors are common. Review type annotations and consider stricter settings.")
  }
  if (buildPassRate < 95) {
    recommendations.push("Build failures are occurring. Check for syntax errors and import issues.")
  }

  return {
    testPassRate,
    typeCheckPassRate,
    buildPassRate,
    recommendations
  }
}

/**
 * Extract frequently changed files from history
 */
function extractFrequentlyChangedFiles(history: RunHistoryEntry[]): string[] {
  const fileCounts = new Map<string, number>()

  for (const run of history) {
    if (run.events) {
      for (const event of run.events) {
        // Look for file change mentions in event messages
        const fileMatches = event.message.match(/`([^`]+\.(ts|tsx|js|jsx|json|css|md))`/g)
        if (fileMatches) {
          for (const match of fileMatches) {
            const file = match.replace(/`/g, "")
            fileCounts.set(file, (fileCounts.get(file) || 0) + 1)
          }
        }
      }
    }
  }

  // Sort by frequency
  return Array.from(fileCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([file]) => file)
}

/**
 * Expand tilde in path
 */
function expandTilde(filePath: string): string {
  if (filePath.startsWith("~/")) {
    return path.join(process.env.HOME || "", filePath.slice(2))
  }
  return filePath
}

/**
 * Get context summary for prompt inclusion (shorter version)
 */
export async function getRunContextSummary(
  projectId: string,
  currentPacket: WorkPacket
): Promise<string> {
  try {
    const history = await getRecentRunsForProject(projectId, 5)

    if (history.length === 0) {
      return ""
    }

    const lines: string[] = [
      "",
      "## Previous Run Context",
      ""
    ]

    // Brief history
    const recentRun = history[0]
    if (recentRun) {
      lines.push(`Last run: ${recentRun.status} (${recentRun.successCount}/${recentRun.packetCount} packets succeeded)`)
    }

    // Key errors
    const errors = extractErrorPatterns(history).slice(0, 2)
    if (errors.length > 0) {
      lines.push("")
      lines.push("**Avoid these previous errors:**")
      for (const error of errors) {
        lines.push(`- ${error.message.slice(0, 100)}`)
      }
    }

    lines.push("")

    return lines.join("\n")
  } catch (error) {
    console.error("[run-context] Failed to get summary:", error)
    return ""
  }
}
