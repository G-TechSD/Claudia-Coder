/**
 * Session Tracking API - Single Session
 * GET - Get session data with events (admin only)
 * DELETE - Delete a session (admin only)
 */

import { NextResponse, NextRequest } from "next/server"
import { verifyApiAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/api-helpers"
import {
  getSessionById,
  getSessionWithEvents,
  deleteSession,
} from "@/lib/data/sessions"

interface RouteContext {
  params: Promise<{ sessionId: string }>
}

/**
 * GET /api/session-tracking/[sessionId]
 * Get a specific session with all events for replay
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    // Verify admin role
    const auth = await verifyApiAuth()
    if (!auth) {
      return unauthorizedResponse()
    }
    if (auth.user.role !== "admin") {
      return forbiddenResponse("Requires admin role")
    }

    const { sessionId } = await context.params
    const searchParams = request.nextUrl.searchParams
    const includeEvents = searchParams.get("includeEvents") !== "false"

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Session ID required" },
        { status: 400 }
      )
    }

    if (includeEvents) {
      const session = getSessionWithEvents(sessionId)

      if (!session) {
        return NextResponse.json(
          { success: false, error: "Session not found" },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        session,
      })
    } else {
      const session = getSessionById(sessionId)

      if (!session) {
        return NextResponse.json(
          { success: false, error: "Session not found" },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        session,
      })
    }
  } catch (error) {
    console.error("[Session Tracking] Get session error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to get session" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/session-tracking/[sessionId]
 * Delete a session and all its events
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  try {
    // Verify admin role
    const auth = await verifyApiAuth()
    if (!auth) {
      return unauthorizedResponse()
    }
    if (auth.user.role !== "admin") {
      return forbiddenResponse("Requires admin role")
    }

    const { sessionId } = await context.params

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "Session ID required" },
        { status: 400 }
      )
    }

    const session = getSessionById(sessionId)

    if (!session) {
      return NextResponse.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      )
    }

    const success = deleteSession(sessionId)

    if (!success) {
      return NextResponse.json(
        { success: false, error: "Failed to delete session" },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Session deleted successfully",
    })
  } catch (error) {
    console.error("[Session Tracking] Delete session error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete session" },
      { status: 500 }
    )
  }
}
