/**
 * Universal Issue Import Webhook
 *
 * Accepts issues from ANY source (GitHub, Jira, Notion, custom, etc.)
 * and normalizes them into Claudia WorkPackets.
 *
 * This allows users to wire up any webhook-capable system to feed issues into Claudia.
 */

import { NextRequest, NextResponse } from "next/server"

// ============ Request Schema ============

interface ImportIssueRequest {
  source: string  // "github", "jira", "notion", "slack", "email", "custom", etc.
  issue: {
    title: string
    description?: string
    labels?: string[]
    priority?: string  // Will be normalized to critical/high/medium/low
    status?: string    // Will be normalized to queued/in_progress/completed/blocked
    metadata?: Record<string, unknown>  // Source-specific data
  }
  projectId?: string    // Optional - if not provided, uses projectName or creates new
  projectName?: string  // Used when projectId not provided
  webhookSecret?: string // Optional authentication
}

// ============ WorkPacket Type (matches build-plan.ts) ============

interface WorkPacket {
  id: string
  phaseId: string
  title: string
  description: string
  type: "feature" | "bugfix" | "refactor" | "test" | "docs" | "config" | "research"
  priority: "critical" | "high" | "medium" | "low"
  status: "queued" | "assigned" | "in_progress" | "review" | "completed" | "blocked"
  tasks: Array<{ id: string; description: string; completed: boolean; order: number }>
  suggestedTaskType: string
  blockedBy: string[]
  blocks: string[]
  estimatedTokens: number
  acceptanceCriteria: string[]
  assignedModel?: string
  metadata?: {
    source: string
    sourceId?: string
    sourceUrl?: string
    importedAt: string
    originalData?: Record<string, unknown>
  }
}

// ============ Helper Functions ============

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Normalize priority from various formats
 */
function normalizePriority(priority?: string): WorkPacket["priority"] {
  if (!priority) return "medium"

  const p = priority.toLowerCase()

  // Critical variations
  if (p.includes("critical") || p.includes("urgent") || p.includes("p0") || p === "highest") {
    return "critical"
  }

  // High variations
  if (p.includes("high") || p.includes("p1") || p === "major" || p === "important") {
    return "high"
  }

  // Low variations
  if (p.includes("low") || p.includes("p3") || p.includes("p4") || p === "minor" || p === "trivial") {
    return "low"
  }

  // Default to medium (p2, normal, etc.)
  return "medium"
}

/**
 * Normalize status from various formats
 */
function normalizeStatus(status?: string): WorkPacket["status"] {
  if (!status) return "queued"

  const s = status.toLowerCase()

  // Completed variations
  if (s.includes("done") || s.includes("complete") || s.includes("closed") || s.includes("resolved")) {
    return "completed"
  }

  // In progress variations
  if (s.includes("progress") || s.includes("started") || s.includes("doing") || s.includes("active")) {
    return "in_progress"
  }

  // Blocked variations
  if (s.includes("blocked") || s.includes("waiting") || s.includes("on hold") || s.includes("paused")) {
    return "blocked"
  }

  // Default to queued (todo, backlog, open, new, etc.)
  return "queued"
}

/**
 * Infer packet type from labels and content
 */
function inferPacketType(labels?: string[], title?: string, description?: string): WorkPacket["type"] {
  const allText = [
    ...(labels || []),
    title || "",
    (description || "").substring(0, 500)
  ].join(" ").toLowerCase()

  // Bug/fix patterns
  if (allText.match(/\b(bug|fix|error|crash|broken|issue|defect)\b/)) {
    return "bugfix"
  }

  // Test patterns
  if (allText.match(/\b(test|spec|coverage|qa|quality)\b/)) {
    return "test"
  }

  // Docs patterns
  if (allText.match(/\b(doc|document|readme|wiki|guide|tutorial)\b/)) {
    return "docs"
  }

  // Refactor patterns
  if (allText.match(/\b(refactor|cleanup|clean up|improve|optimize|technical debt)\b/)) {
    return "refactor"
  }

  // Config patterns
  if (allText.match(/\b(config|setup|install|deploy|ci|cd|infrastructure|infra)\b/)) {
    return "config"
  }

  // Research patterns
  if (allText.match(/\b(research|spike|investigate|explore|prototype|poc)\b/)) {
    return "research"
  }

  // Default to feature
  return "feature"
}

/**
 * Extract tasks from description (bullet points, checkboxes, numbered lists)
 */
function extractTasks(description?: string): WorkPacket["tasks"] {
  const tasks: WorkPacket["tasks"] = []

  if (!description) {
    return tasks
  }

  const lines = description.split("\n")
  let order = 0

  for (const line of lines) {
    const trimmed = line.trim()

    // Match checkboxes: - [ ] task, * [x] task, etc.
    const checkboxMatch = trimmed.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/)
    if (checkboxMatch) {
      tasks.push({
        id: `task-${generateId()}`,
        description: checkboxMatch[2].trim(),
        completed: checkboxMatch[1].toLowerCase() === "x",
        order: order++
      })
      continue
    }

    // Match bullet points: - item, * item, + item
    const bulletMatch = trimmed.match(/^[-*+]\s+(.+)$/)
    if (bulletMatch && bulletMatch[1].length > 5) {
      tasks.push({
        id: `task-${generateId()}`,
        description: bulletMatch[1].trim(),
        completed: false,
        order: order++
      })
      continue
    }

    // Match numbered lists: 1. item, 1) item
    const numberedMatch = trimmed.match(/^\d+[.)]\s+(.+)$/)
    if (numberedMatch && numberedMatch[1].length > 5) {
      tasks.push({
        id: `task-${generateId()}`,
        description: numberedMatch[1].trim(),
        completed: false,
        order: order++
      })
    }
  }

  return tasks
}

/**
 * Extract acceptance criteria from description
 */
function extractAcceptanceCriteria(description?: string, title?: string): string[] {
  const criteria: string[] = []

  if (!description) {
    return [`Complete: ${title || "Issue"}`]
  }

  // Look for acceptance criteria section
  const acMatch = description.match(
    /(?:acceptance criteria|done when|definition of done|requirements?|expected|criteria):?\s*\n((?:[-*]\s*.+\n?)+)/i
  )

  if (acMatch) {
    const acLines = acMatch[1].split("\n")
      .filter(line => line.trim().match(/^[-*]/))
      .map(line => line.replace(/^[-*]\s*/, "").trim())
      .filter(line => line.length > 0)

    criteria.push(...acLines)
  }

  // If no explicit AC found, generate basic ones
  if (criteria.length === 0) {
    criteria.push(`Complete: ${title || "Issue"}`)

    // Add verification criterion if it looks like a feature/bug
    const type = inferPacketType([], title, description)
    if (type === "feature") {
      criteria.push("Feature works as expected")
    } else if (type === "bugfix") {
      criteria.push("Bug is fixed and verified")
    } else if (type === "test") {
      criteria.push("Tests pass and provide adequate coverage")
    }
  }

  return criteria
}

/**
 * Convert imported issue to WorkPacket
 */
function issueToWorkPacket(
  source: string,
  issue: ImportIssueRequest["issue"],
  projectId: string
): WorkPacket {
  const tasks = extractTasks(issue.description)

  // If no tasks extracted, create one from title
  if (tasks.length === 0) {
    tasks.push({
      id: `task-${generateId()}`,
      description: issue.title,
      completed: false,
      order: 0
    })
  }

  const packetType = inferPacketType(issue.labels, issue.title, issue.description)

  // Estimate tokens based on complexity
  let estimatedTokens = 2000
  if (issue.description) {
    if (issue.description.length > 1000) estimatedTokens = 5000
    else if (issue.description.length > 500) estimatedTokens = 3000
  }
  estimatedTokens += tasks.length * 500

  return {
    id: `packet-${generateId()}`,
    phaseId: `${source}-import-phase`,
    title: issue.title.length > 100
      ? issue.title.substring(0, 97) + "..."
      : issue.title,
    description: issue.description || issue.title,
    type: packetType,
    priority: normalizePriority(issue.priority),
    status: normalizeStatus(issue.status),
    tasks,
    suggestedTaskType: packetType === "docs" ? "documentation" : "coding",
    blockedBy: [],
    blocks: [],
    estimatedTokens,
    acceptanceCriteria: extractAcceptanceCriteria(issue.description, issue.title),
    metadata: {
      source,
      sourceId: issue.metadata?.id as string | undefined,
      sourceUrl: issue.metadata?.url as string | undefined,
      importedAt: new Date().toISOString(),
      originalData: issue.metadata
    }
  }
}

/**
 * Validate webhook secret if configured
 */
function validateSecret(request: NextRequest, providedSecret?: string): boolean {
  const configuredSecret = process.env.CLAUDIA_WEBHOOK_SECRET

  // If no secret configured, allow all requests
  if (!configuredSecret) {
    return true
  }

  // Check provided secret in body
  if (providedSecret && providedSecret === configuredSecret) {
    return true
  }

  // Check Authorization header
  const authHeader = request.headers.get("authorization")
  if (authHeader) {
    const [scheme, token] = authHeader.split(" ")
    if (scheme.toLowerCase() === "bearer" && token === configuredSecret) {
      return true
    }
  }

  // Check X-Webhook-Secret header
  const webhookSecretHeader = request.headers.get("x-webhook-secret")
  if (webhookSecretHeader === configuredSecret) {
    return true
  }

  return false
}

// ============ API Route Handler ============

export async function POST(request: NextRequest) {
  try {
    const body: ImportIssueRequest = await request.json()

    // Validate authentication
    if (!validateSecret(request, body.webhookSecret)) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Invalid or missing webhook secret" },
        { status: 401 }
      )
    }

    // Validate required fields
    if (!body.source) {
      return NextResponse.json(
        { error: "Bad Request", message: "source is required" },
        { status: 400 }
      )
    }

    if (!body.issue?.title) {
      return NextResponse.json(
        { error: "Bad Request", message: "issue.title is required" },
        { status: 400 }
      )
    }

    // Determine project ID
    let projectId = body.projectId
    let projectCreated = false
    let projectName = body.projectName

    // If no project ID, generate one from project name or create default
    if (!projectId) {
      if (projectName) {
        // Create a deterministic ID from project name
        projectId = `proj-${projectName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`
      } else {
        // Use source-based project
        projectId = `proj-${body.source.toLowerCase()}-imports`
        projectName = `${body.source} Imports`
      }
      projectCreated = true
    }

    // Convert issue to work packet
    const packet = issueToWorkPacket(body.source, body.issue, projectId)

    // Return the packet data for client-side storage
    // In a real implementation, this would be stored server-side
    // For now, we return it for the client to handle
    return NextResponse.json({
      success: true,
      packet,
      project: {
        id: projectId,
        name: projectName || projectId,
        created: projectCreated
      },
      message: `Successfully imported issue from ${body.source}`,
      importedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error("Import issue webhook error:", error)

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid JSON in request body" },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Failed to import issue"
      },
      { status: 500 }
    )
  }
}

// Support OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Webhook-Secret",
      "Access-Control-Max-Age": "86400"
    }
  })
}

// GET endpoint for health check and documentation
export async function GET() {
  return NextResponse.json({
    name: "Claudia Universal Issue Import Webhook",
    version: "1.0.0",
    description: "Import issues from any source into Claudia work packets",
    endpoints: {
      POST: "/api/webhook/import-issue",
      OPTIONS: "/api/webhook/import-issue (CORS preflight)"
    },
    schema: {
      source: "string (required) - e.g., 'github', 'jira', 'notion', 'custom'",
      issue: {
        title: "string (required)",
        description: "string (optional)",
        labels: "string[] (optional)",
        priority: "string (optional) - normalized to critical/high/medium/low",
        status: "string (optional) - normalized to queued/in_progress/completed/blocked",
        metadata: "object (optional) - source-specific data"
      },
      projectId: "string (optional) - existing project ID",
      projectName: "string (optional) - used if projectId not provided",
      webhookSecret: "string (optional) - for authentication"
    },
    authentication: {
      methods: [
        "Body: webhookSecret field",
        "Header: Authorization: Bearer <secret>",
        "Header: X-Webhook-Secret: <secret>"
      ],
      note: "Authentication required only if CLAUDIA_WEBHOOK_SECRET env var is set"
    },
    examples: {
      github: {
        source: "github",
        issue: {
          title: "Fix login bug",
          description: "Users cannot login with special characters in password",
          labels: ["bug", "high-priority"],
          priority: "high",
          metadata: {
            id: "12345",
            url: "https://github.com/org/repo/issues/12345",
            author: "username"
          }
        },
        projectName: "My Project"
      },
      jira: {
        source: "jira",
        issue: {
          title: "PROJ-123: Implement user dashboard",
          description: "Create a user dashboard with recent activity",
          priority: "Medium",
          status: "To Do",
          metadata: {
            key: "PROJ-123",
            issueType: "Story"
          }
        },
        projectId: "existing-project-id"
      }
    }
  })
}
