#!/usr/bin/env npx ts-node
/**
 * Execution Simulation Script
 *
 * Simulates the full execution loop without UI dependencies.
 * Run with: npx ts-node scripts/simulate-execution.ts
 *
 * This helps us understand and refine the algorithm before
 * integrating into the main application.
 */

// ============================================================================
// Types (simplified for simulation)
// ============================================================================

type GenerationPhase = "scaffold" | "shared" | "features" | "integration" | "polish"
type AgentState = "idle" | "running" | "paused" | "completed" | "failed"

interface SimPacket {
  id: string
  title: string
  description: string
  phase: GenerationPhase
  estimatedIterations: number
  acceptanceCriteria: string[]
}

interface SimProject {
  id: string
  name: string
  description: string
  packets: SimPacket[]
}

interface ExecutionLog {
  timestamp: Date
  level: "info" | "warn" | "error" | "success"
  message: string
  data?: unknown
}

// ============================================================================
// Simulated LLM Response
// ============================================================================

function simulateLLMCall(prompt: string, phase: GenerationPhase): {
  files: { path: string; content: string }[]
  confidence: number
  issues: string[]
} {
  // Simulate processing time (50-500ms)
  const delay = Math.random() * 450 + 50

  // Simulate confidence based on phase and randomness
  const baseConfidence: Record<GenerationPhase, number> = {
    scaffold: 0.9,
    shared: 0.85,
    features: 0.75,
    integration: 0.7,
    polish: 0.8
  }

  const confidence = baseConfidence[phase] + (Math.random() * 0.2 - 0.1)

  // Simulate file generation
  const fileCount = Math.floor(Math.random() * 3) + 1
  const files = Array.from({ length: fileCount }, (_, i) => ({
    path: `src/${phase}/file-${i + 1}.ts`,
    content: `// Generated for ${phase} phase\nexport const placeholder = true;`
  }))

  // Simulate issues
  const issues: string[] = []
  if (confidence < 0.7) {
    issues.push("Low confidence in generated code")
  }
  if (Math.random() < 0.1) {
    issues.push("Minor type inconsistency detected")
  }

  return { files, confidence: Math.min(1, Math.max(0, confidence)), issues }
}

// ============================================================================
// Self-Critique (Wiggum Loop)
// ============================================================================

function selfCritique(
  files: { path: string; content: string }[],
  acceptanceCriteria: string[]
): {
  passes: boolean
  confidence: number
  criteriaMet: string[]
  criteriaMissing: string[]
  suggestions: string[]
} {
  // Simulate critique
  const criteriaMet: string[] = []
  const criteriaMissing: string[] = []

  for (const criterion of acceptanceCriteria) {
    // 80% chance of meeting each criterion
    if (Math.random() > 0.2) {
      criteriaMet.push(criterion)
    } else {
      criteriaMissing.push(criterion)
    }
  }

  const confidence = criteriaMet.length / acceptanceCriteria.length
  const passes = confidence >= 0.75

  const suggestions: string[] = []
  if (!passes) {
    suggestions.push(`Address missing criteria: ${criteriaMissing.join(", ")}`)
    suggestions.push("Consider refactoring for better structure")
  }

  return {
    passes,
    confidence,
    criteriaMet,
    criteriaMissing,
    suggestions
  }
}

// ============================================================================
// Execution Engine
// ============================================================================

async function executePacket(
  packet: SimPacket,
  logs: ExecutionLog[],
  maxIterations: number = 5
): Promise<{
  success: boolean
  files: { path: string; content: string }[]
  iterations: number
  finalConfidence: number
}> {
  const log = (level: ExecutionLog["level"], message: string, data?: unknown) => {
    logs.push({ timestamp: new Date(), level, message, data })
    const prefix = level === "error" ? "❌" : level === "success" ? "✅" : level === "warn" ? "⚠️" : "ℹ️"
    console.log(`  ${prefix} ${message}`)
  }

  log("info", `Starting packet: ${packet.title} (phase: ${packet.phase})`)

  let allFiles: { path: string; content: string }[] = []
  let iteration = 0
  let passes = false

  // Wiggum Loop: iterate until quality threshold or max iterations
  while (!passes && iteration < maxIterations) {
    iteration++
    log("info", `Iteration ${iteration}/${maxIterations}`)

    // Generate code
    const result = simulateLLMCall(packet.description, packet.phase)
    allFiles = [...allFiles, ...result.files]

    log("info", `Generated ${result.files.length} files, confidence: ${(result.confidence * 100).toFixed(0)}%`)

    if (result.issues.length > 0) {
      result.issues.forEach(issue => log("warn", issue))
    }

    // Self-critique
    const critique = selfCritique(allFiles, packet.acceptanceCriteria)

    log("info", `Critique: ${critique.criteriaMet.length}/${packet.acceptanceCriteria.length} criteria met`)

    if (critique.passes) {
      passes = true
      log("success", `Packet complete! Final confidence: ${(critique.confidence * 100).toFixed(0)}%`)
    } else {
      if (iteration < maxIterations) {
        log("warn", `Retrying... Missing: ${critique.criteriaMissing.join(", ")}`)
      }
    }

    // Small delay to simulate work
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  if (!passes) {
    log("error", `Max iterations reached without meeting quality threshold`)
  }

  return {
    success: passes,
    files: allFiles,
    iterations: iteration,
    finalConfidence: passes ? 0.85 : 0.5
  }
}

async function executeProject(
  project: SimProject,
  logs: ExecutionLog[]
): Promise<{
  success: boolean
  packetsCompleted: number
  packetsFailed: number
  totalFiles: number
  totalIterations: number
  duration: number
}> {
  const startTime = Date.now()

  console.log(`\n${"=".repeat(60)}`)
  console.log(`PROJECT: ${project.name}`)
  console.log(`${"=".repeat(60)}`)
  console.log(`Description: ${project.description}`)
  console.log(`Packets: ${project.packets.length}`)
  console.log()

  // Sort packets by phase order
  const phaseOrder: Record<GenerationPhase, number> = {
    scaffold: 0,
    shared: 1,
    features: 2,
    integration: 3,
    polish: 4
  }

  const sortedPackets = [...project.packets].sort((a, b) =>
    phaseOrder[a.phase] - phaseOrder[b.phase]
  )

  let packetsCompleted = 0
  let packetsFailed = 0
  let totalFiles = 0
  let totalIterations = 0

  for (const packet of sortedPackets) {
    console.log(`\n--- Packet: ${packet.title} ---`)

    const result = await executePacket(packet, logs)

    if (result.success) {
      packetsCompleted++
    } else {
      packetsFailed++
    }

    totalFiles += result.files.length
    totalIterations += result.iterations
  }

  const duration = Date.now() - startTime

  console.log(`\n${"=".repeat(60)}`)
  console.log(`PROJECT COMPLETE: ${project.name}`)
  console.log(`${"=".repeat(60)}`)
  console.log(`Packets: ${packetsCompleted} completed, ${packetsFailed} failed`)
  console.log(`Files generated: ${totalFiles}`)
  console.log(`Total iterations: ${totalIterations}`)
  console.log(`Duration: ${(duration / 1000).toFixed(1)}s`)
  console.log()

  return {
    success: packetsFailed === 0,
    packetsCompleted,
    packetsFailed,
    totalFiles,
    totalIterations,
    duration
  }
}

// ============================================================================
// Queue Management
// ============================================================================

interface QueuedProject {
  project: SimProject
  priority: number
  addedAt: Date
}

class ProjectQueue {
  private queue: QueuedProject[] = []
  private state: AgentState = "idle"
  private logs: ExecutionLog[] = []

  enqueue(project: SimProject, priority: number = 10): void {
    this.queue.push({
      project,
      priority,
      addedAt: new Date()
    })
    this.sortQueue()
    console.log(`📥 Queued: ${project.name} (priority: ${priority})`)
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => a.priority - b.priority)
  }

  async run(): Promise<void> {
    if (this.state === "running") {
      console.log("Already running")
      return
    }

    this.state = "running"
    console.log("\n🚀 Starting execution queue...\n")

    while (this.queue.length > 0 && this.state === "running") {
      const next = this.queue.shift()!
      await executeProject(next.project, this.logs)
    }

    if (this.queue.length === 0) {
      this.state = "completed"
      console.log("✨ All projects completed!")
    }
  }

  stop(): void {
    this.state = "paused"
    console.log("⏸️ Execution paused")
  }

  getStatus(): { state: AgentState; queueLength: number } {
    return {
      state: this.state,
      queueLength: this.queue.length
    }
  }
}

// ============================================================================
// Sample Data
// ============================================================================

const sampleProjects: SimProject[] = [
  {
    id: "proj-1",
    name: "HyperHealth Dashboard",
    description: "Health tracking application with charts and metrics",
    packets: [
      {
        id: "pkt-1",
        title: "Project Setup",
        description: "Initialize Next.js project with Tailwind CSS",
        phase: "scaffold",
        estimatedIterations: 2,
        acceptanceCriteria: ["package.json exists", "tsconfig configured", "tailwind setup"]
      },
      {
        id: "pkt-2",
        title: "UI Components",
        description: "Create shared UI components (Button, Card, etc.)",
        phase: "shared",
        estimatedIterations: 3,
        acceptanceCriteria: ["Button component", "Card component", "Consistent styling"]
      },
      {
        id: "pkt-3",
        title: "Dashboard Page",
        description: "Main dashboard with health metrics",
        phase: "features",
        estimatedIterations: 4,
        acceptanceCriteria: ["Metric cards", "Charts", "Data display", "Responsive layout"]
      },
      {
        id: "pkt-4",
        title: "Navigation",
        description: "Add navigation between pages",
        phase: "integration",
        estimatedIterations: 2,
        acceptanceCriteria: ["Nav component", "Route links", "Active state"]
      }
    ]
  },
  {
    id: "proj-2",
    name: "Task Manager API",
    description: "REST API for task management",
    packets: [
      {
        id: "pkt-5",
        title: "Express Setup",
        description: "Initialize Express with TypeScript",
        phase: "scaffold",
        estimatedIterations: 2,
        acceptanceCriteria: ["Express configured", "TypeScript setup", "Dev server works"]
      },
      {
        id: "pkt-6",
        title: "Task CRUD",
        description: "Create, read, update, delete tasks",
        phase: "features",
        estimatedIterations: 4,
        acceptanceCriteria: ["GET /tasks", "POST /tasks", "PUT /tasks/:id", "DELETE /tasks/:id"]
      }
    ]
  }
]

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("╔════════════════════════════════════════════════════════════╗")
  console.log("║           CLAUDIA EXECUTION SIMULATION                     ║")
  console.log("║                                                            ║")
  console.log("║  This simulates the full execution loop including:         ║")
  console.log("║  - Project queue with priority                             ║")
  console.log("║  - Phase-ordered packet execution                          ║")
  console.log("║  - Wiggum Loop (iterate until quality threshold)           ║")
  console.log("║  - Self-critique and improvement                           ║")
  console.log("╚════════════════════════════════════════════════════════════╝")
  console.log()

  const queue = new ProjectQueue()

  // Enqueue projects with different priorities
  queue.enqueue(sampleProjects[0], 1)  // High priority
  queue.enqueue(sampleProjects[1], 5)  // Lower priority

  // Run the queue
  await queue.run()

  console.log("\n" + "=".repeat(60))
  console.log("SIMULATION COMPLETE")
  console.log("=".repeat(60))
  console.log(`
Key Learnings:
1. Projects are processed sequentially (one at a time)
2. Packets are sorted by phase before execution
3. Each packet iterates until quality threshold or max iterations
4. Self-critique determines if more iterations are needed
5. Results are accumulated across packets
`)
}

main().catch(console.error)
