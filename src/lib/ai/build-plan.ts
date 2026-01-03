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
 * Generate build plan user prompt
 */
export function generateBuildPlanPrompt(
  projectName: string,
  projectDescription: string,
  availableModels: AssignedModel[],
  constraints?: Partial<BuildConstraints>
): string {
  const modelList = availableModels
    .map(m => `- ${m.name} (${m.provider})`)
    .join("\n")

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
 * Parse LLM response into BuildPlan
 */
export function parseBuildPlanResponse(
  response: string,
  projectId: string,
  generatedBy: string
): BuildPlan | null {
  try {
    // Clean up response
    let content = response.trim()
    if (content.startsWith("```")) {
      content = content.replace(/^```json?\n?/, "").replace(/\n?```$/, "")
    }

    const parsed = JSON.parse(content)

    // Validate required fields
    if (!parsed.spec || !parsed.phases || !parsed.packets) {
      console.error("Missing required fields in build plan")
      return null
    }

    return {
      id: crypto.randomUUID(),
      projectId,
      createdAt: new Date().toISOString(),
      status: "draft",
      spec: parsed.spec,
      phases: parsed.phases,
      packets: parsed.packets,
      modelAssignments: parsed.modelAssignments || [],
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
