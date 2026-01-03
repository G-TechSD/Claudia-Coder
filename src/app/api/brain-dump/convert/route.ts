/**
 * Brain Dump Convert API
 * Converts approved brain dump items to work packets
 */

import { NextRequest, NextResponse } from "next/server"

interface ConvertRequest {
  brainDumpId: string
  projectId: string
  approvedActionItems: Array<{
    id: string
    description: string
    priority: "high" | "medium" | "low"
    category: "task" | "research" | "decision" | "question"
  }>
  approvedSections: Array<{
    id: string
    title: string
    content: string
    type: "overview" | "feature" | "technical" | "requirement" | "idea" | "concern" | "decision"
  }>
}

interface WorkPacketCreate {
  id: string
  phaseId: string
  title: string
  description: string
  type: "feature" | "bugfix" | "refactor" | "test" | "docs" | "config" | "research"
  priority: "critical" | "high" | "medium" | "low"
  status: "queued"
  tasks: Array<{ id: string; description: string; completed: boolean; order: number }>
  suggestedTaskType: string
  acceptanceCriteria: string[]
  estimatedTokens: number
  dependencies: string[]
  metadata: {
    source: "brain-dump"
    brainDumpId: string
    originalItemId: string
    originalCategory?: string
    originalType?: string
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function mapCategoryToPacketType(category: string): "feature" | "research" | "docs" {
  switch (category) {
    case "research":
      return "research"
    case "decision":
      return "docs"
    case "question":
      return "research"
    default:
      return "feature"
  }
}

function mapSectionTypeToPacketType(
  type: string
): "feature" | "bugfix" | "refactor" | "test" | "docs" | "config" | "research" {
  switch (type) {
    case "feature":
      return "feature"
    case "technical":
      return "refactor"
    case "requirement":
      return "feature"
    case "idea":
      return "research"
    case "concern":
      return "research"
    case "decision":
      return "docs"
    case "overview":
    default:
      return "docs"
  }
}

function mapPriority(priority: string): "critical" | "high" | "medium" | "low" {
  if (priority === "high") return "high"
  if (priority === "low") return "low"
  return "medium"
}

function mapToTaskType(category: string, sectionType?: string): string {
  if (category === "research" || sectionType === "idea") return "research"
  if (category === "decision" || sectionType === "decision") return "decision"
  if (sectionType === "technical") return "code"
  if (sectionType === "feature") return "code"
  return "general"
}

function extractTasks(content: string): string[] {
  // Try to extract bullet points or numbered items as tasks
  const lines = content.split("\n")
  const tasks: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    // Match bullet points or numbered lists
    const match = trimmed.match(/^[-*•]\s+(.+)$|^(\d+\.)\s+(.+)$/)
    if (match) {
      tasks.push(match[1] || match[3])
    }
  }

  // If no tasks extracted, create a single task from the content
  if (tasks.length === 0 && content.trim()) {
    // Truncate long content
    const truncated = content.length > 200 ? content.substring(0, 200) + "..." : content
    tasks.push(truncated)
  }

  return tasks
}

function createPacketFromActionItem(
  item: ConvertRequest["approvedActionItems"][0],
  projectId: string,
  brainDumpId: string
): WorkPacketCreate {
  return {
    id: `packet-${generateId()}`,
    phaseId: "brain-dump-phase", // Will be assigned to appropriate phase later
    title: item.description.length > 80
      ? item.description.substring(0, 77) + "..."
      : item.description,
    description: item.description,
    type: mapCategoryToPacketType(item.category),
    priority: mapPriority(item.priority),
    status: "queued",
    tasks: [
      {
        id: `task-${generateId()}`,
        description: item.description,
        completed: false,
        order: 0
      }
    ],
    suggestedTaskType: mapToTaskType(item.category),
    acceptanceCriteria: [
      `Complete: ${item.description}`,
      "Document any findings or decisions made"
    ],
    estimatedTokens: 1000,
    dependencies: [],
    metadata: {
      source: "brain-dump",
      brainDumpId,
      originalItemId: item.id,
      originalCategory: item.category
    }
  }
}

function createPacketFromSection(
  section: ConvertRequest["approvedSections"][0],
  projectId: string,
  brainDumpId: string
): WorkPacketCreate {
  const tasks = extractTasks(section.content)

  return {
    id: `packet-${generateId()}`,
    phaseId: "brain-dump-phase",
    title: section.title,
    description: section.content.length > 500
      ? section.content.substring(0, 497) + "..."
      : section.content,
    type: mapSectionTypeToPacketType(section.type),
    priority: "medium",
    status: "queued",
    tasks: tasks.map((task, i) => ({
      id: `task-${generateId()}`,
      description: task,
      completed: false,
      order: i
    })),
    suggestedTaskType: mapToTaskType("", section.type),
    acceptanceCriteria: [
      `Implement: ${section.title}`,
      "Review and validate implementation",
      "Document any changes or decisions"
    ],
    estimatedTokens: Math.max(1000, tasks.length * 500),
    dependencies: [],
    metadata: {
      source: "brain-dump",
      brainDumpId,
      originalItemId: section.id,
      originalType: section.type
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ConvertRequest = await request.json()
    const { brainDumpId, projectId, approvedActionItems, approvedSections } = body

    if (!brainDumpId || !projectId) {
      return NextResponse.json(
        { error: "brainDumpId and projectId are required" },
        { status: 400 }
      )
    }

    const createdPackets: WorkPacketCreate[] = []

    // Convert approved action items to packets
    for (const item of approvedActionItems || []) {
      const packet = createPacketFromActionItem(item, projectId, brainDumpId)
      createdPackets.push(packet)
    }

    // Convert approved sections to packets (only feature, technical, requirement types)
    const convertibleTypes = ["feature", "technical", "requirement"]
    for (const section of approvedSections || []) {
      if (convertibleTypes.includes(section.type)) {
        const packet = createPacketFromSection(section, projectId, brainDumpId)
        createdPackets.push(packet)
      }
    }

    // Return the packets for client-side storage
    // The client will add these to the project's packet list
    return NextResponse.json({
      success: true,
      packets: createdPackets,
      summary: {
        totalCreated: createdPackets.length,
        fromActionItems: (approvedActionItems || []).length,
        fromSections: createdPackets.length - (approvedActionItems || []).length
      }
    })

  } catch (error) {
    console.error("Brain dump convert error:", error)

    return NextResponse.json({
      error: error instanceof Error ? error.message : "Conversion failed"
    }, { status: 500 })
  }
}
