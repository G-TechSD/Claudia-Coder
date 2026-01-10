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
  LinearIssue,
  LinearComment
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
    linearComments?: Array<{
      id: string
      body: string
      createdAt: string
      updatedAt: string
      author?: string
    }>
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

function formatCommentsForContext(comments: LinearComment[]): string {
  if (!comments || comments.length === 0) return ""

  return comments
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(c => {
      const author = c.user?.name || "Unknown"
      const date = new Date(c.createdAt).toLocaleDateString()
      return `[${date}] ${author}: ${c.body}`
    })
    .join("\n\n")
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

  // Build description with comments context if available
  let description = issue.description || issue.title
  const commentsContext = issue.comments ? formatCommentsForContext(issue.comments) : ""
  if (commentsContext) {
    description += `\n\n---\n## Discussion Notes\n${commentsContext}`
  }

  // Map comments to metadata format
  const linearComments = issue.comments?.map(c => ({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    author: c.user?.name || c.user?.email
  }))

  return {
    id: `packet-${generateId()}`,
    phaseId,
    title: issue.title,
    description,
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
      linearParentId: issue.parent?.id,
      linearComments
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
    // Default syncComments to TRUE - always import comments for maximum context
    const { projectIds, projectId, syncComments = true } = body

    // Support both single projectId (legacy) and multiple projectIds
    const idsToImport: string[] = projectIds || (projectId ? [projectId] : [])

    if (idsToImport.length === 0) {
      return NextResponse.json(
        { error: "projectIds or projectId is required" },
        { status: 400 }
      )
    }

    // Import all selected projects in parallel
    // Pass syncComments to fetch all comments with pagination
    console.log(`[Linear Import] Starting import of ${idsToImport.length} project(s), syncComments: ${syncComments}`)
    const importResults = await Promise.all(
      idsToImport.map(id => importProject(id, { includeComments: syncComments }))
    )

    // Create a default phase for imported issues
    const defaultPhaseId = `phase-${generateId()}`

    // Combine all issues from all projects
    const allIssues = importResults.flatMap(result => result.issues)

    // Convert issues to work packets
    const packets = allIssues.map(issue =>
      issueToPacket(issue, defaultPhaseId)
    )

    // Build project names for the phase description
    const projectNames = importResults.map(r => r.project.name).join(", ")

    // Group packets by their inferred type for phase organization
    const phases = [
      {
        id: defaultPhaseId,
        name: "Imported from Linear",
        description: `${packets.length} issues imported from ${projectNames}`,
        order: 0,
        status: "not_started" as const
      }
    ]

    // Build the projects array for the response
    const projects = importResults.map(result => ({
      name: result.project.name,
      description: result.project.description || "",
      linearProjectId: result.project.id,
      teamIds: result.teams.map(t => t.id),
      progress: result.project.progress
    }))

    // Count total comments imported
    const totalComments = allIssues.reduce(
      (sum, issue) => sum + (issue.comments?.length || 0),
      0
    )
    console.log(`[Linear Import] Imported ${allIssues.length} issues with ${totalComments} total comments`)

    // Build the import response
    return NextResponse.json({
      success: true,
      projects,
      phases,
      packets,
      summary: {
        totalIssues: allIssues.length,
        totalComments: syncComments ? totalComments : 0,
        commentsImported: syncComments,
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
