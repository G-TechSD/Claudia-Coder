/**
 * Costs API
 *
 * Provides access to cost data stored server-side from Claude Code executions.
 * Costs are tracked per project, per session, and aggregated for display.
 */

import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs/promises"

// Path to stored costs (same as in MCP server)
const COSTS_FILE = "/home/bill/projects/claudia-admin/.local-storage/costs.json"

/**
 * Cost entry format from MCP server
 */
interface CostEntry {
  id: string
  sessionId: string
  projectId?: string
  projectName?: string
  packetId?: string
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  cost: number
  timestamp: string
  description: string
}

interface CostsData {
  entries: CostEntry[]
  lastUpdated: string
}

/**
 * Aggregated daily spend for dashboard
 */
interface DailySpend {
  date: string
  api: number
  compute: number
  storage: number
  other: number
  total: number
  entries: number
  inputTokens: number
  outputTokens: number
}

/**
 * Project cost summary
 */
interface ProjectCostSummary {
  projectId: string
  projectName: string
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
  sessionCount: number
  entryCount: number
  lastActivity: string
}

/**
 * Session cost summary
 */
interface SessionCostSummary {
  sessionId: string
  projectId?: string
  projectName?: string
  totalCost: number
  totalInputTokens: number
  totalOutputTokens: number
  entryCount: number
  startTime: string
  endTime: string
  models: string[]
}

/**
 * GET /api/costs
 *
 * Returns cost data from server-side storage.
 *
 * Query parameters:
 * - view: "daily" | "entries" | "projects" | "sessions" (default: "daily")
 * - limit: Maximum number of items to return (default: 50, max: 500)
 * - projectId: Filter by project ID
 * - sessionId: Filter by session ID
 * - startDate: Filter entries from this date (ISO string)
 * - endDate: Filter entries until this date (ISO string)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const view = searchParams.get("view") || "daily"
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 500)
    const projectId = searchParams.get("projectId")
    const sessionId = searchParams.get("sessionId")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")

    // Read costs from file
    let costsData: CostsData = { entries: [], lastUpdated: new Date().toISOString() }
    try {
      const data = await fs.readFile(COSTS_FILE, "utf-8")
      costsData = JSON.parse(data)
    } catch (error) {
      // File doesn't exist or is invalid - return empty data
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.error("[costs] Failed to read costs file:", error)
      }
      return NextResponse.json({
        entries: [],
        dailySpend: [],
        projects: [],
        sessions: [],
        totals: {
          cost: 0,
          inputTokens: 0,
          outputTokens: 0,
          entries: 0
        }
      })
    }

    let entries = costsData.entries

    // Apply filters
    if (projectId) {
      entries = entries.filter(e => e.projectId === projectId)
    }
    if (sessionId) {
      entries = entries.filter(e => e.sessionId === sessionId)
    }
    if (startDate) {
      const start = new Date(startDate)
      entries = entries.filter(e => new Date(e.timestamp) >= start)
    }
    if (endDate) {
      const end = new Date(endDate)
      entries = entries.filter(e => new Date(e.timestamp) <= end)
    }

    // Calculate totals
    const totals = {
      cost: entries.reduce((sum, e) => sum + e.cost, 0),
      inputTokens: entries.reduce((sum, e) => sum + e.inputTokens, 0),
      outputTokens: entries.reduce((sum, e) => sum + e.outputTokens, 0),
      entries: entries.length
    }

    // Generate view-specific data
    const result: Record<string, unknown> = { totals }

    if (view === "daily" || view === "entries") {
      // Aggregate by day
      const dailyMap = new Map<string, DailySpend>()

      for (const entry of entries) {
        const date = entry.timestamp.split("T")[0]
        const existing = dailyMap.get(date) || {
          date,
          api: 0,
          compute: 0,
          storage: 0,
          other: 0,
          total: 0,
          entries: 0,
          inputTokens: 0,
          outputTokens: 0
        }

        // All Claude Code costs go to "api" category
        existing.api += entry.cost
        existing.total += entry.cost
        existing.entries += 1
        existing.inputTokens += entry.inputTokens
        existing.outputTokens += entry.outputTokens

        dailyMap.set(date, existing)
      }

      // Convert to array and sort by date
      const dailySpend = Array.from(dailyMap.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-limit)

      result.dailySpend = dailySpend

      if (view === "entries") {
        // Sort entries by timestamp descending and limit
        const sortedEntries = [...entries]
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, limit)
        result.entries = sortedEntries
      }
    }

    if (view === "projects") {
      // Aggregate by project
      const projectMap = new Map<string, ProjectCostSummary>()

      for (const entry of entries) {
        if (!entry.projectId) continue

        const existing = projectMap.get(entry.projectId) || {
          projectId: entry.projectId,
          projectName: entry.projectName || "Unknown Project",
          totalCost: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          sessionCount: 0,
          entryCount: 0,
          lastActivity: entry.timestamp
        }

        existing.totalCost += entry.cost
        existing.totalInputTokens += entry.inputTokens
        existing.totalOutputTokens += entry.outputTokens
        existing.entryCount += 1
        if (entry.timestamp > existing.lastActivity) {
          existing.lastActivity = entry.timestamp
        }

        projectMap.set(entry.projectId, existing)
      }

      // Count unique sessions per project
      for (const [projectId, summary] of projectMap) {
        const sessions = new Set(
          entries.filter(e => e.projectId === projectId).map(e => e.sessionId)
        )
        summary.sessionCount = sessions.size
      }

      const projects = Array.from(projectMap.values())
        .sort((a, b) => b.totalCost - a.totalCost)
        .slice(0, limit)

      result.projects = projects
    }

    if (view === "sessions") {
      // Aggregate by session
      const sessionMap = new Map<string, SessionCostSummary>()

      for (const entry of entries) {
        const existing = sessionMap.get(entry.sessionId) || {
          sessionId: entry.sessionId,
          projectId: entry.projectId,
          projectName: entry.projectName,
          totalCost: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          entryCount: 0,
          startTime: entry.timestamp,
          endTime: entry.timestamp,
          models: []
        }

        existing.totalCost += entry.cost
        existing.totalInputTokens += entry.inputTokens
        existing.totalOutputTokens += entry.outputTokens
        existing.entryCount += 1
        if (entry.timestamp < existing.startTime) {
          existing.startTime = entry.timestamp
        }
        if (entry.timestamp > existing.endTime) {
          existing.endTime = entry.timestamp
        }
        if (!existing.models.includes(entry.model)) {
          existing.models.push(entry.model)
        }

        sessionMap.set(entry.sessionId, existing)
      }

      const sessions = Array.from(sessionMap.values())
        .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
        .slice(0, limit)

      result.sessions = sessions
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[costs] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch cost data" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/costs
 *
 * Add a new cost entry (for manual additions or API-based tracking).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      sessionId,
      projectId,
      projectName,
      packetId,
      model,
      provider,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      cost,
      description
    } = body

    if (!sessionId || !model || !provider || inputTokens === undefined || outputTokens === undefined || cost === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: sessionId, model, provider, inputTokens, outputTokens, cost" },
        { status: 400 }
      )
    }

    // Read existing costs
    let costsData: CostsData = { entries: [], lastUpdated: new Date().toISOString() }
    try {
      const data = await fs.readFile(COSTS_FILE, "utf-8")
      costsData = JSON.parse(data)
    } catch {
      // File doesn't exist, start fresh
    }

    // Create new entry
    const entry: CostEntry = {
      id: `cost-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      sessionId,
      projectId,
      projectName,
      packetId,
      model,
      provider,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheWriteTokens,
      cost,
      timestamp: new Date().toISOString(),
      description: description || "Manual entry"
    }

    costsData.entries.push(entry)
    costsData.lastUpdated = new Date().toISOString()

    // Write back
    await fs.writeFile(COSTS_FILE, JSON.stringify(costsData, null, 2), "utf-8")

    return NextResponse.json({
      success: true,
      entry
    })
  } catch (error) {
    console.error("[costs] Failed to add cost entry:", error)
    return NextResponse.json(
      { error: "Failed to add cost entry" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/costs
 *
 * Clear all cost data (with optional filters).
 * Query parameters:
 * - projectId: Only clear costs for this project
 * - sessionId: Only clear costs for this session
 * - beforeDate: Clear entries before this date
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")
    const sessionId = searchParams.get("sessionId")
    const beforeDate = searchParams.get("beforeDate")

    // Read existing costs
    let costsData: CostsData = { entries: [], lastUpdated: new Date().toISOString() }
    try {
      const data = await fs.readFile(COSTS_FILE, "utf-8")
      costsData = JSON.parse(data)
    } catch {
      return NextResponse.json({ success: true, message: "No costs to clear" })
    }

    const originalCount = costsData.entries.length

    // Apply filters to determine what to keep
    if (projectId || sessionId || beforeDate) {
      costsData.entries = costsData.entries.filter(entry => {
        if (projectId && entry.projectId === projectId) return false
        if (sessionId && entry.sessionId === sessionId) return false
        if (beforeDate && new Date(entry.timestamp) < new Date(beforeDate)) return false
        return true
      })
    } else {
      // Clear all
      costsData.entries = []
    }

    costsData.lastUpdated = new Date().toISOString()
    await fs.writeFile(COSTS_FILE, JSON.stringify(costsData, null, 2), "utf-8")

    const deletedCount = originalCount - costsData.entries.length

    return NextResponse.json({
      success: true,
      message: `Cleared ${deletedCount} cost entries`,
      remainingEntries: costsData.entries.length
    })
  } catch (error) {
    console.error("[costs] Failed to clear costs:", error)
    return NextResponse.json(
      { error: "Failed to clear cost data" },
      { status: 500 }
    )
  }
}
