/**
 * Execution Module
 *
 * Core execution engine for running work packets and generating code.
 */

export * from "./prompts"
export { parseCodeOutput, applyToGitLab, applyWithMergeRequest, createCommit } from "./apply-code"
export type { FileChange, ParsedOutput, CommitResult, ApplyResult } from "./apply-code"
export { getRepoContext, getMinimalContext, getGitLabFileTree, detectTechStack, findRelevantFiles, getKeyFileSummaries } from "./repo-context"
export type { RepoContext, TreeItem } from "./repo-context"
export { runIterationLoop, executeWithIteration } from "./iteration-loop"
export type { IterationConfig, IterationUpdate, IterationResult } from "./iteration-loop"
export { runLongHorizonEngine, executeLongHorizon } from "./long-horizon-engine"
export type { GenerationPhase, ContextSummary, GuardrailConfig, LongHorizonUpdate, LongHorizonResult } from "./long-horizon-engine"
export { createScaffold, detectTemplate, getAvailableTemplates } from "./scaffolding"
export type { ProjectTemplate, TemplateConfig, ScaffoldResult } from "./scaffolding"
export { validateSyntax, validateFiles, checkImports, formatValidationResult } from "./validator"
export type { ValidationResult, SyntaxError as ValidationSyntaxError, LintWarning } from "./validator"
export { bakeProject, bakeProjectSimple, ralphWiggumLoop } from "./oven"
export type { OvenState, QualityTier, BakeConfig, BakeUpdate, BakeResult } from "./oven"
export { getAgentController, AgentControllerClass } from "./agent-controller"
export type { AgentState, ExecutionMode, QueuedProject, ExecutionProgress, ExecutionResult, AgentStatus } from "./agent-controller"

import type { WorkPacket, PacketTask } from "@/lib/ai/build-plan"
import type { LinkedRepo } from "@/lib/data/types"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"
import { buildPacketPrompt, buildCodeGenPrompt, buildSelfCritiquePrompt } from "./prompts"
import { parseCodeOutput, applyToGitLab, type ApplyResult, type FileChange } from "./apply-code"
import { getRepoContext, type RepoContext } from "./repo-context"

export interface ExecutionLog {
  timestamp: string
  level: "info" | "warn" | "error" | "success"
  message: string
  data?: unknown
}

export interface TaskExecutionResult {
  taskId: string
  success: boolean
  output?: string
  files: FileChange[]
  errors: string[]
  tokensUsed?: number
}

export interface PacketExecutionResult {
  packetId: string
  success: boolean
  taskResults: TaskExecutionResult[]
  appliedResult?: ApplyResult
  logs: ExecutionLog[]
  duration: number
  totalTokens: number
  errors: string[]
}

export interface SelfCritiqueResult {
  issues: string[]
  suggestions: string[]
  confidence: number
  passesAcceptanceCriteria: boolean
  criteriaMet: string[]
  criteriaMissing: string[]
}

/**
 * Execute a single task with LLM
 */
export async function executeTask(
  task: PacketTask,
  packet: WorkPacket,
  context: RepoContext,
  options?: {
    preferredServer?: string
    temperature?: number
    maxTokens?: number
  }
): Promise<TaskExecutionResult> {
  const { systemPrompt, userPrompt } = buildCodeGenPrompt(task, packet, context)

  const result = await generateWithLocalLLM(systemPrompt, userPrompt, {
    preferredServer: options?.preferredServer,
    temperature: options?.temperature ?? 0.3,
    max_tokens: options?.maxTokens ?? 4096
  })

  if (result.error) {
    return {
      taskId: task.id,
      success: false,
      files: [],
      errors: [result.error]
    }
  }

  const parsed = parseCodeOutput(result.content)

  return {
    taskId: task.id,
    success: parsed.files.length > 0 && parsed.errors.length === 0,
    output: result.content,
    files: parsed.files,
    errors: parsed.errors
  }
}

/**
 * Execute an entire packet
 */
export async function executePacket(
  packet: WorkPacket,
  repo: LinkedRepo,
  options?: {
    preferredServer?: string
    temperature?: number
    maxTokens?: number
    createBranch?: boolean
    branchName?: string
    executeMode?: "per-task" | "whole-packet"
  }
): Promise<PacketExecutionResult> {
  const startTime = Date.now()
  const logs: ExecutionLog[] = []
  const errors: string[] = []
  const taskResults: TaskExecutionResult[] = []
  let totalTokens = 0
  let allFiles: FileChange[] = []

  const log = (level: ExecutionLog["level"], message: string, data?: unknown) => {
    logs.push({ timestamp: new Date().toISOString(), level, message, data })
  }

  log("info", `Starting execution of packet: ${packet.title}`)

  // Get repo context
  log("info", "Fetching repository context...")
  let context: RepoContext
  try {
    context = await getRepoContext(repo, {
      keywords: extractKeywords(packet)
    })
    log("success", `Got context: ${context.techStack.join(", ")}`)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Failed to get repo context"
    log("error", errorMsg)
    return {
      packetId: packet.id,
      success: false,
      taskResults: [],
      logs,
      duration: Date.now() - startTime,
      totalTokens: 0,
      errors: [errorMsg]
    }
  }

  // Execute based on mode
  const executeMode = options?.executeMode || "whole-packet"

  if (executeMode === "whole-packet") {
    // Generate code for entire packet at once
    log("info", "Generating code for entire packet...")
    const { systemPrompt, userPrompt } = buildPacketPrompt(packet, context)

    const result = await generateWithLocalLLM(systemPrompt, userPrompt, {
      preferredServer: options?.preferredServer,
      temperature: options?.temperature ?? 0.3,
      max_tokens: options?.maxTokens ?? 8192
    })

    if (result.error) {
      log("error", `LLM error: ${result.error}`)
      errors.push(result.error)
    } else {
      log("success", `Generated code using ${result.server}/${result.model}`)
      const parsed = parseCodeOutput(result.content)
      allFiles = parsed.files
      errors.push(...parsed.errors)

      if (parsed.files.length > 0) {
        log("success", `Parsed ${parsed.files.length} files`)
      } else {
        log("warn", "No files parsed from LLM output")
      }

      // Create a combined task result
      taskResults.push({
        taskId: "all",
        success: parsed.files.length > 0,
        output: result.content,
        files: parsed.files,
        errors: parsed.errors
      })
    }
  } else {
    // Execute each task individually
    for (const task of packet.tasks) {
      if (task.completed) {
        log("info", `Skipping completed task: ${task.description}`)
        continue
      }

      log("info", `Executing task: ${task.description}`)
      const taskResult = await executeTask(task, packet, context, options)
      taskResults.push(taskResult)

      if (taskResult.success) {
        log("success", `Task completed: ${taskResult.files.length} files`)
        allFiles.push(...taskResult.files)
      } else {
        log("error", `Task failed: ${taskResult.errors.join(", ")}`)
        errors.push(...taskResult.errors)
      }
    }
  }

  // Apply changes to repository
  let appliedResult: ApplyResult | undefined
  if (allFiles.length > 0) {
    log("info", `Applying ${allFiles.length} files to repository...`)
    const branchName = options?.branchName || `claudia/${packet.id}`

    appliedResult = await applyToGitLab(repo, allFiles, `feat: ${packet.title}\n\nGenerated by Claudia`, {
      branch: branchName,
      createBranch: options?.createBranch ?? true
    })

    if (appliedResult.success) {
      log("success", `Applied to branch: ${branchName}`)
      if (appliedResult.commit?.webUrl) {
        log("info", `Commit: ${appliedResult.commit.webUrl}`)
      }
    } else {
      log("error", `Failed to apply: ${appliedResult.errors.join(", ")}`)
      errors.push(...appliedResult.errors)
    }
  } else {
    log("warn", "No files to apply")
  }

  const duration = Date.now() - startTime
  const success = allFiles.length > 0 && errors.length === 0 && (appliedResult?.success === true)

  log(success ? "success" : "error", `Execution ${success ? "completed" : "failed"} in ${duration}ms`)

  return {
    packetId: packet.id,
    success,
    taskResults,
    appliedResult,
    logs,
    duration,
    totalTokens,
    errors
  }
}

/**
 * Self-critique generated code
 */
export async function selfCritique(
  packet: WorkPacket,
  generatedCode: string,
  context: RepoContext,
  options?: {
    preferredServer?: string
  }
): Promise<SelfCritiqueResult> {
  const { systemPrompt, userPrompt } = buildSelfCritiquePrompt(packet, generatedCode, context)

  const result = await generateWithLocalLLM(systemPrompt, userPrompt, {
    preferredServer: options?.preferredServer,
    temperature: 0.2,
    max_tokens: 2048
  })

  if (result.error) {
    return {
      issues: [result.error],
      suggestions: [],
      confidence: 0,
      passesAcceptanceCriteria: false,
      criteriaMet: [],
      criteriaMissing: packet.acceptanceCriteria
    }
  }

  // Parse JSON response
  try {
    // Extract JSON from possible markdown code block
    let jsonStr = result.content
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }

    const parsed = JSON.parse(jsonStr)
    return {
      issues: parsed.issues || [],
      suggestions: parsed.suggestions || [],
      confidence: parsed.confidence || 0,
      passesAcceptanceCriteria: parsed.passesAcceptanceCriteria || false,
      criteriaMet: parsed.criteriaMet || [],
      criteriaMissing: parsed.criteriaMissing || []
    }
  } catch {
    return {
      issues: ["Failed to parse self-critique response"],
      suggestions: [],
      confidence: 0,
      passesAcceptanceCriteria: false,
      criteriaMet: [],
      criteriaMissing: packet.acceptanceCriteria
    }
  }
}

/**
 * Extract keywords from packet for file matching
 */
function extractKeywords(packet: WorkPacket): string[] {
  const keywords: string[] = []

  // From title
  const titleWords = packet.title.toLowerCase().split(/\s+/)
  keywords.push(...titleWords.filter(w => w.length > 3))

  // From description
  const descWords = packet.description.toLowerCase().split(/\s+/)
  keywords.push(...descWords.filter(w => w.length > 4).slice(0, 5))

  // From task descriptions
  for (const task of packet.tasks) {
    const taskWords = task.description.toLowerCase().split(/\s+/)
    keywords.push(...taskWords.filter(w => w.length > 4).slice(0, 3))
  }

  // Deduplicate
  return [...new Set(keywords)].slice(0, 15)
}
