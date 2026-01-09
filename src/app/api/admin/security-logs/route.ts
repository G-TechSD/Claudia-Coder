/**
 * Security Logs API
 *
 * Provides access to prompt injection and security activity logs.
 * Only accessible by admin users.
 *
 * GET - List security events with filtering
 * DELETE - Clear old events
 */

import { NextRequest, NextResponse } from "next/server"
import { withRole } from "@/lib/auth/api-helpers"
import {
  getSecurityEvents as getSecurityActivityEvents,
  getSecurityStats,
  clearOldEvents,
  exportEvents,
} from "@/lib/security/activity-log"
import { getAllSecurityEvents as getSandboxEvents } from "@/lib/security/sandbox"
import type { SecurityEventType, SecuritySeverity } from "@/lib/security/activity-log"

/**
 * GET /api/admin/security-logs
 * List security events with optional filtering
 */
export const GET = withRole("admin")(async (auth, request) => {
  try {
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 1000)
    const type = searchParams.get("type") as SecurityEventType | null
    const userId = searchParams.get("userId")
    const severity = searchParams.get("severity") as SecuritySeverity | null
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const format = searchParams.get("format") || "json"
    const includeStats = searchParams.get("includeStats") !== "false"
    const source = searchParams.get("source") || "all" // "activity", "sandbox", or "all"

    // Build filter options
    const filterOptions = {
      limit,
      type: type || undefined,
      userId: userId || undefined,
      severity: severity || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }

    // Get events from the appropriate source
    interface MergedEvent {
      id?: string
      timestamp: string
      userId: string
      type?: string
      eventType?: string
      severity?: string
      details: unknown
      source: string
    }

    let events: MergedEvent[] = []

    if (source === "activity" || source === "all") {
      const activityEvents = getSecurityActivityEvents(filterOptions)
      events = events.concat(activityEvents.map(e => ({
        ...e,
        source: "activity_log"
      })))
    }

    if (source === "sandbox" || source === "all") {
      const sandboxEvents = getSandboxEvents(limit)
      // Filter sandbox events if needed
      let filteredSandbox = sandboxEvents
      if (userId) {
        filteredSandbox = filteredSandbox.filter(e => e.userId === userId)
      }
      if (startDate) {
        filteredSandbox = filteredSandbox.filter(e => e.timestamp >= startDate)
      }
      if (endDate) {
        filteredSandbox = filteredSandbox.filter(e => e.timestamp <= endDate)
      }
      events = events.concat(filteredSandbox.map((e: { eventType?: string; userId: string; timestamp: string; details: unknown }) => ({
        ...e,
        type: e.eventType, // Normalize field name
        source: "sandbox"
      })))
    }

    // Sort by timestamp descending (most recent first)
    events.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )

    // Apply limit after combining
    events = events.slice(0, limit)

    // Export in different formats
    if (format === "csv") {
      const csvContent = exportEvents({
        format: "csv",
        startDate: startDate || undefined,
        endDate: endDate || undefined
      })
      return new Response(csvContent, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="security-logs-${new Date().toISOString().split("T")[0]}.csv"`
        }
      })
    }

    // Build response
    const response: {
      success: boolean
      events: MergedEvent[]
      count: number
      stats?: ReturnType<typeof getSecurityStats>
    } = {
      success: true,
      events,
      count: events.length
    }

    // Include statistics if requested
    if (includeStats) {
      response.stats = getSecurityStats({
        startDate: startDate || undefined,
        endDate: endDate || undefined
      })
    }

    return NextResponse.json(response)

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch security logs"
    console.error("[security-logs] GET error:", message)

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
})

/**
 * DELETE /api/admin/security-logs
 * Clear old security events (admin maintenance)
 */
export const DELETE = withRole("admin")(async (auth, request) => {
  try {
    const { searchParams } = new URL(request.url)
    const olderThanDays = parseInt(searchParams.get("olderThanDays") || "30", 10)

    // Validate
    if (olderThanDays < 1 || olderThanDays > 365) {
      return NextResponse.json(
        { success: false, error: "olderThanDays must be between 1 and 365" },
        { status: 400 }
      )
    }

    const removed = clearOldEvents(olderThanDays)

    console.log(`[security-logs] Admin ${auth.user.id} cleared ${removed} events older than ${olderThanDays} days`)

    return NextResponse.json({
      success: true,
      removed,
      message: `Cleared ${removed} events older than ${olderThanDays} days`
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to clear security logs"
    console.error("[security-logs] DELETE error:", message)

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
})
