/**
 * Session Tracking API
 * POST - Record new session/events (using rrweb for full replay)
 * GET - List all sessions (admin only)
 *
 * Features:
 * - Full DOM recording via rrweb events
 * - Custom event tracking (navigation, errors, API calls)
 * - Session replay capability
 * - Analytics and metrics
 */

import { NextResponse, NextRequest } from "next/server"
import { withAuth, AuthenticatedRequest, verifyApiAuth, unauthorizedResponse, forbiddenResponse } from "@/lib/auth/api-helpers"
import {
  createSession,
  addSessionEvents,
  endSession,
  getSessions,
  getSessionsByUser,
  getSessionStats,
  generateSessionId,
  SessionEvent,
} from "@/lib/data/sessions"
import type { CustomSessionEvent, RRWebEvent } from "@/lib/session-tracking/types"

/**
 * POST /api/session-tracking
 * Record session events or create new session
 *
 * Actions:
 * - "start": Initialize a new recording session
 * - "events": Add rrweb events and custom events to session
 * - "end": Complete the session recording
 */
export const POST = withAuth(async (auth: AuthenticatedRequest, request: NextRequest) => {
  try {
    const body = await request.json()
    const { action, sessionId, events, customEvents, metadata, pagesVisited } = body

    switch (action) {
      case "start": {
        // Create a new session
        const id = sessionId || generateSessionId()

        // Parse device type from user agent
        const userAgent = metadata?.userAgent || ""
        let deviceType = "desktop"
        if (userAgent.includes("Mobile") || (userAgent.includes("Android") && !userAgent.includes("Tablet"))) {
          deviceType = "mobile"
        } else if (userAgent.includes("Tablet") || userAgent.includes("iPad")) {
          deviceType = "tablet"
        }

        // Parse browser from user agent
        let browser = "Unknown"
        if (userAgent.includes("Firefox/")) browser = "Firefox"
        else if (userAgent.includes("Edg/")) browser = "Edge"
        else if (userAgent.includes("Chrome/")) browser = "Chrome"
        else if (userAgent.includes("Safari/") && !userAgent.includes("Chrome")) browser = "Safari"

        // Parse OS from user agent
        let os = "Unknown"
        if (userAgent.includes("Windows NT")) os = "Windows"
        else if (userAgent.includes("Mac OS X")) os = "macOS"
        else if (userAgent.includes("Linux")) os = "Linux"
        else if (userAgent.includes("Android")) os = "Android"
        else if (userAgent.includes("iOS") || userAgent.includes("iPhone") || userAgent.includes("iPad")) os = "iOS"

        const session = createSession({
          id,
          userId: auth.user.id,
          userAgent: metadata?.userAgent,
          deviceType,
          browser,
          os,
          screenWidth: metadata?.screenWidth,
          screenHeight: metadata?.screenHeight,
        })

        if (!session) {
          return NextResponse.json(
            { success: false, error: "Failed to create session" },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          sessionId: session.id,
        })
      }

      case "events": {
        // Add events to existing session
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: "Session ID required" },
            { status: 400 }
          )
        }

        // Process rrweb events
        const rrwebEvents: SessionEvent[] = (events || []).map((event: RRWebEvent) => ({
          type: event.type,
          data: event.data,
          timestamp: event.timestamp,
        }))

        // Process custom events and convert them to rrweb custom event format
        // Custom events are stored with type 5 (Custom) in rrweb
        const customEventsMapped: SessionEvent[] = (customEvents || []).map((event: CustomSessionEvent) => ({
          type: 5, // rrweb Custom event type
          data: {
            tag: "custom-event",
            payload: event,
          },
          timestamp: event.timestamp,
        }))

        // Combine all events
        const allEvents = [...rrwebEvents, ...customEventsMapped]

        if (allEvents.length === 0) {
          return NextResponse.json({ success: true, message: "No events to add" })
        }

        const success = addSessionEvents(sessionId, allEvents)

        if (!success) {
          return NextResponse.json(
            { success: false, error: "Failed to add events" },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          eventsAdded: allEvents.length,
        })
      }

      case "end": {
        // End the session
        if (!sessionId) {
          return NextResponse.json(
            { success: false, error: "Session ID required" },
            { status: 400 }
          )
        }

        const success = endSession(sessionId, pagesVisited)

        if (!success) {
          return NextResponse.json(
            { success: false, error: "Failed to end session" },
            { status: 500 }
          )
        }

        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json(
          { success: false, error: "Invalid action" },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error("[Session Tracking] Error:", error)
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
})

/**
 * GET /api/session-tracking
 * List all sessions (admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin role
    const auth = await verifyApiAuth()
    if (!auth) {
      return unauthorizedResponse()
    }
    if (auth.user.role !== "admin") {
      return forbiddenResponse("Requires admin role")
    }

    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get("userId") || undefined
    const startDate = searchParams.get("startDate") || undefined
    const endDate = searchParams.get("endDate") || undefined
    const search = searchParams.get("search") || undefined
    const groupBy = searchParams.get("groupBy")
    const limit = parseInt(searchParams.get("limit") || "50", 10)
    const offset = parseInt(searchParams.get("offset") || "0", 10)

    // Get grouped by user if requested
    if (groupBy === "user") {
      const userSessions = getSessionsByUser()
      const stats = getSessionStats()

      return NextResponse.json({
        success: true,
        groupedSessions: userSessions,
        stats,
      })
    }

    // Get sessions with optional filtering
    const { sessions, total } = getSessions({
      userId,
      startDate,
      endDate,
      search,
      limit,
      offset,
    })

    const stats = getSessionStats()

    return NextResponse.json({
      success: true,
      sessions,
      total,
      stats,
      pagination: {
        limit,
        offset,
        hasMore: offset + sessions.length < total,
      },
    })
  } catch (error) {
    console.error("[Session Tracking] List error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to list sessions" },
      { status: 500 }
    )
  }
}
