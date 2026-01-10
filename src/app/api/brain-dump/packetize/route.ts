/**
 * Brain Dump Packetize API
 * Extracts actionable items from brain dump transcripts for existing projects
 * Uses Beast LLM (gpt-oss-20b) to categorize and generate work packets
 */

import { NextRequest, NextResponse } from "next/server"
import { generateWithLocalLLM } from "@/lib/llm/local-llm"

// Categories for brain dump items
export type BrainDumpItemCategory =
  | "feature_request"
  | "bug_fix"
  | "change_request"
  | "enhancement"
  | "feedback"

export interface ExtractedBrainDumpItem {
  id: string
  title: string
  description: string
  category: BrainDumpItemCategory
  priority: "critical" | "high" | "medium" | "low"
  reasoning: string  // Why this was categorized this way
}

export interface ProposedPacket {
  id: string
  title: string
  description: string
  type: "feature" | "bugfix" | "refactor" | "enhancement" | "research" | "docs"
  priority: "critical" | "high" | "medium" | "low"
  category: BrainDumpItemCategory
  tasks: Array<{ id: string; description: string; completed: boolean; order: number }>
  acceptanceCriteria: string[]
  sourceItem: ExtractedBrainDumpItem
}

interface PacketizeRequest {
  transcript: string
  projectId: string
  projectName?: string
  projectDescription?: string
  existingContext?: {
    hasBuildPlan: boolean
    hasPackets: boolean
    currentPhase?: string
    recentActivity?: string[]
  }
}

const SYSTEM_PROMPT = `You are an expert project analyst processing a voice recording transcript for an EXISTING project.
Your job is to extract NEW actionable items that should be added to the project's work queue.

IMPORTANT: This is for an existing project that already has work in progress. Extract only NEW requests/feedback.

Categorize each item as one of:
- feature_request: New functionality the user wants added
- bug_fix: Something broken that needs fixing
- change_request: Modification to existing functionality
- enhancement: Improvement to existing features
- feedback: General feedback, observations, or concerns

For each item, determine priority:
- critical: Blocks progress or causes major issues
- high: Important for upcoming work
- medium: Should be done but not urgent
- low: Nice to have, can be deferred

Return ONLY valid JSON matching the schema. No markdown code blocks, no explanation.`

function buildUserPrompt(request: PacketizeRequest): string {
  let contextSection = ""

  if (request.existingContext) {
    contextSection = `
EXISTING PROJECT CONTEXT:
- Has build plan: ${request.existingContext.hasBuildPlan ? "Yes" : "No"}
- Has packets: ${request.existingContext.hasPackets ? "Yes" : "No"}
${request.existingContext.currentPhase ? `- Current phase: ${request.existingContext.currentPhase}` : ""}
${request.existingContext.recentActivity?.length ? `- Recent activity: ${request.existingContext.recentActivity.join(", ")}` : ""}
`
  }

  return `Extract actionable items from this brain dump transcript for project: "${request.projectName || "Unknown"}".
${request.projectDescription ? `Project description: ${request.projectDescription}` : ""}
${contextSection}
TRANSCRIPT:
${request.transcript}

Extract NEW items that should become work packets. Return this exact JSON structure:
{
  "items": [
    {
      "id": "item-1",
      "title": "Short descriptive title (max 80 chars)",
      "description": "Detailed description of what needs to be done",
      "category": "feature_request|bug_fix|change_request|enhancement|feedback",
      "priority": "critical|high|medium|low",
      "reasoning": "Brief explanation of why this was categorized this way"
    }
  ],
  "summary": "Brief summary of what was extracted",
  "totalCount": 0
}

Return ONLY the JSON, no markdown code blocks.`
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function mapCategoryToPacketType(category: BrainDumpItemCategory): ProposedPacket["type"] {
  switch (category) {
    case "feature_request":
      return "feature"
    case "bug_fix":
      return "bugfix"
    case "change_request":
      return "refactor"
    case "enhancement":
      return "enhancement"
    case "feedback":
      return "research"
    default:
      return "feature"
  }
}

function generateTasksFromItem(item: ExtractedBrainDumpItem): ProposedPacket["tasks"] {
  // Generate basic tasks based on category
  const baseTasks: string[] = []

  switch (item.category) {
    case "bug_fix":
      baseTasks.push(
        "Reproduce and understand the issue",
        "Implement fix",
        "Add tests to prevent regression",
        "Verify fix works in all scenarios"
      )
      break
    case "feature_request":
      baseTasks.push(
        "Design and plan implementation approach",
        "Implement core functionality",
        "Add appropriate tests",
        "Update documentation if needed"
      )
      break
    case "change_request":
      baseTasks.push(
        "Review current implementation",
        "Plan and implement changes",
        "Update affected tests",
        "Verify no regressions"
      )
      break
    case "enhancement":
      baseTasks.push(
        "Analyze current behavior",
        "Implement enhancement",
        "Test improved functionality"
      )
      break
    case "feedback":
      baseTasks.push(
        "Review and analyze feedback",
        "Document findings and recommendations",
        "Create follow-up tasks if needed"
      )
      break
  }

  return baseTasks.map((desc, i) => ({
    id: `task-${generateId()}`,
    description: desc,
    completed: false,
    order: i
  }))
}

function generateAcceptanceCriteria(item: ExtractedBrainDumpItem): string[] {
  const criteria: string[] = []

  switch (item.category) {
    case "bug_fix":
      criteria.push(
        `Issue is fixed: ${item.title}`,
        "No regressions introduced",
        "Tests pass"
      )
      break
    case "feature_request":
      criteria.push(
        `Feature implemented: ${item.title}`,
        "Feature works as described",
        "Tests cover new functionality"
      )
      break
    case "change_request":
      criteria.push(
        `Change implemented: ${item.title}`,
        "Existing functionality preserved",
        "Tests updated and passing"
      )
      break
    case "enhancement":
      criteria.push(
        `Enhancement complete: ${item.title}`,
        "Improved behavior verified"
      )
      break
    case "feedback":
      criteria.push(
        `Feedback addressed: ${item.title}`,
        "Actions documented"
      )
      break
  }

  return criteria
}

function createProposedPacket(item: ExtractedBrainDumpItem): ProposedPacket {
  return {
    id: `packet-${generateId()}`,
    title: item.title.length > 80 ? item.title.substring(0, 77) + "..." : item.title,
    description: item.description,
    type: mapCategoryToPacketType(item.category),
    priority: item.priority,
    category: item.category,
    tasks: generateTasksFromItem(item),
    acceptanceCriteria: generateAcceptanceCriteria(item),
    sourceItem: item
  }
}

function parseResponse(content: string): {
  items: ExtractedBrainDumpItem[]
  summary: string
  totalCount: number
} {
  let jsonStr = content.trim()

  // Remove markdown code blocks if present
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "")
  }

  try {
    const parsed = JSON.parse(jsonStr)

    // Validate and normalize items
    const items: ExtractedBrainDumpItem[] = (parsed.items || []).map((item: {
      id?: string
      title: string
      description: string
      category: string
      priority: string
      reasoning?: string
    }) => ({
      id: item.id || generateId(),
      title: item.title || "Untitled item",
      description: item.description || "",
      category: validateCategory(item.category),
      priority: validatePriority(item.priority),
      reasoning: item.reasoning || ""
    }))

    return {
      items,
      summary: parsed.summary || "",
      totalCount: items.length
    }
  } catch (error) {
    console.error("Failed to parse LLM response:", error)
    console.error("Raw content:", content)

    return {
      items: [],
      summary: "Failed to parse response",
      totalCount: 0
    }
  }
}

function validateCategory(category: string): BrainDumpItemCategory {
  const validCategories: BrainDumpItemCategory[] = [
    "feature_request",
    "bug_fix",
    "change_request",
    "enhancement",
    "feedback"
  ]

  if (validCategories.includes(category as BrainDumpItemCategory)) {
    return category as BrainDumpItemCategory
  }

  // Map common variations
  if (category === "bug" || category === "fix") return "bug_fix"
  if (category === "feature" || category === "new") return "feature_request"
  if (category === "change" || category === "modify") return "change_request"
  if (category === "improve" || category === "enhancement") return "enhancement"

  return "feedback"
}

function validatePriority(priority: string): ProposedPacket["priority"] {
  const validPriorities = ["critical", "high", "medium", "low"]

  if (validPriorities.includes(priority)) {
    return priority as ProposedPacket["priority"]
  }

  return "medium"
}

export async function POST(request: NextRequest) {
  try {
    const body: PacketizeRequest = await request.json()
    const { transcript, projectId, projectName, projectDescription, existingContext } = body

    if (!transcript) {
      return NextResponse.json(
        { error: "No transcript provided" },
        { status: 400 }
      )
    }

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      )
    }

    // Build the prompt
    const userPrompt = buildUserPrompt({
      transcript,
      projectId,
      projectName,
      projectDescription,
      existingContext
    })

    // Call Beast LLM with gpt-oss-20b
    const llmResponse = await generateWithLocalLLM(
      SYSTEM_PROMPT,
      userPrompt,
      {
        temperature: 0.3,
        max_tokens: 4096,
        preferredServer: "beast",
        preferredModel: "gpt-oss-20b"
      }
    )

    if (llmResponse.error) {
      return NextResponse.json(
        { error: `LLM error: ${llmResponse.error}` },
        { status: 500 }
      )
    }

    // Parse the response
    const parsed = parseResponse(llmResponse.content)

    // Convert extracted items to proposed packets
    const proposedPackets = parsed.items.map(createProposedPacket)

    // Group by category for display
    const byCategory: Record<BrainDumpItemCategory, ProposedPacket[]> = {
      feature_request: [],
      bug_fix: [],
      change_request: [],
      enhancement: [],
      feedback: []
    }

    for (const packet of proposedPackets) {
      byCategory[packet.category].push(packet)
    }

    return NextResponse.json({
      success: true,
      proposedPackets,
      byCategory,
      summary: parsed.summary,
      totalCount: parsed.totalCount,
      processedBy: {
        server: llmResponse.server,
        model: llmResponse.model
      }
    })

  } catch (error) {
    console.error("Brain dump packetize error:", error)

    return NextResponse.json({
      error: error instanceof Error ? error.message : "Packetization failed"
    }, { status: 500 })
  }
}
