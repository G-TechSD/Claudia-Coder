/**
 * Activity Events API
 *
 * Provides access to activity events stored server-side.
 * This allows activity to show up even when executions happen via curl/API calls
 * (which don't have access to browser localStorage).
 *
 * SAFETY FEATURES:
 * - Creates backup before destructive operations
 * - Validates data before writing
 * - Refuses to accidentally clear data without confirmation
 * - Supports atomic writes via temp file
 */

import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs/promises"
import * as path from "path"

// Path to stored activity events (same as in claude-execute)
const ACTIVITY_EVENTS_FILE = path.join(process.cwd(), ".local-storage", "activity-events.json")
const ACTIVITY_EVENTS_BACKUP_FILE = path.join(process.cwd(), ".local-storage", "activity-events.backup.json")
const ACTIVITY_EVENTS_ARCHIVE_DIR = path.join(process.cwd(), ".local-storage", "activity-archives")

// Maximum number of events to keep (increased from 100 to prevent data loss)
const MAX_STORED_EVENTS = 1000

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
 * Read events from file with error handling
 */
async function readEventsFile(): Promise<StoredActivityEvent[]> {
  try {
    const data = await fs.readFile(ACTIVITY_EVENTS_FILE, "utf-8")
    const parsed = JSON.parse(data)
    if (Array.isArray(parsed)) {
      return parsed
    }
    console.warn("[activity-events] File contained non-array data")
    return []
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === "ENOENT") {
      return []
    }
    console.error("[activity-events] Failed to read events file:", error)
    throw error
  }
}

/**
 * Write events to file with safety features (atomic write)
 */
async function writeEventsFile(events: StoredActivityEvent[]): Promise<void> {
  // Ensure directory exists
  await fs.mkdir(path.dirname(ACTIVITY_EVENTS_FILE), { recursive: true })

  // Write to temp file first
  const tempFile = ACTIVITY_EVENTS_FILE + ".tmp"
  const jsonContent = JSON.stringify(events, null, 2)

  // Validate JSON before writing
  JSON.parse(jsonContent) // Will throw if invalid

  await fs.writeFile(tempFile, jsonContent, "utf-8")
  await fs.rename(tempFile, ACTIVITY_EVENTS_FILE)
}

/**
 * Create backup of current events
 */
async function createBackup(): Promise<number> {
  try {
    const events = await readEventsFile()
    if (events.length > 0) {
      await fs.copyFile(ACTIVITY_EVENTS_FILE, ACTIVITY_EVENTS_BACKUP_FILE)
    }
    return events.length
  } catch {
    return 0
  }
}

/**
 * GET /api/activity-events
 *
 * Returns activity events from the server-side storage.
 *
 * Query parameters:
 * - limit: Maximum number of events to return (default: 100, max: 1000)
 * - offset: Number of events to skip (for pagination)
 * - projectId: Filter events by project ID
 * - type: Filter by event type (success, error, pending, running)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get("limit") || "100"), 1000)
    const offset = parseInt(searchParams.get("offset") || "0")
    const projectId = searchParams.get("projectId")
    const type = searchParams.get("type")

    // Read events from file
    let events = await readEventsFile()

    // Filter by projectId if provided
    if (projectId) {
      events = events.filter(e => e.projectId === projectId)
    }

    // Filter by type if provided
    if (type) {
      events = events.filter(e => e.type === type)
    }

    // Sort by timestamp descending (most recent first)
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Apply pagination
    const total = events.length
    const paginatedEvents = events.slice(offset, offset + limit)

    return NextResponse.json({
      events: paginatedEvents,
      total,
      limit,
      offset,
      hasMore: offset + paginatedEvents.length < total
    })
  } catch (error) {
    console.error("[activity-events] GET error:", error)
    return NextResponse.json(
      { error: "Failed to fetch activity events", events: [], total: 0 },
      { status: 500 }
    )
  }
}

/**
 * POST /api/activity-events
 *
 * Add a new activity event.
 *
 * Body:
 * - type: "success" | "error" | "pending" | "running"
 * - message: Event message
 * - projectId?: Project ID
 * - projectName?: Project name
 * - packetId?: Packet ID
 * - packetTitle?: Packet title
 * - mode?: Execution mode
 * - detail?: Additional details
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, message, projectId, projectName, packetId, packetTitle, mode, detail } = body

    // Validate required fields
    if (!type || !message) {
      return NextResponse.json(
        { error: "type and message are required" },
        { status: 400 }
      )
    }

    // Validate type
    if (!["success", "error", "pending", "running"].includes(type)) {
      return NextResponse.json(
        { error: "type must be one of: success, error, pending, running" },
        { status: 400 }
      )
    }

    // Read existing events
    let events = await readEventsFile()
    const existingCount = events.length

    // Create new event
    const newEvent: StoredActivityEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: type as StoredActivityEvent["type"],
      message,
      timestamp: new Date().toISOString(),
      projectId,
      projectName,
      packetId,
      packetTitle,
      mode,
      detail
    }

    // Check for duplicate events (same message and packet within last minute)
    const oneMinuteAgo = Date.now() - 60000
    const isDuplicate = events.some(e =>
      e.message === message &&
      e.packetId === packetId &&
      new Date(e.timestamp).getTime() > oneMinuteAgo
    )

    if (isDuplicate) {
      return NextResponse.json({
        success: true,
        message: "Duplicate event skipped",
        event: null,
        total: existingCount
      })
    }

    // Add event
    events.push(newEvent)

    // Trim if needed (keep most recent)
    if (events.length > MAX_STORED_EVENTS) {
      // Sort by timestamp and keep the most recent
      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      events = events.slice(0, MAX_STORED_EVENTS)
    }

    // Create backup before writing (if we have existing data)
    if (existingCount > 0) {
      await createBackup()
    }

    // Write events
    await writeEventsFile(events)

    return NextResponse.json({
      success: true,
      event: newEvent,
      total: events.length
    })
  } catch (error) {
    console.error("[activity-events] POST error:", error)
    return NextResponse.json(
      { error: "Failed to add activity event" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/activity-events
 *
 * Clears activity events with safety features.
 *
 * Query parameters:
 * - confirm: Must be "true" to actually clear events (safety check)
 * - archive: If "true", archive events before clearing instead of just deleting
 * - olderThan: Only delete events older than this ISO date string
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const confirm = searchParams.get("confirm")
    const archive = searchParams.get("archive") === "true"
    const olderThan = searchParams.get("olderThan")

    // Read current events
    const events = await readEventsFile()
    const totalEvents = events.length

    // If no confirmation, just return info about what would be deleted
    if (confirm !== "true") {
      return NextResponse.json({
        warning: "This will delete activity events. Add ?confirm=true to proceed.",
        wouldDelete: olderThan
          ? events.filter(e => new Date(e.timestamp) < new Date(olderThan)).length
          : totalEvents,
        totalEvents,
        tip: "Add ?archive=true to archive events before deleting"
      })
    }

    // If no events, nothing to do
    if (totalEvents === 0) {
      return NextResponse.json({
        success: true,
        message: "No events to clear",
        deleted: 0
      })
    }

    // Create backup before any deletion
    await createBackup()
    console.log(`[activity-events] Created backup before delete (${totalEvents} events)`)

    // Archive if requested
    if (archive) {
      await fs.mkdir(ACTIVITY_EVENTS_ARCHIVE_DIR, { recursive: true })
      const archiveFile = path.join(
        ACTIVITY_EVENTS_ARCHIVE_DIR,
        `activity-events-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
      )
      await fs.writeFile(archiveFile, JSON.stringify(events, null, 2), "utf-8")
      console.log(`[activity-events] Archived ${totalEvents} events to ${archiveFile}`)
    }

    // If olderThan is specified, only delete old events
    if (olderThan) {
      const cutoffDate = new Date(olderThan)
      const remainingEvents = events.filter(e => new Date(e.timestamp) >= cutoffDate)
      const deletedCount = totalEvents - remainingEvents.length

      await writeEventsFile(remainingEvents)

      return NextResponse.json({
        success: true,
        message: `Deleted events older than ${olderThan}`,
        deleted: deletedCount,
        remaining: remainingEvents.length,
        archived: archive
      })
    }

    // Clear all events
    await writeEventsFile([])

    return NextResponse.json({
      success: true,
      message: "Activity events cleared",
      deleted: totalEvents,
      archived: archive,
      backupLocation: ACTIVITY_EVENTS_BACKUP_FILE
    })
  } catch (error) {
    console.error("[activity-events] DELETE error:", error)
    return NextResponse.json(
      { error: "Failed to clear activity events" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/activity-events
 *
 * Restore events from backup or merge events.
 *
 * Body:
 * - action: "restore" | "merge"
 * - events?: Array of events to merge (for merge action)
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, events: newEvents } = body

    if (action === "restore") {
      // Restore from backup
      try {
        const backupData = await fs.readFile(ACTIVITY_EVENTS_BACKUP_FILE, "utf-8")
        const backupEvents = JSON.parse(backupData)

        if (!Array.isArray(backupEvents)) {
          return NextResponse.json(
            { error: "Backup file contains invalid data" },
            { status: 400 }
          )
        }

        // Create backup of current state before restoring
        await createBackup()

        // Restore
        await writeEventsFile(backupEvents)

        return NextResponse.json({
          success: true,
          message: "Restored from backup",
          restoredCount: backupEvents.length
        })
      } catch (error) {
        const err = error as NodeJS.ErrnoException
        if (err.code === "ENOENT") {
          return NextResponse.json(
            { error: "No backup file found" },
            { status: 404 }
          )
        }
        throw error
      }
    }

    if (action === "merge") {
      // Merge provided events with existing
      if (!Array.isArray(newEvents)) {
        return NextResponse.json(
          { error: "events must be an array" },
          { status: 400 }
        )
      }

      // Read existing events
      let existingEvents = await readEventsFile()

      // Create set of existing IDs for deduplication
      const existingIds = new Set(existingEvents.map(e => e.id))

      // Add new events that don't already exist
      let addedCount = 0
      for (const event of newEvents) {
        if (!existingIds.has(event.id)) {
          existingEvents.push(event)
          existingIds.add(event.id)
          addedCount++
        }
      }

      // Trim if needed
      if (existingEvents.length > MAX_STORED_EVENTS) {
        existingEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        existingEvents = existingEvents.slice(0, MAX_STORED_EVENTS)
      }

      // Create backup and write
      await createBackup()
      await writeEventsFile(existingEvents)

      return NextResponse.json({
        success: true,
        message: "Events merged",
        addedCount,
        totalCount: existingEvents.length
      })
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'restore' or 'merge'" },
      { status: 400 }
    )
  } catch (error) {
    console.error("[activity-events] PUT error:", error)
    return NextResponse.json(
      { error: "Failed to perform action" },
      { status: 500 }
    )
  }
}
