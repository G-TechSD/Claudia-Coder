/**
 * Agent Controller
 *
 * Manages the execution of development agents with:
 * - Single active project focus (prevents LLM overload)
 * - Project queue with priority ordering
 * - Simple start/stop/resume controls
 * - State persistence across sessions
 */

import type { Project, LinkedRepo } from "@/lib/data/types"
import type { WorkPacket } from "@/lib/ai/build-plan"
import { runLongHorizonEngine, type LongHorizonResult, type GenerationPhase } from "./long-horizon-engine"
import { applyToGitLab, applyWithMergeRequest, type FileChange } from "./apply-code"

// ============================================================================
// Types
// ============================================================================

export type AgentState = "idle" | "running" | "paused" | "completed" | "failed"

export type ExecutionMode = "local" | "cloud" | "hybrid"

export interface QueuedProject {
  projectId: string
  project: Project
  packets: WorkPacket[]
  repo: LinkedRepo
  priority: number  // Lower = higher priority
  addedAt: Date
  estimatedPackets: number
}

export interface ExecutionProgress {
  currentPacketIndex: number
  totalPackets: number
  currentPacketTitle: string
  currentPhase: GenerationPhase
  iteration: number
  maxIterations: number
  confidence: number
  filesGenerated: number
  startedAt: Date
  lastUpdateAt: Date
}

export interface ExecutionResult {
  projectId: string
  success: boolean
  filesGenerated: FileChange[]
  packetsCompleted: number
  packetsFailed: number
  totalIterations: number
  duration: number
  errors: string[]
  mergeRequestUrl?: string
}

export interface AgentStatus {
  state: AgentState
  activeProject: QueuedProject | null
  progress: ExecutionProgress | null
  queue: QueuedProject[]
  lastResult: ExecutionResult | null
  mode: ExecutionMode
  errors: string[]
}

// ============================================================================
// Storage Keys
// ============================================================================

const STORAGE_KEYS = {
  QUEUE: "claudia_execution_queue",
  STATE: "claudia_agent_state",
  ACTIVE: "claudia_active_project",
  RESULTS: "claudia_execution_results"
}

// ============================================================================
// Agent Controller Class
// ============================================================================

class AgentControllerClass {
  private state: AgentState = "idle"
  private queue: QueuedProject[] = []
  private activeProject: QueuedProject | null = null
  private progress: ExecutionProgress | null = null
  private lastResult: ExecutionResult | null = null
  private mode: ExecutionMode = "local"
  private errors: string[] = []
  private abortController: AbortController | null = null
  private listeners: Set<(status: AgentStatus) => void> = new Set()

  constructor() {
    this.loadState()
  }

  // --------------------------------------------------------------------------
  // State Management
  // --------------------------------------------------------------------------

  private loadState(): void {
    if (typeof window === "undefined") return

    try {
      const queueData = localStorage.getItem(STORAGE_KEYS.QUEUE)
      if (queueData) {
        this.queue = JSON.parse(queueData).map((q: QueuedProject) => ({
          ...q,
          addedAt: new Date(q.addedAt)
        }))
      }

      const stateData = localStorage.getItem(STORAGE_KEYS.STATE)
      if (stateData) {
        const { state, mode } = JSON.parse(stateData)
        this.state = state === "running" ? "paused" : state // Resume as paused
        this.mode = mode || "local"
      }

      const resultsData = localStorage.getItem(STORAGE_KEYS.RESULTS)
      if (resultsData) {
        this.lastResult = JSON.parse(resultsData)
      }
    } catch (error) {
      console.error("[AgentController] Failed to load state:", error)
    }
  }

  private saveState(): void {
    if (typeof window === "undefined") return

    try {
      localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(this.queue))
      localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify({
        state: this.state,
        mode: this.mode
      }))
      if (this.lastResult) {
        localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(this.lastResult))
      }
    } catch (error) {
      console.error("[AgentController] Failed to save state:", error)
    }
  }

  private notifyListeners(): void {
    const status = this.getStatus()
    this.listeners.forEach(listener => listener(status))
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Get current agent status
   */
  getStatus(): AgentStatus {
    return {
      state: this.state,
      activeProject: this.activeProject,
      progress: this.progress,
      queue: [...this.queue],
      lastResult: this.lastResult,
      mode: this.mode,
      errors: [...this.errors]
    }
  }

  /**
   * Subscribe to status updates
   */
  subscribe(listener: (status: AgentStatus) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Add project to queue
   */
  enqueue(
    project: Project,
    packets: WorkPacket[],
    repo: LinkedRepo,
    priority: number = 10
  ): void {
    // Check if already in queue
    const existing = this.queue.find(q => q.projectId === project.id)
    if (existing) {
      // Update priority if lower (higher priority)
      if (priority < existing.priority) {
        existing.priority = priority
        this.sortQueue()
      }
      return
    }

    this.queue.push({
      projectId: project.id,
      project,
      packets,
      repo,
      priority,
      addedAt: new Date(),
      estimatedPackets: packets.length
    })

    this.sortQueue()
    this.saveState()
    this.notifyListeners()
  }

  /**
   * Remove project from queue
   */
  dequeue(projectId: string): void {
    this.queue = this.queue.filter(q => q.projectId !== projectId)
    this.saveState()
    this.notifyListeners()
  }

  /**
   * Reorder queue
   */
  reorderQueue(projectIds: string[]): void {
    const newQueue: QueuedProject[] = []

    for (const id of projectIds) {
      const project = this.queue.find(q => q.projectId === id)
      if (project) {
        newQueue.push(project)
      }
    }

    // Add any remaining projects
    for (const project of this.queue) {
      if (!newQueue.find(q => q.projectId === project.projectId)) {
        newQueue.push(project)
      }
    }

    this.queue = newQueue
    this.saveState()
    this.notifyListeners()
  }

  /**
   * Set execution mode
   */
  setMode(mode: ExecutionMode): void {
    this.mode = mode
    this.saveState()
    this.notifyListeners()
  }

  /**
   * Start execution
   */
  async start(): Promise<void> {
    if (this.state === "running") {
      console.log("[AgentController] Already running")
      return
    }

    if (this.queue.length === 0) {
      this.errors.push("No projects in queue")
      this.notifyListeners()
      return
    }

    this.state = "running"
    this.errors = []
    this.abortController = new AbortController()
    this.saveState()
    this.notifyListeners()

    await this.runExecutionLoop()
  }

  /**
   * Stop execution (can be resumed)
   */
  stop(): void {
    if (this.state !== "running") return

    this.state = "paused"
    this.abortController?.abort()
    this.abortController = null
    this.saveState()
    this.notifyListeners()
  }

  /**
   * Resume from paused state
   */
  async resume(): Promise<void> {
    if (this.state !== "paused") return
    await this.start()
  }

  /**
   * Clear all state and queue
   */
  reset(): void {
    this.stop()
    this.queue = []
    this.activeProject = null
    this.progress = null
    this.lastResult = null
    this.errors = []
    this.state = "idle"
    this.saveState()
    this.notifyListeners()
  }

  // --------------------------------------------------------------------------
  // Execution Loop
  // --------------------------------------------------------------------------

  private sortQueue(): void {
    this.queue.sort((a, b) => a.priority - b.priority)
  }

  private async runExecutionLoop(): Promise<void> {
    while (this.state === "running" && this.queue.length > 0) {
      // Get next project
      this.activeProject = this.queue[0]
      this.notifyListeners()

      try {
        const result = await this.executeProject(this.activeProject)
        this.lastResult = result

        // Remove from queue on completion
        this.queue.shift()
        this.activeProject = null
        this.progress = null
        this.saveState()
        this.notifyListeners()

        if (!result.success) {
          console.error("[AgentController] Project failed:", result.errors)
        }
      } catch (error) {
        // Check if we were stopped while executing
        if (this.state !== "running") {
          // Graceful stop
          break
        }

        const message = error instanceof Error ? error.message : "Unknown error"
        this.errors.push(message)
        console.error("[AgentController] Execution error:", error)

        // Move failed project to end of queue
        const failed = this.queue.shift()
        if (failed) {
          failed.priority = 999 // Low priority
          this.queue.push(failed)
        }

        this.activeProject = null
        this.progress = null
        this.saveState()
        this.notifyListeners()
      }
    }

    if (this.queue.length === 0 && this.state === "running") {
      this.state = "completed"
      this.saveState()
      this.notifyListeners()
    }
  }

  private async executeProject(queued: QueuedProject): Promise<ExecutionResult> {
    const startTime = Date.now()
    const { project, packets, repo } = queued
    const allFiles: FileChange[] = []
    const errors: string[] = []
    let packetsCompleted = 0
    let packetsFailed = 0
    let totalIterations = 0

    // Sort packets by phase
    const sortedPackets = this.sortPacketsByPhase(packets)

    for (let i = 0; i < sortedPackets.length; i++) {
      if (this.state !== "running") break

      const packet = sortedPackets[i]

      // Update progress
      this.progress = {
        currentPacketIndex: i + 1,
        totalPackets: sortedPackets.length,
        currentPacketTitle: packet.title,
        currentPhase: this.classifyPacketPhase(packet),
        iteration: 0,
        maxIterations: 15,
        confidence: 0,
        filesGenerated: allFiles.length,
        startedAt: new Date(startTime),
        lastUpdateAt: new Date()
      }
      this.notifyListeners()

      try {
        // Run long-horizon engine for this packet
        const engine = runLongHorizonEngine(packet, repo, {
          onlyPhases: [this.classifyPacketPhase(packet)],
          guardrails: {
            maxTotalIterations: 15,
            minConfidenceToAdvance: 0.75,
            requireCritiquePass: true
          }
        })

        let result: LongHorizonResult | undefined

        for await (const update of engine) {
          if (this.state !== "running") break

          this.progress = {
            ...this.progress!,
            iteration: update.iteration,
            maxIterations: update.totalIterations,
            confidence: update.confidence || 0,
            lastUpdateAt: new Date()
          }
          this.notifyListeners()
        }

        const { value } = await engine.next()
        result = value as LongHorizonResult

        if (result) {
          totalIterations += result.totalIterations
          allFiles.push(...result.allFiles)

          if (result.success) {
            packetsCompleted++
          } else {
            packetsFailed++
            errors.push(...result.errors)
          }

          this.progress = {
            ...this.progress!,
            filesGenerated: allFiles.length,
            lastUpdateAt: new Date()
          }
          this.notifyListeners()
        }
      } catch (error) {
        packetsFailed++
        const message = error instanceof Error ? error.message : "Packet failed"
        errors.push(`${packet.title}: ${message}`)
      }
    }

    // Apply to GitLab if we have files
    let mergeRequestUrl: string | undefined

    if (allFiles.length > 0 && this.state === "running") {
      try {
        const branchName = `claudia/${project.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}`

        const applyResult = await applyWithMergeRequest(
          repo,
          allFiles,
          {
            title: `[Claudia] ${project.name}`,
            description: `Automated code generation.\n\n${sortedPackets.length} packets processed.`,
            sourceBranch: branchName
          }
        )

        if (applyResult.success && applyResult.mergeRequestUrl) {
          mergeRequestUrl = applyResult.mergeRequestUrl
        } else {
          errors.push(...applyResult.errors)
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to apply"
        errors.push(message)
      }
    }

    return {
      projectId: project.id,
      success: packetsFailed === 0 && errors.length === 0,
      filesGenerated: allFiles,
      packetsCompleted,
      packetsFailed,
      totalIterations,
      duration: Date.now() - startTime,
      errors,
      mergeRequestUrl
    }
  }

  private classifyPacketPhase(packet: WorkPacket): GenerationPhase {
    const title = packet.title.toLowerCase()
    const desc = packet.description.toLowerCase()
    const combined = `${title} ${desc}`

    if (combined.includes("setup") || combined.includes("initial") || combined.includes("config")) {
      return "scaffold"
    }
    if (combined.includes("shared") || combined.includes("utility") || combined.includes("types")) {
      return "shared"
    }
    if (combined.includes("navigation") || combined.includes("routing") || combined.includes("layout")) {
      return "integration"
    }
    if (combined.includes("test") || combined.includes("documentation")) {
      return "polish"
    }
    return "features"
  }

  private sortPacketsByPhase(packets: WorkPacket[]): WorkPacket[] {
    const phaseOrder: Record<GenerationPhase, number> = {
      scaffold: 0,
      shared: 1,
      features: 2,
      integration: 3,
      polish: 4
    }

    return [...packets].sort((a, b) => {
      const phaseA = this.classifyPacketPhase(a)
      const phaseB = this.classifyPacketPhase(b)
      return phaseOrder[phaseA] - phaseOrder[phaseB]
    })
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

let controller: AgentControllerClass | null = null

export function getAgentController(): AgentControllerClass {
  if (!controller) {
    controller = new AgentControllerClass()
  }
  return controller
}

// For testing/simulation
export { AgentControllerClass }
