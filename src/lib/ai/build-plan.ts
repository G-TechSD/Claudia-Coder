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
 *
 * Enhanced with game/creative project support:
 * - Detects game, VR, and creative projects
 * - Generates vision packets with store-style descriptions
 * - Vision packets gate overall project completion
 */

import type { AssignedModel } from "./project-models"
import type { AIModel, ProviderName } from "./providers"
import { TASK_TYPES } from "./providers"
import type { GameProjectDetection, VisionPacket } from "./game-vision"

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

  // Existing packet tracking
  existing?: boolean // true if this packet existed before plan generation

  // Optional metadata for extended packet types (e.g., vision packets)
  metadata?: {
    source?: string
    isVisionPacket?: boolean
    completionGate?: boolean
    projectType?: string
    storeDescription?: string
    tagline?: string
    keyFeatures?: string[]
    targetAudience?: string
    uniqueSellingPoints?: string[]
    [key: string]: unknown
  }
}

export interface PacketSummary {
  existingCount: number
  newCount: number
  summary: string
}

export interface BuildPlanParseResult {
  plan: BuildPlan
  packetSummary: PacketSummary
}

export type PacketType =
  | "feature"
  | "bugfix"
  | "refactor"
  | "test"
  | "docs"
  | "config"
  | "research"
  | "vision"  // Special type for game/creative project vision packets

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
 * Enhanced for nuance awareness and smaller model compatibility
 * Enhanced for game/creative project support with vision packets
 */
export const BUILD_PLAN_SYSTEM_PROMPT = `You are a senior software architect creating a build plan. Your plans are:

1. CONCISE - No fluff, every word matters
2. STRICT - Clear boundaries, explicit scope
3. REALISTIC - Honest estimates, acknowledged risks
4. ACTIONABLE - Every item can be executed

CRITICAL: READ ALL CONTEXT CAREFULLY
- If discussion notes or extracted context is provided, READ EVERY POINT
- Decisions made in discussions MUST be reflected in your plan
- Requirements from comments are JUST AS IMPORTANT as the main description
- If someone raised a concern, address it in your plan

GAME/CREATIVE PROJECTS:
- If this is a game, VR, or creative project, recognize that it needs a VISION packet
- Vision packets define the ultimate goal - what the finished product should be
- The vision packet should NOT be marked complete until the project matches its description
- Use type: "vision" for these special packets

Structure your plan with:
- Clear objectives (what success looks like)
- Non-goals (what's explicitly out of scope)
- Assumptions (what we're taking as given)
- Risks (what could go wrong and how we mitigate)
- Phases (logical groupings of work)
- Packets (discrete, assignable work units)

For each work packet:
- Title: Clear, action-oriented
- Description: What and why, not how (INCLUDE relevant context from discussions)
- Type: feature/bugfix/refactor/test/docs/config/research/vision
- Priority: critical/high/medium/low
- Tasks: 3-7 concrete steps (informed by any action items from discussions)
- Acceptance criteria: How we know it's done (include requirements from comments)
- Dependencies: What must come first
- Suggested model type: planning/coding/testing/documentation

Be honest about effort. If something is complex, say so. If there are unknowns, flag them as research packets.

OUTPUT FORMAT: Return valid JSON only.
- No markdown code blocks
- No text before or after the JSON
- Start with { and end with }
- Use double quotes for all strings
- No trailing commas`

/**
 * Simplified system prompt for smaller models
 * More explicit JSON instructions, shorter context
 */
export const BUILD_PLAN_SIMPLE_SYSTEM_PROMPT = `Create a software build plan as JSON.

Read ALL provided context including comments and discussions.
Include decisions and requirements from comments in your packets.

For game/creative projects, include a "vision" type packet that describes the final product.

Each packet needs: title, description, type, priority, tasks, acceptanceCriteria.
Types: feature, bugfix, refactor, test, docs, config, research, vision

Return ONLY valid JSON:
- Start with { end with }
- Double quotes for strings
- No markdown, no extra text
- No trailing commas`

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
  // Extracted nuance from comments (if available)
  extractedNuance?: string
}

/**
 * Nuance context for build plan generation
 * Aggregated from comment extraction
 */
export interface NuanceContext {
  decisions: string[]
  requirements: string[]
  constraints: string[]
  concerns: string[]
  actionItems: string[]
  context: string[]
  summary?: string
}

/**
 * Generate build plan user prompt
 * Enhanced to include nuance context from comments
 */
export function generateBuildPlanPrompt(
  projectName: string,
  projectDescription: string,
  availableModels: AssignedModel[],
  constraints?: Partial<BuildConstraints>,
  existingPackets?: ExistingPacketInfo[],
  nuanceContext?: NuanceContext,
  planType?: string | null  // Override project type: "game", "vr", "creative", "web", "mobile", etc.
): string {
  const modelList = availableModels
    .map(m => `- ${m.name} (${m.provider})`)
    .join("\n")

  // Format existing packets for inclusion in the prompt
  // For large packet counts, use summarization to stay within token limits
  let existingPacketsSection = ""
  if (existingPackets && existingPackets.length > 0) {
    const isLargePacketCount = existingPackets.length >= 20

    if (isLargePacketCount) {
      // LARGE PACKET COUNT: Summarize by status/category instead of listing all
      // Group packets by status
      const byStatus: Record<string, ExistingPacketInfo[]> = {}
      existingPackets.forEach(p => {
        const status = p.status || 'backlog'
        if (!byStatus[status]) byStatus[status] = []
        byStatus[status].push(p)
      })

      const statusSummary = Object.entries(byStatus)
        .map(([status, packets]) => `  - ${status}: ${packets.length} packets`)
        .join("\n")

      // Show a representative sample: first 5 and last 3
      const samplePackets = [
        ...existingPackets.slice(0, 5),
        ...(existingPackets.length > 8 ? existingPackets.slice(-3) : [])
      ]
      const sampleList = samplePackets
        .map((p, i) => {
          const status = p.status ? ` [${p.status}]` : ""
          return `  ${i + 1}. "${p.title}"${status} (id: ${p.id})`
        })
        .join("\n")

      existingPacketsSection = `

EXISTING PACKETS - CRITICAL INSTRUCTIONS (${existingPackets.length} PACKETS):
This project has ${existingPackets.length} existing work packets imported. This is a LARGE project.

PACKET BREAKDOWN BY STATUS:
${statusSummary}

IMPORTANT - Your build plan MUST:
1. ACKNOWLEDGE all ${existingPackets.length} existing packets exist (don't try to list them all in your output)
2. DO NOT DUPLICATE any existing work - the packets below are just a SAMPLE
3. FOCUS your new packets on:
   - Integration/orchestration between existing features
   - Testing and quality assurance
   - Documentation and deployment
   - Any obvious GAPS not covered by existing packets

SAMPLE PACKETS (representative subset of ${existingPackets.length} total):
${sampleList}
${existingPackets.length > 8 ? `  ... and ${existingPackets.length - 8} more packets` : ""}

4. In your JSON output, include:
   "packetSummary": {
     "existingCount": ${existingPackets.length},
     "newCount": <number of NEW packets you're proposing>,
     "summary": "Acknowledged ${existingPackets.length} existing packets, proposed X new integration/support packets"
   }

KEEP YOUR NEW PACKETS MINIMAL - the existing ${existingPackets.length} packets already cover the core work.
`
    } else {
      // SMALL PACKET COUNT: List all packets as before
      const packetList = existingPackets
        .map((p, i) => {
          const status = p.status ? ` [${p.status}]` : ""
          const source = p.source ? ` (from: ${p.source})` : ""
          const desc = p.description ? `\n     ${p.description}` : ""
          return `  ${i + 1}. "${p.title}"${status}${source} (id: ${p.id})${desc}`
        })
        .join("\n")

      existingPacketsSection = `

EXISTING PACKETS - CRITICAL INSTRUCTIONS:
There are ${existingPackets.length} existing work packets for this project. You MUST:

1. INCLUDE ALL ${existingPackets.length} EXISTING PACKETS in your output packets array
   - Mark each with "existing": true
   - Preserve their original id, title, and description
   - You may update their status, priority, or add dependencies if logical

2. ADD NEW PACKETS ONLY WHERE GAPS EXIST
   - Mark new packets with "existing": false
   - Give new packets unique IDs (use "new-pkt-1", "new-pkt-2", etc.)
   - Only create new packets for work NOT already covered

3. NEVER DUPLICATE existing work - if similar work exists, reference it instead

4. INCLUDE A PACKET SUMMARY in your JSON output:
   "packetSummary": {
     "existingCount": ${existingPackets.length},
     "newCount": <number of new packets you're proposing>,
     "summary": "${existingPackets.length} existing packets accounted for, X new packets proposed"
   }

Existing packets to include (${existingPackets.length} total):
${packetList}
`
    }
  }

  // Build nuance context section from extracted comments
  let nuanceSection = ""
  if (nuanceContext) {
    const sections: string[] = []

    if (nuanceContext.summary) {
      sections.push(`SUMMARY: ${nuanceContext.summary}`)
    }

    if (nuanceContext.decisions.length > 0) {
      sections.push(`KEY DECISIONS (MUST be reflected in your plan):\n${nuanceContext.decisions.map(d => `  - ${d}`).join("\n")}`)
    }

    if (nuanceContext.requirements.length > 0) {
      sections.push(`REQUIREMENTS FROM DISCUSSIONS (MUST be in acceptance criteria):\n${nuanceContext.requirements.map(r => `  - ${r}`).join("\n")}`)
    }

    if (nuanceContext.constraints.length > 0) {
      sections.push(`CONSTRAINTS MENTIONED:\n${nuanceContext.constraints.map(c => `  - ${c}`).join("\n")}`)
    }

    if (nuanceContext.concerns.length > 0) {
      sections.push(`CONCERNS TO ADDRESS (consider as risks or blockers):\n${nuanceContext.concerns.map(c => `  - ${c}`).join("\n")}`)
    }

    if (nuanceContext.actionItems.length > 0) {
      sections.push(`ACTION ITEMS (should become tasks in packets):\n${nuanceContext.actionItems.map(a => `  - ${a}`).join("\n")}`)
    }

    if (nuanceContext.context.length > 0) {
      sections.push(`IMPORTANT CONTEXT:\n${nuanceContext.context.map(c => `  - ${c}`).join("\n")}`)
    }

    if (sections.length > 0) {
      nuanceSection = `

=== EXTRACTED CONTEXT FROM DISCUSSIONS ===
READ CAREFULLY - This context was extracted from team discussions and comments.
These decisions, requirements, and concerns MUST be reflected in your build plan.

${sections.join("\n\n")}

=== END EXTRACTED CONTEXT ===
`
    }
  }

  // Build project type hint if specified
  const projectTypeHint = planType ? `
PROJECT TYPE: ${planType.toUpperCase()}
${planType === "game" ? "This is a VIDEO GAME project. Focus on game mechanics, player experience, levels, enemies, items, UI/HUD, and game loop." : ""}${planType === "vr" ? "This is a VR/AR project. Focus on VR locomotion, hand tracking, spatial UI, immersion, and VR-specific mechanics." : ""}${planType === "creative" ? "This is a CREATIVE/INTERACTIVE project. Focus on user experience, visual design, interactivity, and creative expression." : ""}${planType === "interactive" ? "This is an INTERACTIVE EXPERIENCE. Focus on user engagement, real-time feedback, and dynamic content." : ""}${planType === "web" ? "This is a WEB APPLICATION. Focus on frontend UI, backend API, database, authentication, and deployment." : ""}${planType === "mobile" ? "This is a MOBILE APP. Focus on mobile UI patterns, native features, offline support, and app store requirements." : ""}${planType === "api" ? "This is an API/BACKEND service. Focus on endpoints, data models, authentication, rate limiting, and documentation." : ""}${planType === "standard" ? "This is a standard software project. Focus on requirements, architecture, implementation, and testing." : ""}
` : ""

  return `Generate a build plan for:

PROJECT: ${projectName}${projectTypeHint}
DESCRIPTION: ${projectDescription}
${nuanceSection}

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
      "existing": false,
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
  "packetSummary": {
    "existingCount": 0,
    "newCount": 1,
    "summary": "0 existing packets accounted for, 1 new packet proposed"
  },
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
 * Generate a simplified prompt for smaller/less capable models
 * Shorter context, clearer structure, minimal complexity
 */
export function generateSimplifiedBuildPlanPrompt(
  projectName: string,
  projectDescription: string,
  nuanceContext?: NuanceContext
): string {
  // Build a condensed nuance section
  let contextSection = ""
  if (nuanceContext) {
    const items: string[] = []

    if (nuanceContext.decisions.length > 0) {
      items.push(`Decisions: ${nuanceContext.decisions.slice(0, 5).join("; ")}`)
    }
    if (nuanceContext.requirements.length > 0) {
      items.push(`Requirements: ${nuanceContext.requirements.slice(0, 5).join("; ")}`)
    }
    if (nuanceContext.concerns.length > 0) {
      items.push(`Concerns: ${nuanceContext.concerns.slice(0, 3).join("; ")}`)
    }

    if (items.length > 0) {
      contextSection = `\nContext from discussions:\n${items.join("\n")}\n`
    }
  }

  return `Project: ${projectName}
Description: ${projectDescription}
${contextSection}
Create packets for this project. Return JSON:
{
  "spec": {"name": "string", "objectives": ["string"]},
  "packets": [
    {
      "id": "pkt-1",
      "title": "string",
      "description": "string",
      "type": "feature",
      "priority": "high",
      "tasks": [{"id": "t1", "description": "string", "completed": false, "order": 1}],
      "acceptanceCriteria": ["string"]
    }
  ]
}

Return ONLY the JSON.`
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
 * Parse LLM response into BuildPlan with packet summary
 */
export function parseBuildPlanResponse(
  response: string,
  projectId: string,
  generatedBy: string
): BuildPlanParseResult | null {
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

    // Build packets with defaults, including existing flag
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
        existing: Boolean(packet.existing), // Parse existing flag from LLM response
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

    // Parse packet summary from LLM response or calculate from packets
    const llmPacketSummary = parsed.packetSummary as Record<string, unknown> | undefined
    const existingCount = buildPackets.filter(p => p.existing).length
    const newCount = buildPackets.filter(p => !p.existing).length

    const packetSummary: PacketSummary = {
      existingCount: (llmPacketSummary?.existingCount as number) ?? existingCount,
      newCount: (llmPacketSummary?.newCount as number) ?? newCount,
      summary: (llmPacketSummary?.summary as string) ||
        `${existingCount} existing packets accounted for, ${newCount} new packets proposed`
    }

    const plan: BuildPlan = {
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

    return { plan, packetSummary }
  } catch (error) {
    console.error("Failed to parse build plan:", error)
    return null
  }
}

/**
 * Merge LLM-generated packets with existing packets to ensure NONE are lost
 *
 * CRITICAL: This function ensures that existing packets are NEVER deleted.
 * The LLM can:
 * - Add new packets
 * - Update metadata of existing packets (priority, dependencies, etc.)
 * - NOT delete packets
 *
 * @param llmPackets - Packets returned by the LLM
 * @param existingPackets - Original existing packets that were passed to the LLM
 * @param defaultPhaseId - Default phase to assign orphaned packets to
 * @returns Merged packet list with all existing packets preserved
 */
export function mergePacketsWithExisting(
  llmPackets: WorkPacket[],
  existingPackets: ExistingPacketInfo[],
  defaultPhaseId: string = "phase-1"
): { packets: WorkPacket[]; mergeStats: { preserved: number; updated: number; added: number; missing: number } } {
  const mergeStats = { preserved: 0, updated: 0, added: 0, missing: 0 }

  // Create a map of LLM packets by ID for quick lookup
  const llmPacketMap = new Map<string, WorkPacket>()
  llmPackets.forEach(p => llmPacketMap.set(p.id, p))

  // Create a set of existing packet IDs
  const existingIds = new Set(existingPackets.map(p => p.id))

  const mergedPackets: WorkPacket[] = []

  // First, ensure ALL existing packets are in the output
  for (const existing of existingPackets) {
    const llmVersion = llmPacketMap.get(existing.id)

    if (llmVersion) {
      // LLM included this packet - use LLM version but ensure existing flag
      mergedPackets.push({
        ...llmVersion,
        existing: true
      })
      mergeStats.updated++
      llmPacketMap.delete(existing.id) // Remove from map so we don't add it again
    } else {
      // LLM MISSED this packet - preserve it with original data
      // This is the critical case that prevents packet loss
      mergedPackets.push({
        id: existing.id,
        phaseId: defaultPhaseId,
        title: existing.title,
        description: existing.description || "",
        type: "feature" as PacketType,
        priority: "medium",
        status: "queued",
        existing: true,
        tasks: [{ id: `${existing.id}-task-1`, description: existing.title, completed: false, order: 0 }],
        suggestedTaskType: "coding",
        blockedBy: [],
        blocks: [],
        estimatedTokens: 1000,
        acceptanceCriteria: [`Complete: ${existing.title}`]
      })
      mergeStats.missing++
      mergeStats.preserved++
    }
  }

  // Add any NEW packets from LLM (ones not in existing)
  for (const [id, packet] of llmPacketMap) {
    if (!existingIds.has(id)) {
      mergedPackets.push({
        ...packet,
        existing: false
      })
      mergeStats.added++
    }
  }

  console.log(`[mergePacketsWithExisting] Stats: ${mergeStats.preserved} preserved (${mergeStats.missing} were missing from LLM output), ${mergeStats.updated} updated, ${mergeStats.added} new`)

  return { packets: mergedPackets, mergeStats }
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

/**
 * Robust build plan generation with retry logic
 * Handles different model capabilities with progressive simplification
 */
export interface RobustGenerationOptions {
  projectId: string
  projectName: string
  projectDescription: string
  availableModels?: AssignedModel[]
  constraints?: Partial<BuildConstraints>
  existingPackets?: ExistingPacketInfo[]
  nuanceContext?: NuanceContext
  maxRetries?: number
  onProgress?: (status: string, attempt: number) => void
}

export interface RobustGenerationResult {
  plan: BuildPlan | null
  packetSummary: PacketSummary | null
  attempts: number
  usedSimplifiedPrompt: boolean
  error?: string
}

/**
 * Generate a build plan with automatic retry and prompt simplification
 * This function tries the full prompt first, then falls back to simplified prompts
 * for smaller models that may struggle with complex instructions
 */
export async function generateBuildPlanWithRetry(
  options: RobustGenerationOptions,
  generateFn: (systemPrompt: string, userPrompt: string) => Promise<{ content: string; error?: string }>
): Promise<RobustGenerationResult> {
  const maxRetries = options.maxRetries ?? 3
  let attempts = 0
  let usedSimplifiedPrompt = false
  let lastError: string | undefined

  while (attempts < maxRetries) {
    attempts++
    options.onProgress?.(`Attempt ${attempts}/${maxRetries}`, attempts)

    // Use full prompt on first attempt, simplified on retries
    const useSimplified = attempts > 1
    usedSimplifiedPrompt = useSimplified

    const systemPrompt = useSimplified
      ? BUILD_PLAN_SIMPLE_SYSTEM_PROMPT
      : BUILD_PLAN_SYSTEM_PROMPT

    const userPrompt = useSimplified
      ? generateSimplifiedBuildPlanPrompt(
          options.projectName,
          options.projectDescription,
          options.nuanceContext
        )
      : generateBuildPlanPrompt(
          options.projectName,
          options.projectDescription,
          options.availableModels || [],
          options.constraints,
          options.existingPackets,
          options.nuanceContext
        )

    console.log(`[Build Plan] Attempt ${attempts}/${maxRetries}, using ${useSimplified ? "simplified" : "full"} prompt`)

    try {
      const response = await generateFn(systemPrompt, userPrompt)

      if (response.error) {
        console.error(`[Build Plan] Attempt ${attempts} failed with error:`, response.error)
        lastError = response.error
        continue
      }

      // Try to parse the response
      const result = parseBuildPlanResponse(
        response.content,
        options.projectId,
        `retry-gen-attempt-${attempts}`
      )

      if (result) {
        console.log(`[Build Plan] Successfully generated plan on attempt ${attempts}`)
        return {
          plan: result.plan,
          packetSummary: result.packetSummary,
          attempts,
          usedSimplifiedPrompt
        }
      }

      console.warn(`[Build Plan] Attempt ${attempts}: Failed to parse response, trying next attempt`)
      lastError = "Failed to parse LLM response as valid JSON"
    } catch (error) {
      console.error(`[Build Plan] Attempt ${attempts} threw error:`, error)
      lastError = error instanceof Error ? error.message : "Unknown error"
    }
  }

  // All attempts failed
  console.error(`[Build Plan] All ${maxRetries} attempts failed. Last error: ${lastError}`)

  return {
    plan: null,
    packetSummary: null,
    attempts,
    usedSimplifiedPrompt,
    error: lastError || "Failed to generate build plan after all retries"
  }
}

/**
 * Merge multiple nuance contexts into one
 * Useful when aggregating context from multiple Linear issues
 */
export function mergeNuanceContexts(contexts: NuanceContext[]): NuanceContext {
  const merged: NuanceContext = {
    decisions: [],
    requirements: [],
    constraints: [],
    concerns: [],
    actionItems: [],
    context: []
  }

  for (const ctx of contexts) {
    merged.decisions.push(...ctx.decisions)
    merged.requirements.push(...ctx.requirements)
    merged.constraints.push(...ctx.constraints)
    merged.concerns.push(...ctx.concerns)
    merged.actionItems.push(...ctx.actionItems)
    merged.context.push(...ctx.context)
  }

  // Deduplicate (simple string comparison)
  merged.decisions = [...new Set(merged.decisions)]
  merged.requirements = [...new Set(merged.requirements)]
  merged.constraints = [...new Set(merged.constraints)]
  merged.concerns = [...new Set(merged.concerns)]
  merged.actionItems = [...new Set(merged.actionItems)]
  merged.context = [...new Set(merged.context)]

  // Generate summary
  merged.summary = `Aggregated from ${contexts.length} discussions: ` +
    `${merged.decisions.length} decisions, ` +
    `${merged.requirements.length} requirements, ` +
    `${merged.concerns.length} concerns identified.`

  return merged
}

/**
 * Check if a packet is a vision packet
 */
export function isVisionPacket(packet: WorkPacket): boolean {
  return packet.type === "vision" || packet.metadata?.isVisionPacket === true
}

/**
 * Check if a packet is a completion gate (blocks project completion)
 */
export function isCompletionGate(packet: WorkPacket): boolean {
  return packet.metadata?.completionGate === true
}

/**
 * Get the vision packet from a build plan (if any)
 */
export function getVisionPacket(plan: BuildPlan): WorkPacket | null {
  return plan.packets.find(p => isVisionPacket(p)) || null
}

/**
 * Check if a project is complete
 * A project is complete when all packets are complete AND vision packet (if any) is complete
 */
export function isProjectComplete(plan: BuildPlan): boolean {
  const allPacketsComplete = plan.packets.every(p => p.status === "completed")
  const visionPacket = getVisionPacket(plan)

  if (visionPacket) {
    // If there's a vision packet, it must also be complete
    return allPacketsComplete && visionPacket.status === "completed"
  }

  return allPacketsComplete
}

/**
 * Get project completion status with vision packet awareness
 */
export function getProjectCompletionStatus(plan: BuildPlan): {
  complete: boolean
  totalPackets: number
  completedPackets: number
  hasVisionPacket: boolean
  visionPacketComplete: boolean
  blockedByVision: boolean
  progress: number
} {
  const totalPackets = plan.packets.length
  const completedPackets = plan.packets.filter(p => p.status === "completed").length
  const visionPacket = getVisionPacket(plan)
  const hasVisionPacket = visionPacket !== null
  const visionPacketComplete = visionPacket ? visionPacket.status === "completed" : true

  // Calculate progress, but don't count vision packet in progress since it's the final gate
  const nonVisionPackets = plan.packets.filter(p => !isVisionPacket(p))
  const completedNonVision = nonVisionPackets.filter(p => p.status === "completed").length
  const progress = nonVisionPackets.length > 0
    ? Math.round((completedNonVision / nonVisionPackets.length) * 100)
    : 0

  // Project is blocked by vision if all other packets are done but vision isn't
  const allOthersComplete = nonVisionPackets.every(p => p.status === "completed")
  const blockedByVision = hasVisionPacket && allOthersComplete && !visionPacketComplete

  return {
    complete: completedPackets === totalPackets,
    totalPackets,
    completedPackets,
    hasVisionPacket,
    visionPacketComplete,
    blockedByVision,
    progress
  }
}

/**
 * Context for game/creative project in build plan generation
 */
export interface GameProjectContext {
  detection: GameProjectDetection
  existingVisionPacket?: VisionPacket | null
  storyElements?: string[]
  uniqueFeatures?: string[]
  technicalDetails?: string[]
}

/**
 * Generate build plan prompt with game project awareness
 */
export function generateGameAwareBuildPlanPrompt(
  projectName: string,
  projectDescription: string,
  availableModels: AssignedModel[],
  constraints?: Partial<BuildConstraints>,
  existingPackets?: ExistingPacketInfo[],
  nuanceContext?: NuanceContext,
  gameContext?: GameProjectContext
): string {
  // Start with the base prompt
  let prompt = generateBuildPlanPrompt(
    projectName,
    projectDescription,
    availableModels,
    constraints,
    existingPackets,
    nuanceContext
  )

  // Add game project context if detected
  if (gameContext?.detection.isGameOrCreative) {
    const gameSection = `

=== GAME/CREATIVE PROJECT DETECTED ===
This project has been detected as a ${gameContext.detection.projectType} project.
Category: ${gameContext.detection.suggestedCategory}
Confidence: ${gameContext.detection.confidence}
Matched keywords: ${gameContext.detection.matchedKeywords.slice(0, 10).join(", ")}

IMPORTANT FOR GAME PROJECTS:
1. ${gameContext.existingVisionPacket
    ? `A vision packet already exists: "${gameContext.existingVisionPacket.title}". Reference it but do not duplicate it.`
    : "Consider creating a vision packet that describes the final product as it would appear on a store page."}
2. Vision packets should have type: "vision" and priority: "critical"
3. The vision packet is a COMPLETION GATE - it should only be marked complete when the project matches its description
4. All other packets should work toward fulfilling the vision

${gameContext.storyElements?.length ? `STORY ELEMENTS:\n${gameContext.storyElements.map(s => `- ${s}`).join("\n")}\n` : ""}
${gameContext.uniqueFeatures?.length ? `UNIQUE FEATURES:\n${gameContext.uniqueFeatures.map(f => `- ${f}`).join("\n")}\n` : ""}
${gameContext.technicalDetails?.length ? `TECHNICAL DETAILS:\n${gameContext.technicalDetails.map(t => `- ${t}`).join("\n")}\n` : ""}
=== END GAME/CREATIVE PROJECT CONTEXT ===
`
    // Insert before the JSON structure
    prompt = prompt.replace(
      "Generate the build plan as JSON",
      gameSection + "\nGenerate the build plan as JSON"
    )
  }

  return prompt
}

// ============ Multi-Interview Build Plan Generation ============

import type { InterviewSession, InterviewMessage } from "@/lib/data/types"

/**
 * Options for generating a build plan from multiple interviews
 */
export interface BuildPlanFromInterviewsOptions {
  projectId: string
  projectName: string
  interviews: InterviewSession[]
  availableModels?: AssignedModel[]
  constraints?: Partial<BuildConstraints>
  existingPackets?: ExistingPacketInfo[]
}

/**
 * Format interview messages for inclusion in the prompt
 */
function formatInterviewMessages(messages: InterviewMessage[]): string {
  return messages
    .map((msg) => {
      const role = msg.role === "assistant" ? "AI" : "User"
      return `[${role}]: ${msg.content}`
    })
    .join("\n")
}

/**
 * Extract nuance context from an interview's extracted data
 */
function extractNuanceFromInterview(interview: InterviewSession): NuanceContext | null {
  const data = interview.extractedData
  if (!data) return null

  return {
    decisions: Array.isArray(data.decisions) ? data.decisions : [],
    requirements: Array.isArray(data.requirements)
      ? data.requirements
      : Array.isArray(data.features)
        ? data.features
        : [],
    constraints: Array.isArray(data.constraints) ? data.constraints : [],
    concerns: Array.isArray(data.concerns) ? data.concerns : [],
    actionItems: Array.isArray(data.actionItems) ? data.actionItems : [],
    context: Array.isArray(data.context) ? data.context : [],
    summary: interview.summary || undefined
  }
}

/**
 * Generate a build plan from multiple interviews
 * Combines all interview transcripts and extracted insights into a comprehensive context
 * for build plan generation
 */
export async function generateBuildPlanFromInterviews(
  options: BuildPlanFromInterviewsOptions,
  generateFn: (systemPrompt: string, userPrompt: string) => Promise<{ content: string; error?: string }>
): Promise<RobustGenerationResult> {
  const { projectId, projectName, interviews, availableModels, constraints, existingPackets } = options

  if (interviews.length === 0) {
    return {
      plan: null,
      packetSummary: null,
      attempts: 0,
      usedSimplifiedPrompt: false,
      error: "No interviews provided"
    }
  }

  // Combine all interview transcripts
  const combinedTranscript = interviews
    .map((interview, index) => {
      const typeLabel = interview.type.replace(/_/g, " ")
      const version = interview.version || index + 1
      return `## Interview ${version}: ${typeLabel}\n${formatInterviewMessages(interview.messages)}`
    })
    .join("\n\n---\n\n")

  // Combine all extracted nuance contexts
  const nuanceContexts = interviews
    .map(extractNuanceFromInterview)
    .filter((ctx): ctx is NuanceContext => ctx !== null)

  const combinedNuance = nuanceContexts.length > 0 ? mergeNuanceContexts(nuanceContexts) : undefined

  // Combine all extracted insights for additional context
  const combinedInsights = {
    goals: [...new Set(interviews.flatMap((i) => (i.extractedData?.goals as string[]) || []))],
    features: [...new Set(interviews.flatMap((i) => (i.extractedData?.features as string[]) || []))],
    techStack: [...new Set(interviews.flatMap((i) => (i.extractedData?.techStack as string[]) || []))],
    summaries: interviews.map((i) => i.summary).filter(Boolean) as string[]
  }

  // Build enhanced project description from combined interviews
  const enhancedDescription = `
${projectName}

=== INTERVIEW CONTEXT ===
This project was discussed across ${interviews.length} interview(s). The following context has been extracted:

${combinedInsights.summaries.length > 0 ? `SUMMARIES:\n${combinedInsights.summaries.map((s) => `- ${s}`).join("\n")}\n` : ""}
${combinedInsights.goals.length > 0 ? `GOALS:\n${combinedInsights.goals.map((g) => `- ${g}`).join("\n")}\n` : ""}
${combinedInsights.features.length > 0 ? `FEATURES DISCUSSED:\n${combinedInsights.features.map((f) => `- ${f}`).join("\n")}\n` : ""}
${combinedInsights.techStack.length > 0 ? `TECH STACK:\n${combinedInsights.techStack.map((t) => `- ${t}`).join("\n")}\n` : ""}

=== FULL INTERVIEW TRANSCRIPTS ===
${combinedTranscript}
`.trim()

  // Use the robust generation with retry logic
  return generateBuildPlanWithRetry(
    {
      projectId,
      projectName,
      projectDescription: enhancedDescription,
      availableModels,
      constraints,
      existingPackets,
      nuanceContext: combinedNuance,
      maxRetries: 3,
      onProgress: (status, attempt) => {
        console.log(`[Build Plan from Interviews] ${status} (attempt ${attempt})`)
      }
    },
    generateFn
  )
}

/**
 * System prompt specifically for interview-based build plan generation
 */
export const INTERVIEW_BUILD_PLAN_SYSTEM_PROMPT = `You are a senior software architect creating a build plan based on user interviews.

Your job is to carefully analyze the interview transcripts and extracted insights to create a comprehensive build plan that:

1. CAPTURES USER INTENT - Pay close attention to what the user actually wants
2. ADDRESSES ALL DISCUSSED FEATURES - Every feature mentioned should have a corresponding packet
3. RESPECTS CONSTRAINTS - Honor any technical or business constraints mentioned
4. PRIORITIZES CORRECTLY - Use the user's emphasis to determine priority
5. IS ACTIONABLE - Every packet should be something an AI or developer can execute

INTERVIEW ANALYSIS:
- Read ALL interview transcripts carefully
- Note any decisions, requirements, and concerns raised
- Identify explicit and implicit requirements
- Pay attention to user feedback and clarifications
- If multiple interviews exist, look for evolution of requirements

OUTPUT FORMAT: Return valid JSON only.
- No markdown code blocks
- No text before or after the JSON
- Start with { and end with }
- Use double quotes for all strings
- No trailing commas`
