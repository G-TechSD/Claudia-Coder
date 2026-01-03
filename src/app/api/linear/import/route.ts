/**
 * Linear Project Import API
 * Imports a Linear project with all its issues as work packets
 */

import { NextRequest, NextResponse } from "next/server"
import {
  importProject,
  hasLinearToken,
  mapLinearPriority,
  mapLinearState,
  LinearIssue
} from "@/lib/linear/api"

interface WorkPacket {
  id: string
  phaseId: string
  title: string
  description: string
  type: "feature" | "bugfix" | "refactor" | "test" | "docs" | "config" | "research"
  priority: "critical" | "high" | "medium" | "low"
  status: "queued" | "in_progress" | "completed" | "blocked"
  tasks: Array<{ id: string; description: string; completed: boolean; order: number }>
  suggestedTaskType: string
  acceptanceCriteria: string[]
  estimatedTokens: number
  dependencies: string[]
  metadata: {
    source: "linear"
    linearId: string
    linearIdentifier: string
    linearState: string
    linearLabels: string[]
    linearAssignee?: string
    linearParentId?: string
  }
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function inferPacketType(issue: LinearIssue): WorkPacket["type"] {
  const title = issue.title.toLowerCase()
  const labels = issue.labels.nodes.map(l => l.name.toLowerCase())

  if (labels.includes("bug") || labels.includes("fix") || title.includes("fix") || title.includes("bug")) {
    return "bugfix"
  }
  if (labels.includes("refactor") || title.includes("refactor")) {
    return "refactor"
  }
  if (labels.includes("test") || labels.includes("testing") || title.includes("test")) {
    return "test"
  }
  if (labels.includes("docs") || labels.includes("documentation") || title.includes("doc")) {
    return "docs"
  }
  if (labels.includes("config") || labels.includes("setup") || title.includes("config")) {
    return "config"
  }
  if (labels.includes("research") || labels.includes("spike") || title.includes("research")) {
    return "research"
  }
  return "feature"
}

function issueToPacket(issue: LinearIssue, phaseId: string): WorkPacket {
  // Parse description for task list items
  const tasks: WorkPacket["tasks"] = []
  if (issue.description) {
    const lines = issue.description.split("\n")
    let order = 0
    for (const line of lines) {
      const checkboxMatch = line.match(/^[-*]\s*\[([ x])\]\s*(.+)$/i)
      if (checkboxMatch) {
        tasks.push({
          id: `task-${generateId()}`,
          description: checkboxMatch[2].trim(),
          completed: checkboxMatch[1].toLowerCase() === "x",
          order: order++
        })
      }
    }
  }

  // If no tasks extracted, create one from the title
  if (tasks.length === 0) {
    tasks.push({
      id: `task-${generateId()}`,
      description: issue.title,
      completed: issue.state.type === "completed",
      order: 0
    })
  }

  // Extract acceptance criteria from description
  const acceptanceCriteria: string[] = []
  if (issue.description) {
    const acMatch = issue.description.match(/(?:acceptance criteria|done when|requirements?):?\s*\n((?:[-*]\s*.+\n?)+)/i)
    if (acMatch) {
      const criteria = acMatch[1].split("\n")
        .filter(line => line.trim().match(/^[-*]/))
        .map(line => line.replace(/^[-*]\s*/, "").trim())
      acceptanceCriteria.push(...criteria)
    }
  }

  if (acceptanceCriteria.length === 0) {
    acceptanceCriteria.push(`Complete: ${issue.title}`)
  }

  // Estimate tokens based on complexity indicators
  let estimatedTokens = 2000
  if (issue.estimate) {
    estimatedTokens = issue.estimate * 1000
  } else if (issue.description && issue.description.length > 500) {
    estimatedTokens = 4000
  }

  return {
    id: `packet-${generateId()}`,
    phaseId,
    title: issue.title,
    description: issue.description || issue.title,
    type: inferPacketType(issue),
    priority: mapLinearPriority(issue.priority),
    status: mapLinearState(issue.state.type),
    tasks,
    suggestedTaskType: "code",
    acceptanceCriteria,
    estimatedTokens,
    dependencies: issue.parent ? [`linear:${issue.parent.id}`] : [],
    metadata: {
      source: "linear",
      linearId: issue.id,
      linearIdentifier: issue.identifier,
      linearState: issue.state.name,
      linearLabels: issue.labels.nodes.map(l => l.name),
      linearAssignee: issue.assignee?.email,
      linearParentId: issue.parent?.id
    }
  }
}

export async function POST(request: NextRequest) {
  if (!hasLinearToken()) {
    return NextResponse.json(
      { error: "Linear API key not configured" },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()
    const { projectId } = body

    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      )
    }

    // Import the project and issues from Linear
    const importResult = await importProject(projectId)

    // Create a default phase for imported issues
    const defaultPhaseId = `phase-${generateId()}`

    // Convert issues to work packets
    const packets = importResult.issues.map(issue =>
      issueToPacket(issue, defaultPhaseId)
    )

    // Group packets by their inferred type for phase organization
    const phases = [
      {
        id: defaultPhaseId,
        name: "Imported from Linear",
        description: `${packets.length} issues imported from ${importResult.project.name}`,
        order: 0,
        status: "not_started" as const
      }
    ]

    // Build the import response
    return NextResponse.json({
      success: true,
      project: {
        name: importResult.project.name,
        description: importResult.project.description || "",
        linearProjectId: importResult.project.id,
        teamIds: importResult.teams.map(t => t.id),
        progress: importResult.project.progress
      },
      phases,
      packets,
      summary: {
        totalIssues: importResult.issues.length,
        byPriority: {
          critical: packets.filter(p => p.priority === "critical").length,
          high: packets.filter(p => p.priority === "high").length,
          medium: packets.filter(p => p.priority === "medium").length,
          low: packets.filter(p => p.priority === "low").length
        },
        byStatus: {
          queued: packets.filter(p => p.status === "queued").length,
          in_progress: packets.filter(p => p.status === "in_progress").length,
          completed: packets.filter(p => p.status === "completed").length
        },
        byType: {
          feature: packets.filter(p => p.type === "feature").length,
          bugfix: packets.filter(p => p.type === "bugfix").length,
          refactor: packets.filter(p => p.type === "refactor").length,
          test: packets.filter(p => p.type === "test").length,
          docs: packets.filter(p => p.type === "docs").length,
          config: packets.filter(p => p.type === "config").length,
          research: packets.filter(p => p.type === "research").length
        }
      }
    })

  } catch (error) {
    console.error("Linear import error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 500 }
    )
  }
}
