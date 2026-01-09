/**
 * Build Plan Generator
 *
 * Generates comprehensive build plans that are:
 * - Concise and strict (no fluff)
 * - Realistic in expectations
 * - Packetized into actionable work items
 * - Tailored to available AI models/platforms
 *
 * Embodies the principles from KICKOFF.md:
 * - Clear scope boundaries
 * - Explicit success criteria
 * - Practical constraints
 * - Honest effort estimates
 */

import type { AssignedModel } from "./project-models"
import type { AIModel, ProviderName } from "./providers"
import { TASK_TYPES } from "./providers"

export interface BuildPlan {
  id: string
  projectId: string
  createdAt: string
  status: "draft" | "approved" | "in_progress" | "completed"

  // Core specification
  spec: BuildSpec

  // Work breakdown
  phases: BuildPhase[]
  packets: WorkPacket[]

  // Resource allocation
  modelAssignments: ModelAssignment[]

  // Constraints
  constraints: BuildConstraints

  // Metadata
  generatedBy: string // Model that generated this
  version: number
}

export interface BuildSpec {
  name: string
  description: string
  objectives: string[] // What success looks like
  nonGoals: string[] // Explicitly out of scope
  assumptions: string[] // What we're assuming to be true
  risks: string[] // What could go wrong
  techStack: string[]
}

export interface BuildPhase {
  id: string
  name: string
  description: string
  order: number
  packetIds: string[]
  dependencies: string[] // Phase IDs this depends on
  estimatedEffort: EffortEstimate
  successCriteria: string[]
}

export interface WorkPacket {
  id: string
  phaseId: string
  title: string
  description: string
  type: PacketType
  priority: "critical" | "high" | "medium" | "low"
  status: "queued" | "assigned" | "in_progress" | "review" | "completed" | "blocked"

  // Task breakdown
  tasks: PacketTask[]

  // Routing
  suggestedTaskType: string // Maps to TASK_TYPES
  assignedModel?: string

  // Dependencies
  blockedBy: string[] // Packet IDs
  blocks: string[] // Packet IDs

  // Estimation
  estimatedTokens: number
  estimatedCost?: number // If using paid models

  // Acceptance criteria
  acceptanceCriteria: string[]
}

export type PacketType =
  | "feature"
  | "bugfix"
  | "refactor"
  | "test"
  | "docs"
  | "config"
  | "research"

export interface PacketTask {
  id: string
  description: string
  completed: boolean
  order: number
}

export interface ModelAssignment {
  packetId: string
  modelId: string
  provider: ProviderName
  reason: string
}

export interface BuildConstraints {
  maxBudget?: number // Total $ limit
  maxTokensPerPacket?: number
  requireLocalFirst: boolean
  requireHumanApproval: ("planning" | "coding" | "deployment")[]
  maxParallelPackets: number
}

export interface EffortEstimate {
  optimistic: number // Hours
  realistic: number
  pessimistic: number
  confidence: "low" | "medium" | "high"
}

/**
 * System prompt for build plan generation
 */
export const BUILD_PLAN_SYSTEM_PROMPT = `You are a senior software architect creating a build plan. Your plans are:

1. CONCISE - No fluff, every word matters
2. STRICT - Clear boundaries, explicit scope
3. REALISTIC - Honest estimates, acknowledged risks
4. ACTIONABLE - Every item can be executed

Structure your plan with:
- Clear objectives (what success looks like)
- Non-goals (what's explicitly out of scope)
- Assumptions (what we're taking as given)
- Risks (what could go wrong and how we mitigate)
- Phases (logical groupings of work)
- Packets (discrete, assignable work units)

For each work packet:
- Title: Clear, action-oriented
- Description: What and why, not how
- Type: feature/bugfix/refactor/test/docs/config/research
- Priority: critical/high/medium/low
- Tasks: 3-7 concrete steps
- Acceptance criteria: How we know it's done
- Dependencies: What must come first
- Suggested model type: planning/coding/testing/documentation

Be honest about effort. If something is complex, say so. If there are unknowns, flag them as research packets.

Respond with valid JSON only, no markdown.`

/**
 * Existing packet info for build plan integration
 */
export interface ExistingPacketInfo {
  id: string
  title: string
  description?: string
  type?: string
  status?: string
  source?: string // e.g., "linear", "manual", "build-plan"
}

/**
 * Generate build plan user prompt
 */
export function generateBuildPlanPrompt(
  projectName: string,
  projectDescription: string,
  availableModels: AssignedModel[],
  constraints?: Partial<BuildConstraints>,
  existingPackets?: ExistingPacketInfo[]
): string {
  const modelList = availableModels
    .map(m => `- ${m.name} (${m.provider})`)
    .join("\n")

  // Format existing packets for inclusion in the prompt
  let existingPacketsSection = ""
  if (existingPackets && existingPackets.length > 0) {
    const packetList = existingPackets
      .map(p => {
        const status = p.status ? ` [${p.status}]` : ""
        const source = p.source ? ` (from: ${p.source})` : ""
        const desc = p.description ? `\n     ${p.description}` : ""
        return `  - "${p.title}"${status}${source}${desc}`
      })
      .join("\n")

    existingPacketsSection = `

EXISTING PACKETS (DO NOT DUPLICATE):
The following work packets already exist for this project. Your build plan should:
1. NOT create packets that duplicate this existing work
2. Reference existing packets where appropriate (e.g., "depends on existing packet X")
3. Fill in gaps - identify work that is NOT covered by existing packets
4. Complement existing work - create packets that build upon what's already planned

Existing packets:
${packetList}
`
  }

  return `Generate a build plan for:

PROJECT: ${projectName}
DESCRIPTION: ${projectDescription}

AVAILABLE AI MODELS:
${modelList || "- Local LLM (general purpose)"}

CONSTRAINTS:
- Max budget: ${constraints?.maxBudget ? `$${constraints.maxBudget}` : "No limit (prefer free local models)"}
- Require local first: ${constraints?.requireLocalFirst !== false ? "Yes" : "No"}
- Human approval needed for: ${constraints?.requireHumanApproval?.join(", ") || "planning, deployment"}
- Max parallel packets: ${constraints?.maxParallelPackets || 2}
${existingPacketsSection}
Generate the build plan as JSON with this structure:
{
  "spec": {
    "name": "string",
    "description": "string",
    "objectives": ["string"],
    "nonGoals": ["string"],
    "assumptions": ["string"],
    "risks": ["string"],
    "techStack": ["string"]
  },
  "phases": [
    {
      "id": "phase-1",
      "name": "string",
      "description": "string",
      "order": 1,
      "packetIds": ["pkt-1"],
      "dependencies": [],
      "estimatedEffort": {
        "optimistic": 2,
        "realistic": 4,
        "pessimistic": 8,
        "confidence": "medium"
      },
      "successCriteria": ["string"]
    }
  ],
  "packets": [
    {
      "id": "pkt-1",
      "phaseId": "phase-1",
      "title": "string",
      "description": "string",
      "type": "feature",
      "priority": "high",
      "status": "queued",
      "tasks": [
        { "id": "task-1", "description": "string", "completed": false, "order": 1 }
      ],
      "suggestedTaskType": "coding",
      "blockedBy": [],
      "blocks": [],
      "estimatedTokens": 10000,
      "acceptanceCriteria": ["string"]
    }
  ],
  "modelAssignments": [
    {
      "packetId": "pkt-1",
      "modelId": "string",
      "provider": "lmstudio",
      "reason": "string"
    }
  ]
}`
}

/**
 * Extract JSON from LLM response that may contain extra text
 */
function extractJSON(text: string): string | null {
  // Try to find JSON object in the response
  const jsonPatterns = [
    // Match JSON wrapped in markdown code blocks
    /```(?:json)?\s*(\{[\s\S]*?\})\s*```/,
    // Match standalone JSON object (greedy, finds largest match)
    /(\{[\s\S]*\})/,
  ]

  for (const pattern of jsonPatterns) {
    const match = text.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * Clean and fix common JSON issues from LLM output
 */
function cleanJSON(jsonStr: string): string {
  let cleaned = jsonStr

  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1')

  // Remove JavaScript-style comments
  cleaned = cleaned.replace(/\/\/[^\n]*/g, '')
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '')

  // Fix unquoted keys (simple cases)
  cleaned = cleaned.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')

  // Remove control characters except newlines and tabs
  cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')

  // Fix escaped newlines that should be actual newlines in strings
  // This handles cases where LLM outputs literal \n instead of actual newlines

  return cleaned
}

/**
 * Try multiple parsing strategies to extract a valid build plan
 */
function tryParseJSON(content: string): Record<string, unknown> | null {
  // Strategy 1: Direct parse
  try {
    return JSON.parse(content)
  } catch {
    // Continue to next strategy
  }

  // Strategy 2: Extract JSON from surrounding text
  const extracted = extractJSON(content)
  if (extracted) {
    try {
      return JSON.parse(extracted)
    } catch {
      // Continue to next strategy
    }

    // Strategy 3: Clean extracted JSON and parse
    try {
      const cleaned = cleanJSON(extracted)
      return JSON.parse(cleaned)
    } catch {
      // Continue to next strategy
    }
  }

  // Strategy 4: Try to find and parse just the spec, phases, packets separately
  try {
    const specMatch = content.match(/"spec"\s*:\s*(\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})/)
    const phasesMatch = content.match(/"phases"\s*:\s*(\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\])/)
    const packetsMatch = content.match(/"packets"\s*:\s*(\[[\s\S]*?\])(?=\s*,?\s*(?:"|\}|$))/)

    if (specMatch || phasesMatch || packetsMatch) {
      const reconstructed: Record<string, unknown> = {}

      if (specMatch) {
        try {
          reconstructed.spec = JSON.parse(cleanJSON(specMatch[1]))
        } catch {
          // Skip
        }
      }
      if (phasesMatch) {
        try {
          reconstructed.phases = JSON.parse(cleanJSON(phasesMatch[1]))
        } catch {
          // Skip
        }
      }
      if (packetsMatch) {
        try {
          reconstructed.packets = JSON.parse(cleanJSON(packetsMatch[1]))
        } catch {
          // Skip
        }
      }

      if (Object.keys(reconstructed).length > 0) {
        return reconstructed
      }
    }
  } catch {
    // Final fallback failed
  }

  return null
}

/**
 * Parse LLM response into BuildPlan
 */
export function parseBuildPlanResponse(
  response: string,
  projectId: string,
  generatedBy: string
): BuildPlan | null {
  try {
    // Clean up response - remove markdown code blocks wrapper
    let content = response.trim()
    if (content.startsWith("```")) {
      content = content.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "")
    }

    const parsed = tryParseJSON(content)

    if (!parsed) {
      console.error("Failed to extract valid JSON from LLM response")
      console.error("Response preview:", content.substring(0, 500))
      return null
    }

    // Validate required fields - be flexible about structure
    const spec = parsed.spec as Record<string, unknown> || {}
    const phases = (parsed.phases as unknown[]) || []
    const packets = (parsed.packets as unknown[]) || []

    // Build spec with defaults for missing fields
    const buildSpec: BuildPlan["spec"] = {
      name: (spec.name as string) || "Untitled Plan",
      description: (spec.description as string) || "",
      objectives: Array.isArray(spec.objectives) ? spec.objectives as string[] : [],
      nonGoals: Array.isArray(spec.nonGoals) ? spec.nonGoals as string[] : [],
      assumptions: Array.isArray(spec.assumptions) ? spec.assumptions as string[] : [],
      risks: Array.isArray(spec.risks) ? spec.risks as string[] : [],
      techStack: Array.isArray(spec.techStack) ? spec.techStack as string[] : []
    }

    // Ensure we have at least minimal content
    if (buildSpec.objectives.length === 0 && packets.length === 0) {
      console.error("Build plan has no objectives and no packets")
      return null
    }

    // Build phases with defaults
    const buildPhases: BuildPlan["phases"] = phases.map((p: unknown, i: number) => {
      const phase = p as Record<string, unknown>
      return {
        id: (phase.id as string) || `phase-${i + 1}`,
        name: (phase.name as string) || `Phase ${i + 1}`,
        description: (phase.description as string) || "",
        order: (phase.order as number) || i + 1,
        packetIds: Array.isArray(phase.packetIds) ? phase.packetIds as string[] : [],
        dependencies: Array.isArray(phase.dependencies) ? phase.dependencies as string[] : [],
        estimatedEffort: {
          optimistic: 8,
          realistic: 16,
          pessimistic: 32,
          confidence: "medium" as const
        },
        successCriteria: Array.isArray(phase.successCriteria) ? phase.successCriteria as string[] : []
      }
    })

    // Build packets with defaults
    const buildPackets: BuildPlan["packets"] = packets.map((p: unknown, i: number) => {
      const packet = p as Record<string, unknown>
      const tasks = Array.isArray(packet.tasks) ? packet.tasks : []

      return {
        id: (packet.id as string) || `packet-${i + 1}`,
        phaseId: (packet.phaseId as string) || (buildPhases[0]?.id || "phase-1"),
        title: (packet.title as string) || `Task ${i + 1}`,
        description: (packet.description as string) || "",
        type: ((packet.type as string) || "feature") as PacketType,
        priority: ((packet.priority as string) || "medium") as "critical" | "high" | "medium" | "low",
        status: "queued" as const,
        tasks: tasks.map((t: unknown, j: number) => {
          if (typeof t === "string") {
            return { id: `task-${i}-${j}`, description: t, completed: false, order: j }
          }
          const task = t as Record<string, unknown>
          return {
            id: (task.id as string) || `task-${i}-${j}`,
            description: (task.description as string) || (task.title as string) || "",
            completed: Boolean(task.completed),
            order: (task.order as number) || j
          }
        }),
        suggestedTaskType: (packet.suggestedTaskType as string) || "coding",
        blockedBy: Array.isArray(packet.blockedBy) ? packet.blockedBy as string[] : [],
        blocks: Array.isArray(packet.blocks) ? packet.blocks as string[] : [],
        estimatedTokens: (packet.estimatedTokens as number) || 1000,
        acceptanceCriteria: Array.isArray(packet.acceptanceCriteria) ? packet.acceptanceCriteria as string[] : []
      }
    })

    // If no phases but we have packets, create a default phase
    if (buildPhases.length === 0 && buildPackets.length > 0) {
      buildPhases.push({
        id: "phase-1",
        name: "Implementation",
        description: "Main implementation phase",
        order: 1,
        packetIds: buildPackets.map(p => p.id),
        dependencies: [],
        estimatedEffort: { optimistic: 8, realistic: 16, pessimistic: 32, confidence: "medium" },
        successCriteria: ["All packets completed"]
      })
    }

    return {
      id: crypto.randomUUID(),
      projectId,
      createdAt: new Date().toISOString(),
      status: "draft",
      spec: buildSpec,
      phases: buildPhases,
      packets: buildPackets,
      modelAssignments: (parsed.modelAssignments as ModelAssignment[]) || [],
      constraints: {
        requireLocalFirst: true,
        requireHumanApproval: ["planning", "deployment"],
        maxParallelPackets: 2
      },
      generatedBy,
      version: 1
    }
  } catch (error) {
    console.error("Failed to parse build plan:", error)
    return null
  }
}

/**
 * Validate a build plan for completeness
 */
export function validateBuildPlan(plan: BuildPlan): {
  valid: boolean
  issues: string[]
} {
  const issues: string[] = []

  // Check spec
  if (!plan.spec.name) issues.push("Missing project name")
  if (!plan.spec.objectives?.length) issues.push("No objectives defined")
  if (!plan.spec.techStack?.length) issues.push("No tech stack specified")

  // Check phases
  if (!plan.phases?.length) issues.push("No phases defined")
  plan.phases?.forEach(phase => {
    if (!phase.packetIds?.length) {
      issues.push(`Phase "${phase.name}" has no packets`)
    }
    if (!phase.successCriteria?.length) {
      issues.push(`Phase "${phase.name}" has no success criteria`)
    }
  })

  // Check packets
  if (!plan.packets?.length) issues.push("No work packets defined")
  plan.packets?.forEach(packet => {
    if (!packet.title) issues.push(`Packet ${packet.id} has no title`)
    if (!packet.tasks?.length) issues.push(`Packet "${packet.title}" has no tasks`)
    if (!packet.acceptanceCriteria?.length) {
      issues.push(`Packet "${packet.title}" has no acceptance criteria`)
    }
  })

  // Check for circular dependencies
  const packetIds = new Set(plan.packets?.map(p => p.id) || [])
  plan.packets?.forEach(packet => {
    packet.blockedBy?.forEach(dep => {
      if (!packetIds.has(dep)) {
        issues.push(`Packet "${packet.title}" depends on unknown packet ${dep}`)
      }
    })
  })

  return {
    valid: issues.length === 0,
    issues
  }
}

/**
 * Get packets ready to start (no unmet dependencies)
 */
export function getReadyPackets(plan: BuildPlan): WorkPacket[] {
  const completedIds = new Set(
    plan.packets
      .filter(p => p.status === "completed")
      .map(p => p.id)
  )

  return plan.packets.filter(packet => {
    if (packet.status !== "queued") return false

    // Check all dependencies are completed
    return packet.blockedBy.every(dep => completedIds.has(dep))
  })
}

/**
 * Calculate total estimated effort for a plan
 */
export function calculateTotalEffort(plan: BuildPlan): EffortEstimate {
  const totals = plan.phases.reduce(
    (acc, phase) => ({
      optimistic: acc.optimistic + phase.estimatedEffort.optimistic,
      realistic: acc.realistic + phase.estimatedEffort.realistic,
      pessimistic: acc.pessimistic + phase.estimatedEffort.pessimistic
    }),
    { optimistic: 0, realistic: 0, pessimistic: 0 }
  )

  // Confidence based on variance
  const variance = totals.pessimistic - totals.optimistic
  const ratio = variance / totals.realistic

  let confidence: "low" | "medium" | "high"
  if (ratio < 0.5) confidence = "high"
  else if (ratio < 1) confidence = "medium"
  else confidence = "low"

  return { ...totals, confidence }
}

/**
 * Estimate cost for a plan based on model assignments
 */
export function estimatePlanCost(
  plan: BuildPlan,
  modelCosts: Record<string, number> // modelId -> cost per 1k tokens
): number {
  return plan.packets.reduce((total, packet) => {
    const assignment = plan.modelAssignments.find(a => a.packetId === packet.id)
    if (!assignment) return total

    const costPer1k = modelCosts[assignment.modelId] || 0
    return total + (packet.estimatedTokens / 1000) * costPer1k
  }, 0)
}

/**
 * Save packets to localStorage for a project
 */
const PACKETS_STORAGE_KEY = "claudia_packets"

function getStoredPackets(): Record<string, WorkPacket[]> {
  if (typeof window === "undefined") return {}
  const stored = localStorage.getItem(PACKETS_STORAGE_KEY)
  return stored ? JSON.parse(stored) : {}
}

function saveAllPackets(allPackets: Record<string, WorkPacket[]>): void {
  if (typeof window === "undefined") return
  localStorage.setItem(PACKETS_STORAGE_KEY, JSON.stringify(allPackets))
}

export function savePackets(projectId: string, packets: WorkPacket[]): void {
  const allPackets = getStoredPackets()
  allPackets[projectId] = packets
  saveAllPackets(allPackets)
}

export function getPacketsForProject(projectId: string): WorkPacket[] {
  const allPackets = getStoredPackets()
  return allPackets[projectId] || []
}

export function getAllPackets(): WorkPacket[] {
  const allPackets = getStoredPackets()
  return Object.values(allPackets).flat()
}

export function updatePacket(projectId: string, packetId: string, updates: Partial<WorkPacket>): WorkPacket | null {
  const allPackets = getStoredPackets()
  const packets = allPackets[projectId] || []
  const index = packets.findIndex(p => p.id === packetId)

  if (index === -1) return null

  packets[index] = { ...packets[index], ...updates }
  allPackets[projectId] = packets
  saveAllPackets(allPackets)

  return packets[index]
}

export function deletePacket(projectId: string, packetId: string): boolean {
  const allPackets = getStoredPackets()
  const packets = allPackets[projectId] || []
  const filtered = packets.filter(p => p.id !== packetId)

  if (filtered.length === packets.length) return false

  allPackets[projectId] = filtered
  saveAllPackets(allPackets)
  return true
}

/**
 * Save a build plan to localStorage
 */
const BUILD_PLANS_STORAGE_KEY = "claudia_build_plans_raw"

function getStoredBuildPlansRaw(): Record<string, BuildPlan> {
  if (typeof window === "undefined") return {}
  const stored = localStorage.getItem(BUILD_PLANS_STORAGE_KEY)
  return stored ? JSON.parse(stored) : {}
}

function saveAllBuildPlansRaw(plans: Record<string, BuildPlan>): void {
  if (typeof window === "undefined") return
  localStorage.setItem(BUILD_PLANS_STORAGE_KEY, JSON.stringify(plans))
}

export function saveBuildPlan(projectId: string, plan: BuildPlan): void {
  const allPlans = getStoredBuildPlansRaw()
  allPlans[projectId] = plan
  saveAllBuildPlansRaw(allPlans)

  // Also save the packets from this plan
  savePackets(projectId, plan.packets)
}

export function getBuildPlanRaw(projectId: string): BuildPlan | null {
  const allPlans = getStoredBuildPlansRaw()
  return allPlans[projectId] || null
}
