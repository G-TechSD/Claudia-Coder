/**
 * Project Comments API Route
 *
 * Supports quick comments with auto-packetization:
 * - POST: Add comment, optionally packetize via LLM
 * - GET: List project comments
 *
 * Comments can be instantly converted to structured work packets.
 */

import { NextRequest, NextResponse } from "next/server"
import { generate, parseLLMJson } from "@/lib/llm"
import * as fs from "fs"
import * as path from "path"

// Comment types
export type CommentType =
  | "feature-request"
  | "bug-fix"
  | "change"
  | "enhancement"
  | "feedback"
  | "question"

export type CommentStatus = "pending" | "converted" | "dismissed"

export interface ProjectComment {
  id: string
  projectId: string
  content: string
  type: CommentType
  createdAt: string
  linkedPacketId?: string
  status: CommentStatus
}

// Proposed packet structure from LLM
export interface ProposedPacket {
  title: string
  description: string
  type: string
  priority: "low" | "medium" | "high" | "critical"
  tasks: Array<{ id: string; description: string; completed: boolean }>
  acceptanceCriteria: string[]
}

// Local storage path for comments
function getCommentsStoragePath(): string {
  return path.join(process.cwd(), ".local-storage", "project-comments.json")
}

// Load comments from local storage
function loadComments(): Record<string, ProjectComment[]> {
  try {
    const storagePath = getCommentsStoragePath()
    if (fs.existsSync(storagePath)) {
      const content = fs.readFileSync(storagePath, "utf-8")
      return JSON.parse(content)
    }
  } catch (error) {
    console.error("[comments] Failed to load comments:", error)
  }
  return {}
}

// Save comments to local storage
function saveComments(comments: Record<string, ProjectComment[]>): void {
  try {
    const storagePath = getCommentsStoragePath()
    const dir = path.dirname(storagePath)

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    fs.writeFileSync(storagePath, JSON.stringify(comments, null, 2))
  } catch (error) {
    console.error("[comments] Failed to save comments:", error)
  }
}

interface PacketizeResult {
  packet: ProposedPacket
  source: string
  server?: string
}

// Generate packet from comment using LLM (with cloud fallback)
async function packetizeComment(
  comment: string,
  type: CommentType,
  projectName: string
): Promise<PacketizeResult> {
  const typeDescriptions: Record<CommentType, string> = {
    "feature-request": "a new feature to be added",
    "bug-fix": "a bug that needs to be fixed",
    "change": "a change to existing functionality",
    "enhancement": "an improvement to existing features",
    "feedback": "general feedback or suggestion",
    "question": "a question that needs investigation"
  }

  const systemPrompt = `You are a project manager assistant that converts comments into structured work packets.

Your task is to take a user's comment and convert it into a clear, actionable work packet with:
- A concise, descriptive title (5-10 words)
- A clear description of what needs to be done
- A list of specific tasks to complete
- Acceptance criteria to verify the work is done

Be practical and specific. Don't add unnecessary scope. Focus on what the user actually asked for.

Respond ONLY with a valid JSON object in this exact format:
{
  "title": "Brief descriptive title",
  "description": "Clear description of the work to be done",
  "type": "feature|bugfix|refactor|test|docs|config|research",
  "priority": "low|medium|high|critical",
  "tasks": [
    { "id": "task-1", "description": "First task", "completed": false },
    { "id": "task-2", "description": "Second task", "completed": false }
  ],
  "acceptanceCriteria": [
    "First criterion that must be met",
    "Second criterion that must be met"
  ]
}`

  const userPrompt = `Project: ${projectName}
Comment Type: ${typeDescriptions[type]}
Comment: ${comment}

Convert this comment into a structured work packet. The type should map to:
- feature-request -> "feature"
- bug-fix -> "bugfix"
- change -> "feature" or "refactor"
- enhancement -> "feature"
- feedback -> "feature" or "research"
- question -> "research"

Respond with ONLY the JSON object, no other text.`

  try {
    // Use unified LLM service with cloud fallback enabled
    const response = await generate({
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      max_tokens: 1000,
      allowPaidFallback: true // Enable cloud fallback when local LLM unavailable
    })

    if (response.error || !response.content) {
      console.error("[comments] LLM packetization failed:", response.error)
      console.error("[comments] LLM source:", response.source, "server:", response.server)
      throw new Error(`LLM error: ${response.error || "No content returned"}`)
    }

    console.log(`[comments] LLM response received from ${response.source}${response.server ? ` (${response.server})` : ""}, content length: ${response.content.length}`)

    // Parse the JSON response using the unified parser
    const packet = parseLLMJson<ProposedPacket>(response.content)

    if (!packet) {
      console.error("[comments] Failed to parse packet JSON from LLM response")
      console.error("[comments] Raw response (first 500 chars):", response.content.substring(0, 500))
      throw new Error("Failed to parse LLM response as JSON")
    }

    // Validate the packet structure
    if (!packet.title || !packet.description || !packet.tasks) {
      console.error("[comments] Invalid packet structure from LLM:", JSON.stringify(packet, null, 2))
      throw new Error(`Invalid packet structure: missing ${!packet.title ? "title" : !packet.description ? "description" : "tasks"}`)
    }

    // Ensure tasks have IDs
    packet.tasks = packet.tasks.map((task, i) => ({
      id: task.id || `task-${i + 1}`,
      description: task.description,
      completed: false
    }))

    console.log(`[comments] Packetization successful via ${response.source}${response.server ? ` (${response.server})` : ""}`)
    return { packet, source: response.source, server: response.server }
  } catch (error) {
    console.error("[comments] Packetization error:", error)
    // Re-throw with context so the caller gets the specific error
    throw error
  }
}

/**
 * GET /api/projects/[id]/comments
 *
 * List all comments for a project
 *
 * Query params:
 *   - status: Filter by status (pending, converted, dismissed)
 *   - type: Filter by comment type
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const { searchParams } = new URL(request.url)
  const statusFilter = searchParams.get("status") as CommentStatus | null
  const typeFilter = searchParams.get("type") as CommentType | null

  try {
    const allComments = loadComments()
    let projectComments = allComments[projectId] || []

    // Apply filters
    if (statusFilter) {
      projectComments = projectComments.filter(c => c.status === statusFilter)
    }
    if (typeFilter) {
      projectComments = projectComments.filter(c => c.type === typeFilter)
    }

    // Sort by creation date (newest first)
    projectComments.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return NextResponse.json({
      success: true,
      count: projectComments.length,
      comments: projectComments
    })
  } catch (error) {
    console.error("[comments] GET error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch comments",
      comments: []
    }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/comments
 *
 * Add a new comment and optionally packetize it
 *
 * Body:
 *   - content: The comment text
 *   - type: Comment type (feature-request, bug-fix, etc.)
 *   - autoPacketize?: Whether to auto-convert to packet
 *
 * Or for packetization:
 *   - action: "packetize"
 *   - commentId: The comment to packetize
 *   - content: The comment text
 *   - type: Comment type
 *   - projectName: The project name for context
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params

  try {
    const body = await request.json()

    // Handle packetization request
    if (body.action === "packetize") {
      const { content, type, projectName } = body

      if (!content || !type || !projectName) {
        return NextResponse.json({
          success: false,
          error: "content, type, and projectName are required for packetization"
        }, { status: 400 })
      }

      try {
        const result = await packetizeComment(content, type, projectName)

        return NextResponse.json({
          success: true,
          proposedPacket: result.packet,
          source: result.source,
          server: result.server
        })
      } catch (packetError) {
        const errorMessage = packetError instanceof Error ? packetError.message : "Unknown error"
        console.error("[comments] Packetization failed:", errorMessage)
        return NextResponse.json({
          success: false,
          error: `Packetization failed: ${errorMessage}`
        }, { status: 503 })
      }
    }

    // Handle new comment
    const { content, type } = body

    if (!content || !type) {
      return NextResponse.json({
        success: false,
        error: "content and type are required"
      }, { status: 400 })
    }

    // Create new comment
    const newComment: ProjectComment = {
      id: `comment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      projectId,
      content: content.trim(),
      type,
      createdAt: new Date().toISOString(),
      status: "pending"
    }

    // Save comment
    const allComments = loadComments()
    if (!allComments[projectId]) {
      allComments[projectId] = []
    }
    allComments[projectId].push(newComment)
    saveComments(allComments)

    return NextResponse.json({
      success: true,
      comment: newComment
    })
  } catch (error) {
    console.error("[comments] POST error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create comment"
    }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[id]/comments
 *
 * Update a comment (e.g., link to packet, change status)
 *
 * Body:
 *   - commentId: The comment to update
 *   - linkedPacketId?: ID of linked packet
 *   - status?: New status
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params

  try {
    const body = await request.json()
    const { commentId, linkedPacketId, status } = body

    if (!commentId) {
      return NextResponse.json({
        success: false,
        error: "commentId is required"
      }, { status: 400 })
    }

    const allComments = loadComments()
    const projectComments = allComments[projectId] || []

    const commentIndex = projectComments.findIndex(c => c.id === commentId)
    if (commentIndex === -1) {
      return NextResponse.json({
        success: false,
        error: "Comment not found"
      }, { status: 404 })
    }

    // Update comment
    if (linkedPacketId !== undefined) {
      projectComments[commentIndex].linkedPacketId = linkedPacketId
      projectComments[commentIndex].status = "converted"
    }
    if (status !== undefined) {
      projectComments[commentIndex].status = status
    }

    allComments[projectId] = projectComments
    saveComments(allComments)

    return NextResponse.json({
      success: true,
      comment: projectComments[commentIndex]
    })
  } catch (error) {
    console.error("[comments] PATCH error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update comment"
    }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/comments
 *
 * Delete a comment
 *
 * Query params:
 *   - commentId: The comment to delete
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const { searchParams } = new URL(request.url)
  const commentId = searchParams.get("commentId")

  if (!commentId) {
    return NextResponse.json({
      success: false,
      error: "commentId is required"
    }, { status: 400 })
  }

  try {
    const allComments = loadComments()
    const projectComments = allComments[projectId] || []

    const newComments = projectComments.filter(c => c.id !== commentId)

    if (newComments.length === projectComments.length) {
      return NextResponse.json({
        success: false,
        error: "Comment not found"
      }, { status: 404 })
    }

    allComments[projectId] = newComments
    saveComments(allComments)

    return NextResponse.json({
      success: true,
      deleted: commentId
    })
  } catch (error) {
    console.error("[comments] DELETE error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete comment"
    }, { status: 500 })
  }
}
