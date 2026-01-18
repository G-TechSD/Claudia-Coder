/**
 * Long-Horizon Iteration Engine
 *
 * Manages extended code generation sessions with:
 * - Context summarization to prevent drift
 * - Guardrails to keep generation on track
 * - Phase-based dependency ordering
 * - Progress tracking and checkpoints
 */

import type { WorkPacket } from "@/lib/ai/build-plan"
import type { LinkedRepo } from "@/lib/data/types"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"
import { buildSelfCritiquePrompt } from "./prompts"
import { parseCodeOutput, type FileChange } from "./apply-code"
import { getRepoContext, type RepoContext } from "./repo-context"

/**
 * Generation phases for dependency ordering
 */
export type GenerationPhase =
  | "scaffold"      // Base project structure (package.json, tsconfig, etc.)
  | "shared"        // Shared components, utilities, types
  | "features"      // Feature implementations
  | "integration"   // Navigation, routing, integration
  | "polish"        // Tests, docs, cleanup

/**
 * Context summary to maintain focus across iterations
 */
export interface ContextSummary {
  projectName: string
  techStack: string[]
  currentPhase: GenerationPhase
  completedFiles: string[]
  pendingTasks: string[]
  keyDecisions: string[]
  issues: string[]
  iteration: number
}

/**
 * Guardrails configuration
 */
export interface GuardrailConfig {
  // Context management
  maxContextTokens: number         // Summarize when context exceeds this
  summarizeEveryNIterations: number // Force summarization periodically

  // Quality gates
  minConfidenceToAdvance: number   // 0-1, must meet to move forward
  maxRetriesPerPhase: number       // Retries before escalating
  requireCritiquePass: boolean     // Must pass self-critique

  // Safety limits
  maxTotalIterations: number       // Absolute maximum iterations
  maxTokensPerGeneration: number   // Limit per generation call
  timeoutMinutes: number           // Overall timeout
}

/**
 * Iteration update for progress tracking
 */
export interface LongHorizonUpdate {
  type: "phase_start" | "generating" | "critiquing" | "summarizing" | "checkpoint" | "phase_complete" | "completed" | "failed"
  phase: GenerationPhase
  iteration: number
  totalIterations: number
  message: string
  confidence?: number
  filesGenerated?: number
  contextSummary?: ContextSummary
  data?: unknown
}

/**
 * Result of long-horizon execution
 */
export interface LongHorizonResult {
  success: boolean
  phases: {
    phase: GenerationPhase
    iterations: number
    files: FileChange[]
    confidence: number
  }[]
  allFiles: FileChange[]
  contextHistory: ContextSummary[]
  totalIterations: number
  duration: number
  errors: string[]
}

const DEFAULT_GUARDRAILS: GuardrailConfig = {
  maxContextTokens: 8000,
  summarizeEveryNIterations: 3,
  minConfidenceToAdvance: 0.75,
  maxRetriesPerPhase: 5,
  requireCritiquePass: true,
  maxTotalIterations: 25,
  maxTokensPerGeneration: 8192,
  timeoutMinutes: 30
}

/**
 * Phase-specific prompts for better context
 */
const PHASE_PROMPTS: Record<GenerationPhase, { focus: string; examples: string }> = {
  scaffold: {
    focus: "Create the foundational project structure",
    examples: "package.json, tsconfig.json, tailwind.config.ts, src/app/layout.tsx, src/app/globals.css"
  },
  shared: {
    focus: "Create shared components, utilities, and type definitions",
    examples: "components/ui/*, lib/utils.ts, types/*.ts, hooks/*.ts"
  },
  features: {
    focus: "Implement the feature pages and functionality",
    examples: "app/feature-name/page.tsx, components/FeatureComponent.tsx"
  },
  integration: {
    focus: "Add navigation, routing, and integrate all components",
    examples: "components/Navigation.tsx, app/layout.tsx updates, linking between pages"
  },
  polish: {
    focus: "Add tests, documentation, and final cleanup",
    examples: "*.test.ts, README.md, comments, error handling improvements"
  }
}

/**
 * Summarize context to prevent drift
 */
async function summarizeContext(
  context: ContextSummary,
  recentOutput: string,
  options: { preferredServer?: string }
): Promise<ContextSummary> {
  const systemPrompt = `You are a project context manager. Summarize the current state of a code generation project.
Output JSON in this exact format:
{
  "completedFiles": ["list of generated files"],
  "pendingTasks": ["remaining work to do"],
  "keyDecisions": ["important architectural decisions made"],
  "issues": ["problems encountered or to watch for"]
}

Be concise but complete. Focus on what's important for continuing the work.`

  const userPrompt = `PROJECT: ${context.projectName}
TECH STACK: ${context.techStack.join(", ")}
CURRENT PHASE: ${context.currentPhase}
ITERATION: ${context.iteration}

PREVIOUSLY COMPLETED FILES:
${context.completedFiles.slice(-10).join("\n")}

RECENT OUTPUT:
${recentOutput.slice(0, 2000)}

Summarize the current project state.`

  const result = await generateWithLocalLLM(systemPrompt, userPrompt, {
    preferredServer: options.preferredServer,
    temperature: 0.1,
    max_tokens: 1024
  })

  if (result.error) {
    return context // Keep existing on error
  }

  try {
    let jsonStr = result.content
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) jsonStr = jsonMatch[1]

    const parsed = JSON.parse(jsonStr)

    return {
      ...context,
      completedFiles: [...new Set([...context.completedFiles, ...(parsed.completedFiles || [])])],
      pendingTasks: parsed.pendingTasks || context.pendingTasks,
      keyDecisions: [...context.keyDecisions, ...(parsed.keyDecisions || [])].slice(-10),
      issues: parsed.issues || context.issues
    }
  } catch {
    return context
  }
}

/**
 * Build phase-aware prompt
 */
function buildPhasePrompt(
  packet: WorkPacket,
  context: RepoContext,
  phase: GenerationPhase,
  contextSummary: ContextSummary
): { systemPrompt: string; userPrompt: string } {
  const phaseInfo = PHASE_PROMPTS[phase]

  const systemPrompt = `You are a senior developer working on the "${phase}" phase of a project.
Your focus: ${phaseInfo.focus}
Expected outputs: ${phaseInfo.examples}

Output ONLY valid code. Use this format for each file:

=== FILE: path/to/file.ts ===
\`\`\`typescript
// file contents here
\`\`\`

Rules:
- Complete, working code only
- Follow existing patterns in the project
- Do not repeat files already created
- Consider dependencies on other files
- Do not explain - just write code`

  const completedSection = contextSummary.completedFiles.length > 0
    ? `ALREADY CREATED FILES (do not recreate):
${contextSummary.completedFiles.slice(-20).join("\n")}`
    : ""

  const decisionsSection = contextSummary.keyDecisions.length > 0
    ? `KEY DECISIONS TO FOLLOW:
${contextSummary.keyDecisions.map(d => `- ${d}`).join("\n")}`
    : ""

  const issuesSection = contextSummary.issues.length > 0
    ? `ISSUES TO ADDRESS:
${contextSummary.issues.map(i => `- ${i}`).join("\n")}`
    : ""

  const userPrompt = `PROJECT: ${context.projectName}
TECH STACK: ${context.techStack.join(", ")}
PHASE: ${phase.toUpperCase()} - ${phaseInfo.focus}

FEATURE: ${packet.title}
${packet.description}

ACCEPTANCE CRITERIA:
${packet.acceptanceCriteria.map(c => `- ${c}`).join("\n")}

${completedSection}

${decisionsSection}

${issuesSection}

TASKS FOR THIS PHASE:
${packet.tasks.map((t, i) => `${i + 1}. ${t.description}`).join("\n")}

Generate the ${phase} phase code for this feature.`

  return { systemPrompt, userPrompt }
}

/**
 * Run the long-horizon iteration engine
 */
export async function* runLongHorizonEngine(
  packet: WorkPacket,
  repo: LinkedRepo,
  options: {
    preferredServer?: string
    preferredModel?: string
    guardrails?: Partial<GuardrailConfig>
    onlyPhases?: GenerationPhase[]
  } = {}
): AsyncGenerator<LongHorizonUpdate, LongHorizonResult, unknown> {
  const startTime = Date.now()
  const guardrails: GuardrailConfig = { ...DEFAULT_GUARDRAILS, ...options.guardrails }
  const errors: string[] = []

  // Determine phases to run
  const phases: GenerationPhase[] = options.onlyPhases || ["scaffold", "shared", "features", "integration"]

  // Initialize context
  let contextSummary: ContextSummary = {
    projectName: repo.name,
    techStack: [],
    currentPhase: phases[0],
    completedFiles: [],
    pendingTasks: packet.tasks.map(t => t.description),
    keyDecisions: [],
    issues: [],
    iteration: 0
  }

  const contextHistory: ContextSummary[] = [{ ...contextSummary }]
  const allFiles: FileChange[] = []
  const phaseResults: LongHorizonResult["phases"] = []

  let totalIterations = 0

  // Get repo context
  let repoContext: RepoContext
  try {
    repoContext = await getRepoContext(repo)
    contextSummary.techStack = repoContext.techStack
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed to get repo context"
    errors.push(msg)
    return {
      success: false,
      phases: [],
      allFiles: [],
      contextHistory,
      totalIterations: 0,
      duration: Date.now() - startTime,
      errors
    }
  }

  // Check timeout
  const checkTimeout = () => {
    const elapsed = (Date.now() - startTime) / 1000 / 60
    if (elapsed > guardrails.timeoutMinutes) {
      throw new Error(`Timeout: exceeded ${guardrails.timeoutMinutes} minutes`)
    }
  }

  // Process each phase
  for (const phase of phases) {
    contextSummary.currentPhase = phase
    let phaseIterations = 0
    let phaseFiles: FileChange[] = []
    let phaseConfidence = 0

    yield {
      type: "phase_start",
      phase,
      iteration: totalIterations,
      totalIterations: guardrails.maxTotalIterations,
      message: `Starting ${phase} phase: ${PHASE_PROMPTS[phase].focus}`
    }

    // Iterate within phase until quality gates pass
    while (phaseIterations < guardrails.maxRetriesPerPhase) {
      phaseIterations++
      totalIterations++
      contextSummary.iteration = totalIterations

      checkTimeout()

      if (totalIterations > guardrails.maxTotalIterations) {
        errors.push(`Max total iterations (${guardrails.maxTotalIterations}) exceeded`)
        break
      }

      // Generate code for this phase
      yield {
        type: "generating",
        phase,
        iteration: totalIterations,
        totalIterations: guardrails.maxTotalIterations,
        message: `Generating ${phase} code (attempt ${phaseIterations}/${guardrails.maxRetriesPerPhase})...`
      }

      const { systemPrompt, userPrompt } = buildPhasePrompt(packet, repoContext, phase, contextSummary)

      const genResult = await generateWithLocalLLM(systemPrompt, userPrompt, {
        preferredServer: options.preferredServer,
        temperature: 0.3,
        max_tokens: guardrails.maxTokensPerGeneration
      })

      if (genResult.error) {
        errors.push(`Generation error in ${phase}: ${genResult.error}`)
        continue
      }

      // Parse output
      const parsed = parseCodeOutput(genResult.content)
      if (parsed.files.length === 0) {
        errors.push(`No files generated in ${phase} phase`)
        continue
      }

      phaseFiles = parsed.files

      yield {
        type: "generating",
        phase,
        iteration: totalIterations,
        totalIterations: guardrails.maxTotalIterations,
        message: `Generated ${phaseFiles.length} files`,
        filesGenerated: phaseFiles.length
      }

      // Self-critique
      if (guardrails.requireCritiquePass) {
        yield {
          type: "critiquing",
          phase,
          iteration: totalIterations,
          totalIterations: guardrails.maxTotalIterations,
          message: "Running self-critique..."
        }

        const critiquePrompt = buildSelfCritiquePrompt(
          packet,
          phaseFiles.map(f => `// ${f.path}\n${f.content}`).join("\n\n"),
          repoContext
        )

        const critiqueResult = await generateWithLocalLLM(
          critiquePrompt.systemPrompt,
          critiquePrompt.userPrompt,
          {
            preferredServer: options.preferredServer,
            temperature: 0.2,
            max_tokens: 2048
          }
        )

        if (!critiqueResult.error) {
          try {
            let jsonStr = critiqueResult.content
            const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
            if (jsonMatch) jsonStr = jsonMatch[1]

            const critique = JSON.parse(jsonStr)
            phaseConfidence = critique.confidence || 0.5

            yield {
              type: "critiquing",
              phase,
              iteration: totalIterations,
              totalIterations: guardrails.maxTotalIterations,
              message: `Confidence: ${(phaseConfidence * 100).toFixed(0)}%`,
              confidence: phaseConfidence
            }

            // Add issues to context for next iteration
            if (critique.issues && critique.issues.length > 0) {
              contextSummary.issues = critique.issues.slice(0, 5)
            }

            // Check if we meet quality threshold
            if (phaseConfidence >= guardrails.minConfidenceToAdvance) {
              break // Move to next phase
            }
          } catch {
            phaseConfidence = 0.5 // Default on parse error
          }
        }
      } else {
        phaseConfidence = 0.8 // Default when critique disabled
        break
      }

      // Summarize context periodically
      if (totalIterations % guardrails.summarizeEveryNIterations === 0) {
        yield {
          type: "summarizing",
          phase,
          iteration: totalIterations,
          totalIterations: guardrails.maxTotalIterations,
          message: "Summarizing context to maintain focus..."
        }

        contextSummary = await summarizeContext(
          contextSummary,
          phaseFiles.map(f => f.content).join("\n"),
          { preferredServer: options.preferredServer }
        )
        contextHistory.push({ ...contextSummary })

        yield {
          type: "summarizing",
          phase,
          iteration: totalIterations,
          totalIterations: guardrails.maxTotalIterations,
          message: "Context summarized",
          contextSummary
        }
      }
    }

    // Record phase results
    contextSummary.completedFiles.push(...phaseFiles.map(f => f.path))
    allFiles.push(...phaseFiles)

    phaseResults.push({
      phase,
      iterations: phaseIterations,
      files: phaseFiles,
      confidence: phaseConfidence
    })

    yield {
      type: "phase_complete",
      phase,
      iteration: totalIterations,
      totalIterations: guardrails.maxTotalIterations,
      message: `Completed ${phase} phase: ${phaseFiles.length} files at ${(phaseConfidence * 100).toFixed(0)}% confidence`,
      confidence: phaseConfidence,
      filesGenerated: phaseFiles.length
    }

    // Checkpoint
    yield {
      type: "checkpoint",
      phase,
      iteration: totalIterations,
      totalIterations: guardrails.maxTotalIterations,
      message: `Phase checkpoint: ${allFiles.length} total files generated`,
      contextSummary
    }
  }

  // Final result
  const success = phaseResults.every(p => p.confidence >= guardrails.minConfidenceToAdvance * 0.9)

  yield {
    type: success ? "completed" : "failed",
    phase: phases[phases.length - 1],
    iteration: totalIterations,
    totalIterations: guardrails.maxTotalIterations,
    message: success
      ? `Generation complete: ${allFiles.length} files across ${phases.length} phases`
      : `Generation incomplete: ${errors.length} errors encountered`
  }

  return {
    success,
    phases: phaseResults,
    allFiles,
    contextHistory,
    totalIterations,
    duration: Date.now() - startTime,
    errors
  }
}

/**
 * Execute long-horizon generation (non-streaming)
 */
export async function executeLongHorizon(
  packet: WorkPacket,
  repo: LinkedRepo,
  options: {
    preferredServer?: string
    preferredModel?: string
    guardrails?: Partial<GuardrailConfig>
    onUpdate?: (update: LongHorizonUpdate) => void
  } = {}
): Promise<LongHorizonResult> {
  const engine = runLongHorizonEngine(packet, repo, options)

  for await (const update of engine) {
    options.onUpdate?.(update)
  }

  const { value: finalValue } = await engine.next()
  const result = finalValue as LongHorizonResult | undefined

  return result || {
    success: false,
    phases: [],
    allFiles: [],
    contextHistory: [],
    totalIterations: 0,
    duration: 0,
    errors: ["Engine did not complete"]
  }
}
