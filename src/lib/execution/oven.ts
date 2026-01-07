/**
 * Packet Compilation Oven
 *
 * Orchestrates the complete code generation pipeline:
 * 1. Takes a project and its packets
 * 2. Orders packets by phase (scaffold → shared → features → integration)
 * 3. Runs each packet through the long-horizon engine
 * 4. Applies generated code to the repository
 * 5. Runs the "Ralph Wiggum Loop" until quality thresholds are met
 *
 * The oven "bakes" packets into complete, working applications.
 */

import type { WorkPacket, BuildPlan } from "@/lib/ai/build-plan"
import type { LinkedRepo } from "@/lib/data/types"
import type { Project } from "@/lib/data/types"
import { runLongHorizonEngine, type LongHorizonUpdate, type LongHorizonResult, type GenerationPhase, type GuardrailConfig } from "./long-horizon-engine"
import { createScaffold, detectTemplate, type ProjectTemplate, type ScaffoldResult } from "./scaffolding"
import { applyToGitLab, applyWithMergeRequest, type FileChange, type ApplyResult } from "./apply-code"
import { validateFiles, type ValidationResult } from "./validator"

/**
 * Oven state for tracking baking progress
 */
export type OvenState =
  | "idle"
  | "preheating"      // Setting up, checking connections
  | "scaffolding"     // Creating base structure
  | "mixing"          // Preparing packets for execution
  | "baking"          // Actively generating code
  | "testing"         // Running validation
  | "cooling"         // Applying to repo
  | "complete"
  | "burnt"           // Failed

/**
 * Quality tier for output
 */
export type QualityTier =
  | "raw"            // Just generated, no validation
  | "tested"         // Passes basic validation
  | "crispy"         // Passes all quality gates
  | "golden-brown"   // Approved and deployed

/**
 * Baking configuration
 */
export interface BakeConfig {
  // Model selection
  preferredServer?: string
  preferredModel?: string

  // Behavior
  autoScaffold: boolean           // Create scaffold if needed
  autoApply: boolean              // Apply to repo when done
  createMergeRequest: boolean     // Create MR instead of direct commit

  // Quality thresholds
  minConfidence: number           // 0-1
  maxIterations: number           // Per packet
  requireValidation: boolean      // Must pass linting/type checks

  // Safety
  dryRun: boolean                 // Don't actually apply changes
  branchPrefix: string            // Branch naming prefix
}

/**
 * Progress update during baking
 */
export interface BakeUpdate {
  state: OvenState
  packetIndex: number
  totalPackets: number
  currentPacket?: string
  phase?: GenerationPhase
  iteration?: number
  maxIterations?: number
  message: string
  confidence?: number
  filesGenerated?: number
  errors?: string[]
  timestamp: Date
}

/**
 * Result of a completed bake
 */
export interface BakeResult {
  success: boolean
  qualityTier: QualityTier
  scaffoldResult?: ScaffoldResult
  packetResults: {
    packetId: string
    packetTitle: string
    result: LongHorizonResult
    validation?: ValidationResult
    applied?: boolean
  }[]
  allFiles: FileChange[]
  applyResult?: ApplyResult
  totalIterations: number
  duration: number
  errors: string[]
}

const DEFAULT_BAKE_CONFIG: BakeConfig = {
  autoScaffold: true,
  autoApply: true,
  createMergeRequest: true,
  minConfidence: 0.75,
  maxIterations: 15,
  requireValidation: true,
  dryRun: false,
  branchPrefix: "claudia"
}

/**
 * Determine the generation phase for a packet based on its content
 */
function classifyPacketPhase(packet: WorkPacket): GenerationPhase {
  const title = packet.title.toLowerCase()
  const desc = packet.description.toLowerCase()
  const combined = `${title} ${desc}`

  // Check for scaffold indicators
  if (combined.includes("setup") ||
      combined.includes("initial") ||
      combined.includes("project structure") ||
      combined.includes("config")) {
    return "scaffold"
  }

  // Check for shared/utility indicators
  if (combined.includes("shared") ||
      combined.includes("utility") ||
      combined.includes("component library") ||
      combined.includes("types") ||
      combined.includes("hooks")) {
    return "shared"
  }

  // Check for integration indicators
  if (combined.includes("navigation") ||
      combined.includes("routing") ||
      combined.includes("layout") ||
      combined.includes("integration")) {
    return "integration"
  }

  // Check for polish indicators
  if (combined.includes("test") ||
      combined.includes("documentation") ||
      combined.includes("cleanup") ||
      combined.includes("polish")) {
    return "polish"
  }

  // Default to features
  return "features"
}

/**
 * Sort packets by optimal execution order
 */
function sortPacketsByPhase(packets: WorkPacket[]): WorkPacket[] {
  const phaseOrder: Record<GenerationPhase, number> = {
    scaffold: 0,
    shared: 1,
    features: 2,
    integration: 3,
    polish: 4
  }

  return [...packets].sort((a, b) => {
    const phaseA = classifyPacketPhase(a)
    const phaseB = classifyPacketPhase(b)
    return phaseOrder[phaseA] - phaseOrder[phaseB]
  })
}

/**
 * The main oven: bakes packets into complete applications
 */
export async function* bakeProject(
  project: Project,
  packets: WorkPacket[],
  repo: LinkedRepo,
  config: Partial<BakeConfig> = {}
): AsyncGenerator<BakeUpdate, BakeResult, unknown> {
  const startTime = Date.now()
  const cfg: BakeConfig = { ...DEFAULT_BAKE_CONFIG, ...config }
  const errors: string[] = []
  const allFiles: FileChange[] = []

  let state: OvenState = "idle"
  let scaffoldResult: ScaffoldResult | undefined

  const packetResults: BakeResult["packetResults"] = []

  const emit = (update: Partial<BakeUpdate>): BakeUpdate => ({
    state,
    packetIndex: 0,
    totalPackets: packets.length,
    message: "",
    timestamp: new Date(),
    ...update
  })

  // === PREHEAT: Check connections and prepare ===
  state = "preheating"
  yield emit({
    message: `Preheating oven for ${project.name}...`,
  })

  // Sort packets by optimal order
  const sortedPackets = sortPacketsByPhase(packets)

  yield emit({
    message: `Found ${sortedPackets.length} packets, sorted by phase order`
  })

  // === SCAFFOLD: Create base structure if needed ===
  if (cfg.autoScaffold) {
    state = "scaffolding"
    yield emit({
      message: "Checking if scaffolding is needed..."
    })

    // Detect if project already has a template
    const existingTemplate = detectTemplate([]) // Would need repo files here

    if (!existingTemplate) {
      yield emit({
        message: "Creating project scaffold..."
      })

      // Determine best template based on project description
      const template = determineTemplate(project)

      scaffoldResult = createScaffold({
        template,
        projectName: project.name.toLowerCase().replace(/\s+/g, "-"),
        features: [], // Could parse from packets
        includeTests: true
      })

      if (scaffoldResult.success) {
        allFiles.push(...scaffoldResult.files)
        yield emit({
          message: `Created scaffold with ${scaffoldResult.files.length} base files`
        })
      } else {
        errors.push(...scaffoldResult.errors)
        yield emit({
          message: `Scaffold had issues: ${scaffoldResult.errors.join(", ")}`
        })
      }
    } else {
      yield emit({
        message: `Using existing ${existingTemplate} template`
      })
    }
  }

  // === MIXING: Prepare packets for execution ===
  state = "mixing"
  yield emit({
    message: "Preparing ingredients (analyzing packets)..."
  })

  // Build packet dependency graph and execution plan
  const executionPlan = sortedPackets.map((packet, index) => ({
    packet,
    phase: classifyPacketPhase(packet),
    index
  }))

  yield emit({
    message: `Execution plan: ${executionPlan.map(p => `${p.phase}:${p.packet.title}`).join(" → ")}`
  })

  // === BAKING: Execute each packet through long-horizon engine ===
  state = "baking"
  let totalIterations = 0

  for (let i = 0; i < executionPlan.length; i++) {
    const { packet, phase } = executionPlan[i]

    yield emit({
      state: "baking",
      packetIndex: i + 1,
      currentPacket: packet.title,
      phase,
      message: `Baking packet ${i + 1}/${sortedPackets.length}: ${packet.title}`
    })

    // Run long-horizon engine for this packet
    const engine = runLongHorizonEngine(packet, repo, {
      preferredServer: cfg.preferredServer,
      preferredModel: cfg.preferredModel,
      onlyPhases: [phase],
      guardrails: {
        maxTotalIterations: cfg.maxIterations,
        minConfidenceToAdvance: cfg.minConfidence,
        requireCritiquePass: cfg.requireValidation
      }
    })

    let packetResult: LongHorizonResult | undefined

    for await (const update of engine) {
      // Forward long-horizon updates
      yield emit({
        state: "baking",
        packetIndex: i + 1,
        currentPacket: packet.title,
        phase: update.phase,
        iteration: update.iteration,
        maxIterations: update.totalIterations,
        message: update.message,
        confidence: update.confidence,
        filesGenerated: update.filesGenerated
      })
    }

    // Get final result
    const { value } = await engine.next()
    packetResult = value as LongHorizonResult

    if (packetResult) {
      totalIterations += packetResult.totalIterations
      allFiles.push(...packetResult.allFiles)
      errors.push(...packetResult.errors)

      // === TESTING: Validate generated code ===
      let validation: ValidationResult | undefined
      if (cfg.requireValidation && packetResult.allFiles.length > 0) {
        state = "testing"
        yield emit({
          state: "testing",
          packetIndex: i + 1,
          currentPacket: packet.title,
          message: "Running validation..."
        })

        validation = await validateFiles(packetResult.allFiles)

        yield emit({
          state: "testing",
          packetIndex: i + 1,
          currentPacket: packet.title,
          message: validation.valid
            ? `Validation passed: ${validation.filesChecked} files OK`
            : `Validation issues: ${validation.errors.length} errors, ${validation.warnings.length} warnings`,
          errors: validation.errors.map(e => e.message)
        })
      }

      packetResults.push({
        packetId: packet.id,
        packetTitle: packet.title,
        result: packetResult,
        validation
      })
    }

    state = "baking" // Resume baking
  }

  // === COOLING: Apply to repository ===
  let applyResult: ApplyResult | undefined

  if (cfg.autoApply && allFiles.length > 0 && !cfg.dryRun) {
    state = "cooling"
    yield emit({
      state: "cooling",
      packetIndex: sortedPackets.length,
      message: "Cooling down: applying to repository..."
    })

    const branchName = `${cfg.branchPrefix}/${project.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`
    const commitMessage = `feat: ${project.name}\n\nGenerated by Claudia\n\nPackets:\n${sortedPackets.map(p => `- ${p.title}`).join("\n")}`

    if (cfg.createMergeRequest) {
      applyResult = await applyWithMergeRequest(
        repo,
        allFiles,
        commitMessage,
        branchName,
        {
          title: `[Claudia] ${project.name}`,
          description: `Automated code generation for ${project.name}\n\n${sortedPackets.length} packets baked.`
        }
      )
    } else {
      applyResult = await applyToGitLab(repo, allFiles, commitMessage, {
        branch: branchName,
        createBranch: true
      })
    }

    if (applyResult.success) {
      yield emit({
        state: "cooling",
        message: `Applied ${allFiles.length} files to ${branchName}`
      })

      // Mark packets as applied
      packetResults.forEach(pr => {
        pr.applied = true
      })
    } else {
      errors.push(...applyResult.errors)
      yield emit({
        state: "cooling",
        message: `Failed to apply: ${applyResult.errors.join(", ")}`,
        errors: applyResult.errors
      })
    }
  }

  // === FINAL STATE ===
  const success = errors.length === 0 && packetResults.every(pr => pr.result.success)

  // Determine quality tier
  let qualityTier: QualityTier = "raw"
  if (success) {
    const allValidated = packetResults.every(pr => pr.validation?.valid !== false)
    const allHighConfidence = packetResults.every(pr =>
      pr.result.phases.every(p => p.confidence >= cfg.minConfidence)
    )

    if (allValidated && allHighConfidence) {
      qualityTier = "crispy"
    } else if (allValidated) {
      qualityTier = "tested"
    }

    if (applyResult?.success && qualityTier === "crispy") {
      qualityTier = "golden-brown"
    }
  }

  state = success ? "complete" : "burnt"

  yield emit({
    state,
    packetIndex: sortedPackets.length,
    totalPackets: sortedPackets.length,
    message: success
      ? `Baking complete! ${allFiles.length} files at ${qualityTier} quality`
      : `Baking failed: ${errors.length} errors`,
    errors
  })

  return {
    success,
    qualityTier,
    scaffoldResult,
    packetResults,
    allFiles,
    applyResult,
    totalIterations,
    duration: Date.now() - startTime,
    errors
  }
}

/**
 * Determine best template based on project info
 */
function determineTemplate(project: Project): ProjectTemplate {
  const desc = (project.description || "").toLowerCase()
  const name = project.name.toLowerCase()

  if (desc.includes("mobile") || desc.includes("flutter") || desc.includes("app")) {
    return "flutter"
  }

  if (desc.includes("cli") || desc.includes("command line") || desc.includes("terminal")) {
    return "cli"
  }

  if (desc.includes("api") || desc.includes("backend") || desc.includes("server")) {
    if (desc.includes("python") || desc.includes("fastapi")) {
      return "python-fastapi"
    }
    return "node-express"
  }

  // Default to Next.js app for web projects
  return "nextjs-app"
}

/**
 * Non-generator version for simpler usage
 */
export async function bakeProjectSimple(
  project: Project,
  packets: WorkPacket[],
  repo: LinkedRepo,
  config: Partial<BakeConfig> = {},
  onUpdate?: (update: BakeUpdate) => void
): Promise<BakeResult> {
  const oven = bakeProject(project, packets, repo, config)

  let result: BakeResult | undefined

  for await (const update of oven) {
    onUpdate?.(update)
  }

  const { value } = await oven.next()
  result = value as BakeResult

  return result || {
    success: false,
    qualityTier: "raw",
    packetResults: [],
    allFiles: [],
    totalIterations: 0,
    duration: 0,
    errors: ["Oven did not complete"]
  }
}

/**
 * Ralph Wiggum Loop: Keep iterating until quality is acceptable
 *
 * "I'm baking! And baking! And baking!"
 */
export async function* ralphWiggumLoop(
  project: Project,
  packets: WorkPacket[],
  repo: LinkedRepo,
  config: Partial<BakeConfig> & {
    maxBakes?: number        // Maximum full bake attempts
    targetQuality?: QualityTier
  } = {}
): AsyncGenerator<BakeUpdate & { bakeAttempt: number }, BakeResult, unknown> {
  const maxBakes = config.maxBakes || 3
  const targetQuality = config.targetQuality || "crispy"

  const qualityOrder: Record<QualityTier, number> = {
    "raw": 0,
    "tested": 1,
    "crispy": 2,
    "golden-brown": 3
  }

  let lastResult: BakeResult | undefined
  let attempt = 0

  while (attempt < maxBakes) {
    attempt++

    yield {
      state: "preheating",
      packetIndex: 0,
      totalPackets: packets.length,
      message: `Ralph Wiggum Loop: Bake attempt ${attempt}/${maxBakes}`,
      timestamp: new Date(),
      bakeAttempt: attempt
    }

    // Run the oven
    const oven = bakeProject(project, packets, repo, {
      ...config,
      // Increase confidence threshold on retries
      minConfidence: Math.min(0.95, (config.minConfidence || 0.75) + (attempt - 1) * 0.05)
    })

    for await (const update of oven) {
      yield { ...update, bakeAttempt: attempt }
    }

    const { value } = await oven.next()
    lastResult = value as BakeResult

    // Check if we've reached target quality
    if (lastResult && qualityOrder[lastResult.qualityTier] >= qualityOrder[targetQuality]) {
      yield {
        state: "complete",
        packetIndex: packets.length,
        totalPackets: packets.length,
        message: `Ralph succeeded! Reached ${lastResult.qualityTier} quality after ${attempt} attempts`,
        timestamp: new Date(),
        bakeAttempt: attempt
      }
      return lastResult
    }

    // Log why we're retrying
    yield {
      state: lastResult?.success ? "baking" : "burnt",
      packetIndex: packets.length,
      totalPackets: packets.length,
      message: `Attempt ${attempt} produced ${lastResult?.qualityTier} quality, retrying for ${targetQuality}...`,
      errors: lastResult?.errors,
      timestamp: new Date(),
      bakeAttempt: attempt
    }
  }

  // Exhausted retries
  yield {
    state: "burnt",
    packetIndex: packets.length,
    totalPackets: packets.length,
    message: `Ralph gave up after ${maxBakes} attempts. Best quality: ${lastResult?.qualityTier}`,
    errors: lastResult?.errors,
    timestamp: new Date(),
    bakeAttempt: attempt
  }

  return lastResult || {
    success: false,
    qualityTier: "raw",
    packetResults: [],
    allFiles: [],
    totalIterations: 0,
    duration: 0,
    errors: ["Ralph Wiggum could not bake to target quality"]
  }
}
