/**
 * Activity Events API
 *
 * Provides access to activity events stored server-side.
 * This allows activity to show up even when executions happen via curl/API calls
 * (which don't have access to browser localStorage).
 */

import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs/promises"

// Path to stored activity events (same as in claude-execute)
const ACTIVITY_EVENTS_FILE = "/home/bill/projects/claudia-admin/.local-storage/activity-events.json"

/**
 * Activity event format (matches what activity-preview expects)
 */
interface StoredActivityEvent {
  id: string
  type: "success" | "error" | "pending" | "running"
  message: string
  timestamp: string
  projectId?: string
  projectName?: string
  packetId?: string
  packetTitle?: string
  mode?: string
  detail?: string
}

/**
 * GET /api/activity-events
 *
 * Returns activity events from the server-side storage.
 *
 * Query parameters:
 * - limit: Maximum number of events to return (default: 50, max: 100)
 * - projectId: Filter events by project ID
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100)
    const projectId = searchParams.get("projectId")

    // Read events from file
    let events: StoredActivityEvent[] = []
    try {
      const data = await fs.readFile(ACTIVITY_EVENTS_FILE, "utf-8")
      events = JSON.parse(data)
    } catch (error) {
      // File doesn't exist or is invalid - return empty array
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("[activity-events] Failed to read events file:", error)
      }
      return NextResponse.json({
        events: [],
        total: 0
      })
    }

    // Filter by projectId if provided
    if (projectId) {
      events = events.filter(e => e.projectId === projectId)
    }

    // Sort by timestamp descending (most recent first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Apply limit
    const limitedEvents = events.slice(0, limit)

    return NextResponse.json({
      events: limitedEvents,
      total: events.length
    })
  } catch (error) {
    console.error("[activity-events] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch activity events" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/activity-events
 *
 * Clears all activity events.
 * Useful for resetting the activity history.
 */
export async function DELETE() {
  try {
    await fs.writeFile(ACTIVITY_EVENTS_FILE, "[]", "utf-8")
    return NextResponse.json({ success: true, message: "Activity events cleared" })
  } catch (error) {
    console.error("[activity-events] Failed to clear events:", error)
    return NextResponse.json(
      { error: "Failed to clear activity events" },
      { status: 500 }
    )
  }
}
