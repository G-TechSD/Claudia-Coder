/**
 * Iteration Loop (Ralph Wiggum Loop)
 *
 * Iterative development loop that:
 * 1. Generates code
 * 2. Self-critiques
 * 3. Validates (syntax, types, tests)
 * 4. Retries if needed
 * 5. Requests approval for high-risk changes
 */

import type { WorkPacket } from "@/lib/ai/build-plan"
import type { LinkedRepo } from "@/lib/data/types"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"
import { buildPacketPrompt, buildSelfCritiquePrompt } from "./prompts"
import { parseCodeOutput, applyToGitLab, type FileChange, type ApplyResult } from "./apply-code"
import { getRepoContext, type RepoContext } from "./repo-context"

export interface IterationConfig {
  maxIterations: number
  triggers: {
    onTestFailure: boolean
    onValidationFailure: boolean
    onLowConfidence: boolean
  }
  approvalGates: {
    beforeCodeApply: boolean
    beforeMerge: boolean
    onHighRiskChange: boolean
  }
  selfCriticism: {
    enabled: boolean
    minConfidence: number // 0-1, retry if below
    maxRetries: number
  }
}

export interface IterationUpdate {
  type: "started" | "generating" | "critiquing" | "validating" | "applying" | "awaiting_approval" | "completed" | "failed"
  iteration: number
  maxIterations: number
  message: string
  data?: unknown
}

export interface SelfCritiqueResult {
  issues: string[]
  suggestions: string[]
  confidence: number
  passesAcceptanceCriteria: boolean
  criteriaMet: string[]
  criteriaMissing: string[]
}

export interface IterationResult {
  success: boolean
  iterations: number
  files: FileChange[]
  appliedResult?: ApplyResult
  critique?: SelfCritiqueResult
  errors: string[]
  duration: number
}

const DEFAULT_CONFIG: IterationConfig = {
  maxIterations: 3,
  triggers: {
    onTestFailure: true,
    onValidationFailure: true,
    onLowConfidence: true
  },
  approvalGates: {
    beforeCodeApply: false,
    beforeMerge: true,
    onHighRiskChange: true
  },
  selfCriticism: {
    enabled: true,
    minConfidence: 0.7,
    maxRetries: 2
  }
}

/**
 * Parse self-critique response from LLM
 */
function parseCritiqueResponse(content: string): SelfCritiqueResult {
  try {
    // Extract JSON from possible markdown code block
    let jsonStr = content
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      jsonStr = jsonMatch[1]
    }

    const parsed = JSON.parse(jsonStr)
    return {
      issues: parsed.issues || [],
      suggestions: parsed.suggestions || [],
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.5,
      passesAcceptanceCriteria: Boolean(parsed.passesAcceptanceCriteria),
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
      criteriaMissing: []
    }
  }
}

/**
 * Run the iteration loop
 */
export async function* runIterationLoop(
  packet: WorkPacket,
  repo: LinkedRepo,
  config: Partial<IterationConfig> = {},
  options?: {
    preferredServer?: string
    branchName?: string
    onApprovalNeeded?: (data: unknown) => Promise<boolean>
  }
): AsyncGenerator<IterationUpdate, IterationResult, unknown> {
  const startTime = Date.now()
  const fullConfig: IterationConfig = { ...DEFAULT_CONFIG, ...config }
  const errors: string[] = []
  let iteration = 0
  let currentFiles: FileChange[] = []
  let lastCritique: SelfCritiqueResult | undefined
  let context: RepoContext

  yield {
    type: "started",
    iteration: 0,
    maxIterations: fullConfig.maxIterations,
    message: `Starting iteration loop for: ${packet.title}`
  }

  // Get repo context
  try {
    context = await getRepoContext(repo)
    yield {
      type: "started",
      iteration: 0,
      maxIterations: fullConfig.maxIterations,
      message: `Got repo context: ${context.techStack.join(", ")}`
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to get repo context"
    errors.push(msg)
    return {
      success: false,
      iterations: 0,
      files: [],
      errors,
      duration: Date.now() - startTime
    }
  }

  while (iteration < fullConfig.maxIterations) {
    iteration++

    // 1. Generate code
    yield {
      type: "generating",
      iteration,
      maxIterations: fullConfig.maxIterations,
      message: `Generating code (iteration ${iteration}/${fullConfig.maxIterations})...`
    }

    const { systemPrompt, userPrompt } = buildPacketPrompt(packet, context)

    // If we have previous issues, add them to the prompt
    let enhancedUserPrompt = userPrompt
    if (lastCritique && lastCritique.issues.length > 0) {
      enhancedUserPrompt += `\n\nPREVIOUS ISSUES TO FIX:\n${lastCritique.issues.map(i => `- ${i}`).join("\n")}`
    }

    const genResult = await generateWithLocalLLM(systemPrompt, enhancedUserPrompt, {
      preferredServer: options?.preferredServer,
      temperature: 0.3,
      max_tokens: 8192
    })

    if (genResult.error) {
      errors.push(genResult.error)
      yield {
        type: "failed",
        iteration,
        maxIterations: fullConfig.maxIterations,
        message: `Generation failed: ${genResult.error}`
      }
      continue
    }

    // Parse output
    const parsed = parseCodeOutput(genResult.content)
    if (parsed.files.length === 0) {
      errors.push("No files generated")
      yield {
        type: "failed",
        iteration,
        maxIterations: fullConfig.maxIterations,
        message: "No files generated from LLM output"
      }
      continue
    }

    currentFiles = parsed.files
    yield {
      type: "generating",
      iteration,
      maxIterations: fullConfig.maxIterations,
      message: `Generated ${currentFiles.length} files`,
      data: { files: currentFiles.map(f => f.path) }
    }

    // 2. Self-critique (if enabled)
    if (fullConfig.selfCriticism.enabled) {
      yield {
        type: "critiquing",
        iteration,
        maxIterations: fullConfig.maxIterations,
        message: "Self-critiquing generated code..."
      }

      const critiquePrompt = buildSelfCritiquePrompt(
        packet,
        currentFiles.map(f => `// ${f.path}\n${f.content}`).join("\n\n"),
        context
      )

      const critiqueResult = await generateWithLocalLLM(
        critiquePrompt.systemPrompt,
        critiquePrompt.userPrompt,
        {
          preferredServer: options?.preferredServer,
          temperature: 0.2,
          max_tokens: 2048
        }
      )

      if (!critiqueResult.error) {
        lastCritique = parseCritiqueResponse(critiqueResult.content)

        yield {
          type: "critiquing",
          iteration,
          maxIterations: fullConfig.maxIterations,
          message: `Self-critique: ${(lastCritique.confidence * 100).toFixed(0)}% confidence`,
          data: lastCritique
        }

        // Check if we need to iterate
        if (
          fullConfig.triggers.onLowConfidence &&
          lastCritique.confidence < fullConfig.selfCriticism.minConfidence &&
          iteration < fullConfig.maxIterations
        ) {
          yield {
            type: "critiquing",
            iteration,
            maxIterations: fullConfig.maxIterations,
            message: `Confidence ${(lastCritique.confidence * 100).toFixed(0)}% below threshold ${(fullConfig.selfCriticism.minConfidence * 100).toFixed(0)}%, iterating...`
          }
          continue
        }

        // Check if acceptance criteria are met
        if (!lastCritique.passesAcceptanceCriteria && iteration < fullConfig.maxIterations) {
          yield {
            type: "critiquing",
            iteration,
            maxIterations: fullConfig.maxIterations,
            message: `Missing criteria: ${lastCritique.criteriaMissing.join(", ")}. Iterating...`
          }
          continue
        }
      }
    }

    // 3. Approval gate (if enabled)
    if (fullConfig.approvalGates.beforeCodeApply && options?.onApprovalNeeded) {
      yield {
        type: "awaiting_approval",
        iteration,
        maxIterations: fullConfig.maxIterations,
        message: "Awaiting approval before applying code...",
        data: { files: currentFiles, critique: lastCritique }
      }

      const approved = await options.onApprovalNeeded({ files: currentFiles, critique: lastCritique })
      if (!approved) {
        return {
          success: false,
          iterations: iteration,
          files: currentFiles,
          critique: lastCritique,
          errors: ["Approval denied"],
          duration: Date.now() - startTime
        }
      }
    }

    // 4. Apply code
    yield {
      type: "applying",
      iteration,
      maxIterations: fullConfig.maxIterations,
      message: `Applying ${currentFiles.length} files to repository...`
    }

    const branchName = options?.branchName || `claudia/${packet.id}`
    const appliedResult = await applyToGitLab(
      repo,
      currentFiles,
      `feat: ${packet.title}\n\nGenerated by Claudia (iteration ${iteration})`,
      {
        branch: branchName,
        createBranch: true
      }
    )

    if (!appliedResult.success) {
      errors.push(...appliedResult.errors)
      yield {
        type: "failed",
        iteration,
        maxIterations: fullConfig.maxIterations,
        message: `Failed to apply code: ${appliedResult.errors.join(", ")}`
      }

      if (fullConfig.triggers.onValidationFailure && iteration < fullConfig.maxIterations) {
        // Add the errors as issues for the next iteration
        if (lastCritique) {
          lastCritique.issues.push(...appliedResult.errors)
        } else {
          lastCritique = {
            issues: appliedResult.errors,
            suggestions: [],
            confidence: 0,
            passesAcceptanceCriteria: false,
            criteriaMet: [],
            criteriaMissing: packet.acceptanceCriteria
          }
        }
        continue
      }

      return {
        success: false,
        iterations: iteration,
        files: currentFiles,
        appliedResult,
        critique: lastCritique,
        errors,
        duration: Date.now() - startTime
      }
    }

    // Success!
    yield {
      type: "completed",
      iteration,
      maxIterations: fullConfig.maxIterations,
      message: `Successfully completed in ${iteration} iteration(s)`,
      data: { commit: appliedResult.commit }
    }

    return {
      success: true,
      iterations: iteration,
      files: currentFiles,
      appliedResult,
      critique: lastCritique,
      errors,
      duration: Date.now() - startTime
    }
  }

  // Max iterations reached
  yield {
    type: "failed",
    iteration,
    maxIterations: fullConfig.maxIterations,
    message: `Max iterations (${fullConfig.maxIterations}) reached without success`
  }

  return {
    success: false,
    iterations: iteration,
    files: currentFiles,
    critique: lastCritique,
    errors: [...errors, `Max iterations (${fullConfig.maxIterations}) reached`],
    duration: Date.now() - startTime
  }
}

/**
 * Run iteration loop and collect all updates (non-streaming version)
 */
export async function executeWithIteration(
  packet: WorkPacket,
  repo: LinkedRepo,
  config?: Partial<IterationConfig>,
  options?: {
    preferredServer?: string
    branchName?: string
    onUpdate?: (update: IterationUpdate) => void
    onApprovalNeeded?: (data: unknown) => Promise<boolean>
  }
): Promise<IterationResult> {
  const loop = runIterationLoop(packet, repo, config, {
    preferredServer: options?.preferredServer,
    branchName: options?.branchName,
    onApprovalNeeded: options?.onApprovalNeeded
  })

  for await (const update of loop) {
    options?.onUpdate?.(update)

    // The last value returned by the generator is the result
    if (update.type === "completed" || update.type === "failed") {
      // Get the return value
    }
  }

  // Get the return value from the generator
  const { value: finalValue } = await loop.next()
  const result = finalValue as IterationResult | undefined

  return result || {
    success: false,
    iterations: 0,
    files: [],
    errors: ["Iteration loop did not complete"],
    duration: 0
  }
}
