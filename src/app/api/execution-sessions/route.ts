/**
 * Execution Sessions API
 *
 * Manages execution sessions for tracking packet execution progress.
 *
 * GET - Get active execution session for a project
 *   Query params: projectId (required)
 *   Returns the active session if one exists, or null
 *
 * POST - Create a new execution session
 *   Body: { projectId, packetIds, userId, projectName?, packetTitles?, mode? }
 *   Returns the new session
 *
 * PATCH - Update an execution session
 *   Body: { sessionId, updates } where updates can include progress, events, status, etc.
 *   Returns updated session
 *
 * DELETE - Complete/cancel an execution session
 *   Query param: sessionId
 *   Marks session as complete or cancelled
 */

import { NextRequest, NextResponse } from "next/server"
import { verifyApiAuth, unauthorizedResponse } from "@/lib/auth/api-helpers"
import {
  createExecutionSession,
  getActiveExecutionForProject,
  getExecutionSession,
  updateExecutionSession,
  addExecutionEvent,
  completeExecutionSession,
  deleteExecutionSession,
  getExecutionHistory,
  type ExecutionSession,
  type ExecutionEvent,
  type QualityGateResults,
} from "@/lib/data/execution-sessions"

/**
 * GET /api/execution-sessions
 *
 * Get active execution session for a project, or fetch a specific session by ID.
 *
 * Query params:
 *   - projectId: Get active session for this project
 *   - sessionId: Get a specific session by ID
 *   - history: If "true" and projectId is provided, returns execution history
 *   - limit: Limit for history results (default: 20)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyApiAuth()
    if (!auth) {
      return unauthorizedResponse()
    }

    const searchParams = request.nextUrl.searchParams
    const projectId = searchParams.get("projectId")
    const sessionId = searchParams.get("sessionId")
    const history = searchParams.get("history") === "true"
    const limit = parseInt(searchParams.get("limit") || "20", 10)

    // If sessionId is provided, fetch that specific session
    if (sessionId) {
      const session = await getExecutionSession(sessionId)

      if (!session) {
        return NextResponse.json({
          success: false,
          error: "Session not found",
          session: null
        }, { status: 404 })
      }

      return NextResponse.json({
        success: true,
        session
      })
    }

    // If projectId is provided, fetch active session or history
    if (projectId) {
      if (history) {
        const sessions = await getExecutionHistory(projectId, limit)
        return NextResponse.json({
          success: true,
          sessions,
          count: sessions.length
        })
      }

      const session = await getActiveExecutionForProject(projectId)

      return NextResponse.json({
        success: true,
        session // Will be null if no active session
      })
    }

    // No parameters provided
    return NextResponse.json({
      success: false,
      error: "Either projectId or sessionId is required"
    }, { status: 400 })

  } catch (error) {
    console.error("[execution-sessions API] GET error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get execution session"
    }, { status: 500 })
  }
}

/**
 * POST /api/execution-sessions
 *
 * Create a new execution session.
 *
 * Body:
 *   - projectId: The project ID (required)
 *   - packetIds: Array of packet IDs to execute (required)
 *   - userId: The user initiating execution (required)
 *   - projectName: Optional project name for display
 *   - packetTitles: Optional array of packet titles for display
 *   - mode: Optional execution mode (e.g., "local", "remote", "hybrid")
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyApiAuth()
    if (!auth) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { projectId, packetIds, userId, projectName, packetTitles, mode } = body

    // Validate required fields
    if (!projectId) {
      return NextResponse.json({
        success: false,
        error: "projectId is required"
      }, { status: 400 })
    }

    if (!packetIds || !Array.isArray(packetIds) || packetIds.length === 0) {
      return NextResponse.json({
        success: false,
        error: "packetIds must be a non-empty array"
      }, { status: 400 })
    }

    // Use authenticated user ID if not provided
    const effectiveUserId = userId || auth.user.id

    // Create the session
    const session = await createExecutionSession(projectId, packetIds, effectiveUserId, {
      projectName,
      packetTitles,
      mode
    })

    return NextResponse.json({
      success: true,
      session
    }, { status: 201 })

  } catch (error) {
    console.error("[execution-sessions API] POST error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create execution session"
    }, { status: 500 })
  }
}

/**
 * PATCH /api/execution-sessions
 *
 * Update an execution session with progress, events, or status changes.
 *
 * Body:
 *   - sessionId: The session ID to update (required)
 *   - updates: Object containing updates to apply
 *     - status: New status ("running" | "complete" | "error" | "cancelled")
 *     - progress: Progress percentage (0-100)
 *     - currentPacketIndex: Index of currently executing packet
 *     - error: Error message if status is "error"
 *     - qualityGates: Quality gate results
 *     - output: Final output/summary
 *   - event: Optional event to add to the session
 *     - type: Event type ("info" | "success" | "error" | "warning" | "progress")
 *     - message: Event message
 *     - detail: Optional detail
 */
export async function PATCH(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyApiAuth()
    if (!auth) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { sessionId, updates, event } = body

    // Validate session ID
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: "sessionId is required"
      }, { status: 400 })
    }

    // Check if session exists
    const existingSession = await getExecutionSession(sessionId)
    if (!existingSession) {
      return NextResponse.json({
        success: false,
        error: "Session not found"
      }, { status: 404 })
    }

    let updatedSession: ExecutionSession | null = existingSession

    // Add event if provided
    if (event) {
      const eventData: Omit<ExecutionEvent, "id" | "timestamp"> = {
        type: event.type || "info",
        message: event.message || "Update",
        detail: event.detail
      }
      updatedSession = await addExecutionEvent(sessionId, eventData)
    }

    // Apply updates if provided
    if (updates && Object.keys(updates).length > 0) {
      // Filter to allowed update fields
      const allowedUpdates: Partial<Pick<ExecutionSession,
        "status" | "progress" | "currentPacketIndex" | "error" | "qualityGates" | "output"
      >> = {}

      if (updates.status !== undefined) {
        allowedUpdates.status = updates.status
      }
      if (updates.progress !== undefined) {
        allowedUpdates.progress = Math.max(0, Math.min(100, updates.progress))
      }
      if (updates.currentPacketIndex !== undefined) {
        allowedUpdates.currentPacketIndex = updates.currentPacketIndex
      }
      if (updates.error !== undefined) {
        allowedUpdates.error = updates.error
      }
      if (updates.qualityGates !== undefined) {
        allowedUpdates.qualityGates = updates.qualityGates as QualityGateResults
      }
      if (updates.output !== undefined) {
        allowedUpdates.output = updates.output
      }

      if (Object.keys(allowedUpdates).length > 0) {
        updatedSession = await updateExecutionSession(sessionId, allowedUpdates)
      }
    }

    if (!updatedSession) {
      return NextResponse.json({
        success: false,
        error: "Failed to update session"
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      session: updatedSession
    })

  } catch (error) {
    console.error("[execution-sessions API] PATCH error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update execution session"
    }, { status: 500 })
  }
}

/**
 * DELETE /api/execution-sessions
 *
 * Complete, cancel, or delete an execution session.
 *
 * Query params:
 *   - sessionId: The session ID (required)
 *   - action: "complete" | "cancel" | "delete" (default: "complete")
 *   - error: Error message if completing with error status
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify authentication
    const auth = await verifyApiAuth()
    if (!auth) {
      return unauthorizedResponse()
    }

    const searchParams = request.nextUrl.searchParams
    const sessionId = searchParams.get("sessionId")
    const action = searchParams.get("action") || "complete"
    const error = searchParams.get("error")

    // Validate session ID
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: "sessionId is required"
      }, { status: 400 })
    }

    // Check if session exists
    const existingSession = await getExecutionSession(sessionId)
    if (!existingSession) {
      return NextResponse.json({
        success: false,
        error: "Session not found"
      }, { status: 404 })
    }

    // Handle different actions
    switch (action) {
      case "delete": {
        // Permanently delete the session
        const deleted = await deleteExecutionSession(sessionId)
        return NextResponse.json({
          success: deleted,
          deleted: sessionId
        })
      }

      case "cancel": {
        // Mark session as cancelled
        const updatedSession = await completeExecutionSession(sessionId, {
          status: "cancelled",
          error: error || "Execution cancelled by user"
        })
        return NextResponse.json({
          success: true,
          session: updatedSession
        })
      }

      case "complete":
      default: {
        // Mark session as complete (or error if error message provided)
        const status = error ? "error" : "complete"
        const updatedSession = await completeExecutionSession(sessionId, {
          status,
          error: error || undefined
        })
        return NextResponse.json({
          success: true,
          session: updatedSession
        })
      }
    }

  } catch (error) {
    console.error("[execution-sessions API] DELETE error:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to complete/delete execution session"
    }, { status: 500 })
  }
}
