/**
 * Packets API Route
 *
 * Fetches packets from multiple sources:
 * - N8N data tables (ClaudiaCodeIssuePackets)
 * - .local-storage directory (build plan JSON files)
 *
 * GET /api/packets - List all packets (with optional filtering)
 * POST /api/packets/:id/start - Start a packet
 * POST /api/packets/:id/stop - Stop a packet
 * POST /api/packets/:id/feedback - Submit thumbs up/down feedback
 */

import { NextRequest, NextResponse } from "next/server"
import * as https from "https"
import * as fs from "fs"
import * as path from "path"

const N8N_BASE_URL = process.env.NEXT_PUBLIC_N8N_URL || "https://192.168.245.211:5678"
const N8N_API_KEY = process.env.N8N_API_KEY || ""

// Create HTTPS agent for self-signed certificates
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
})

/**
 * Fetch with self-signed cert support
 */
async function fetchWithSelfSignedCert(url: string, options: RequestInit = {}): Promise<Response> {
  if (url.startsWith("https://")) {
    return fetch(url, {
      ...options,
      // @ts-expect-error - Node.js fetch supports 'agent' option
      agent: httpsAgent,
    })
  }
  return fetch(url, options)
}

// N8N Data Table IDs from the workflow analysis
const DATA_TABLES = {
  ISSUE_PACKETS: "uY29FyKg9JFPZa9a",
  PROJECTS: "uheU5SSGQpNjVko5",
  PROJECT_PLANS: "Efxpd5kCkGHvuLFi",
  ISSUES: "xFm91lQWMMBRlnho"
}

// Packet status types
export type PacketStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled"

// Packet interface matching ClaudiaCodeIssuePackets data table
export interface N8NPacket {
  id: string
  planRunID: string
  projectID: string
  packetID: string
  issueIDs: string | string[]
  assignedWorker: string
  packetJSON: string | {
    title: string
    summary: string
    issues: Array<{ id: string; title: string; description: string }>
    acceptanceCriteria: string[]
    risks: string[]
    dependencies: string[]
  }
  status: PacketStatus
  workerOutputJSON?: string | Record<string, unknown>
  feedback?: "thumbs_up" | "thumbs_down" | null
  feedbackComment?: string
  startedAt?: string
  completedAt?: string
  createdAt?: string
  updatedAt?: string
}

// Transformed packet for frontend
export interface Packet {
  id: string
  planRunID: string
  projectID: string
  packetID: string
  title: string
  summary: string
  issueIDs: string[]
  assignedWorker: string
  status: PacketStatus
  issues: Array<{ id: string; title: string; description: string }>
  acceptanceCriteria: string[]
  risks: string[]
  dependencies: string[]
  feedback: "thumbs_up" | "thumbs_down" | null
  feedbackComment: string | null
  startedAt: string | null
  completedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  workerOutput: Record<string, unknown> | null
}

/**
 * Make authenticated request to N8N API (handles self-signed certs)
 */
async function n8nRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${N8N_BASE_URL}${endpoint}`

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(N8N_API_KEY && { "X-N8N-API-KEY": N8N_API_KEY }),
    ...options.headers
  }

  const response = await fetchWithSelfSignedCert(url, { ...options, headers })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`N8N API error: ${response.status} ${response.statusText} - ${text}`)
  }

  return response.json()
}

/**
 * Parse JSON string safely
 */
function safeParseJSON<T>(value: string | T): T | null {
  if (typeof value === "string") {
    try {
      return JSON.parse(value)
    } catch {
      return null
    }
  }
  return value as T
}

/**
 * Transform N8N packet to frontend format
 */
function transformPacket(raw: N8NPacket): Packet {
  const packetJSON = safeParseJSON(raw.packetJSON) as {
    title?: string
    summary?: string
    issues?: Array<{ id: string; title: string; description: string }>
    acceptanceCriteria?: string[]
    risks?: string[]
    dependencies?: string[]
  } | null

  const issueIDs = Array.isArray(raw.issueIDs)
    ? raw.issueIDs
    : typeof raw.issueIDs === "string"
      ? raw.issueIDs.split(",").map(s => s.trim()).filter(Boolean)
      : []

  const workerOutput = safeParseJSON(raw.workerOutputJSON)

  return {
    id: raw.id || raw.packetID,
    planRunID: raw.planRunID || "",
    projectID: raw.projectID || "",
    packetID: raw.packetID || raw.id,
    title: packetJSON?.title || `Packet ${raw.packetID}`,
    summary: packetJSON?.summary || "",
    issueIDs,
    assignedWorker: raw.assignedWorker || "worker_bee_gptoss",
    status: raw.status || "queued",
    issues: packetJSON?.issues || issueIDs.map(id => ({ id, title: id, description: "" })),
    acceptanceCriteria: packetJSON?.acceptanceCriteria || [],
    risks: packetJSON?.risks || [],
    dependencies: packetJSON?.dependencies || [],
    feedback: raw.feedback || null,
    feedbackComment: raw.feedbackComment || null,
    startedAt: raw.startedAt || null,
    completedAt: raw.completedAt || null,
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || null,
    workerOutput: workerOutput as Record<string, unknown> | null
  }
}

/**
 * Load packets from .local-storage build plan files
 * These files contain build plans with packet definitions
 */
function loadPacketsFromLocalStorage(): Packet[] {
  const packets: Packet[] = []

  try {
    // Path to .local-storage directory relative to project root
    const localStorageDir = path.join(process.cwd(), ".local-storage")

    if (!fs.existsSync(localStorageDir)) {
      return packets
    }

    // Find all build plan JSON files
    const files = fs.readdirSync(localStorageDir)
    const buildPlanFiles = files.filter(f => f.endsWith("-build-plan.json") || f.includes("build-plan"))

    for (const file of buildPlanFiles) {
      try {
        const filePath = path.join(localStorageDir, file)
        const content = fs.readFileSync(filePath, "utf-8")
        const buildPlan = JSON.parse(content)

        // Extract project info from the build plan
        const projectName = buildPlan.projectName || file.replace("-build-plan.json", "")
        const projectId = buildPlan.projectId || projectName.toLowerCase().replace(/\s+/g, "-")

        // Extract packets from build plan
        if (buildPlan.packets && Array.isArray(buildPlan.packets)) {
          for (const wp of buildPlan.packets) {
            // Map status from WorkPacket to Packet status
            let packetStatus: PacketStatus = "queued"
            if (wp.status === "completed") packetStatus = "completed"
            else if (wp.status === "in_progress" || wp.status === "assigned") packetStatus = "running"
            else if (wp.status === "blocked") packetStatus = "paused"
            else if (wp.status === "review") packetStatus = "running"
            else if (wp.status === "ready") packetStatus = "queued"

            packets.push({
              id: wp.id,
              planRunID: wp.phaseId || "",
              projectID: projectId,
              packetID: wp.id,
              title: wp.title || `Packet ${wp.id}`,
              summary: wp.description || "",
              issueIDs: [],
              assignedWorker: wp.assignedModel || "",
              status: packetStatus,
              issues: [],
              acceptanceCriteria: wp.acceptanceCriteria || [],
              risks: [],
              dependencies: wp.dependencies || [],
              feedback: null,
              feedbackComment: null,
              startedAt: null,
              completedAt: null,
              createdAt: buildPlan.createdAt || null,
              updatedAt: null,
              workerOutput: null
            })
          }
        }
      } catch (fileError) {
        console.warn(`Failed to parse build plan file ${file}:`, fileError)
      }
    }
  } catch (error) {
    console.warn("Failed to load packets from .local-storage:", error)
  }

  return packets
}

/**
 * GET /api/packets
 *
 * Fetch all packets from N8N data table and .local-storage files
 *
 * Query params:
 *   - projectID: Filter by project
 *   - planRunID: Filter by plan run
 *   - status: Filter by status
 *   - limit: Max results (default 100)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectID = searchParams.get("projectID")
  const planRunID = searchParams.get("planRunID")
  const status = searchParams.get("status")
  const limit = parseInt(searchParams.get("limit") || "100", 10)

  try {
    // Build filter conditions
    const conditions: Array<{ keyName: string; keyValue: string }> = []

    if (projectID) {
      conditions.push({ keyName: "projectID", keyValue: projectID })
    }
    if (planRunID) {
      conditions.push({ keyName: "planRunID", keyValue: planRunID })
    }
    if (status) {
      conditions.push({ keyName: "status", keyValue: status })
    }

    // Fetch from N8N data table API
    // Note: N8N's data table API might vary - using the internal API endpoint
    const endpoint = `/api/v1/data-tables/${DATA_TABLES.ISSUE_PACKETS}/rows`

    let rawPackets: N8NPacket[] = []

    try {
      const response = await n8nRequest<{ data: N8NPacket[] }>(endpoint, {
        method: "GET"
      })
      rawPackets = response.data || []
    } catch (n8nError) {
      // If N8N API fails, try the webhook approach
      console.warn("N8N data table API failed, trying webhook:", n8nError)

      try {
        const webhookResponse = await n8nRequest<{ packets: N8NPacket[] }>(
          "/webhook/get-packets",
          {
            method: "POST",
            body: JSON.stringify({
              action: "list",
              filters: { projectID, planRunID, status }
            })
          }
        )
        rawPackets = webhookResponse.packets || []
      } catch (webhookError) {
        console.warn("Webhook also failed:", webhookError)
        // Return empty array if both fail
      }
    }

    // Apply filters (in case API doesn't support filtering)
    let filteredN8NPackets = rawPackets

    if (projectID) {
      filteredN8NPackets = filteredN8NPackets.filter(p => p.projectID === projectID)
    }
    if (planRunID) {
      filteredN8NPackets = filteredN8NPackets.filter(p => p.planRunID === planRunID)
    }
    if (status) {
      filteredN8NPackets = filteredN8NPackets.filter(p => p.status === status)
    }

    // Transform N8N packets
    const n8nPackets = filteredN8NPackets.map(transformPacket)

    // Also load packets from .local-storage files
    let localStoragePackets = loadPacketsFromLocalStorage()

    // Apply same filters to local storage packets
    if (projectID) {
      localStoragePackets = localStoragePackets.filter(p => p.projectID === projectID)
    }
    if (planRunID) {
      localStoragePackets = localStoragePackets.filter(p => p.planRunID === planRunID)
    }
    if (status) {
      localStoragePackets = localStoragePackets.filter(p => p.status === status)
    }

    // Merge packets, avoiding duplicates by ID
    const seenIds = new Set(n8nPackets.map(p => p.id))
    const allPackets = [
      ...n8nPackets,
      ...localStoragePackets.filter(p => !seenIds.has(p.id))
    ]

    // Limit results
    const packets = allPackets.slice(0, limit)

    return NextResponse.json({
      success: true,
      count: packets.length,
      packets,
      sources: {
        n8n: n8nPackets.length,
        localStorage: localStoragePackets.filter(p => !seenIds.has(p.id)).length
      }
    })

  } catch (error) {
    console.error("[packets] GET error:", error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch packets",
      packets: []
    }, { status: 500 })
  }
}

/**
 * POST /api/packets
 *
 * Handle packet actions (start, stop, feedback)
 *
 * Body:
 *   - action: "start" | "stop" | "pause" | "feedback"
 *   - packetId: The packet ID
 *   - feedback?: "thumbs_up" | "thumbs_down" (for feedback action)
 *   - comment?: string (for feedback action)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, packetId, feedback, comment } = body

    if (!action || !packetId) {
      return NextResponse.json({
        success: false,
        error: "action and packetId are required"
      }, { status: 400 })
    }

    let webhookAction: string
    let data: Record<string, unknown> = {}

    switch (action) {
      case "start":
        webhookAction = "start"
        data = { status: "running", startedAt: new Date().toISOString() }
        break

      case "stop":
      case "pause":
        webhookAction = "pause"
        data = { status: "paused" }
        break

      case "cancel":
        webhookAction = "cancel"
        data = { status: "cancelled" }
        break

      case "feedback":
        if (!feedback || !["thumbs_up", "thumbs_down"].includes(feedback)) {
          return NextResponse.json({
            success: false,
            error: "feedback must be 'thumbs_up' or 'thumbs_down'"
          }, { status: 400 })
        }
        webhookAction = "feedback"
        data = { feedback, feedbackComment: comment || null }
        break

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 })
    }

    // Trigger N8N webhook for packet action
    try {
      const result = await n8nRequest<{ success: boolean; message?: string }>(
        "/webhook/packet-action",
        {
          method: "POST",
          body: JSON.stringify({
            action: webhookAction,
            target: { type: "packet", id: packetId },
            data,
            timestamp: new Date().toISOString(),
            source: "admin-panel"
          })
        }
      )

      return NextResponse.json({
        success: true,
        action,
        packetId,
        result
      })

    } catch (webhookError) {
      // If webhook fails, try direct data table update
      console.warn("Webhook failed, attempting direct update:", webhookError)

      try {
        await n8nRequest(
          `/api/v1/data-tables/${DATA_TABLES.ISSUE_PACKETS}/rows/${packetId}`,
          {
            method: "PATCH",
            body: JSON.stringify(data)
          }
        )

        return NextResponse.json({
          success: true,
          action,
          packetId,
          method: "direct-update"
        })

      } catch (updateError) {
        throw updateError
      }
    }

  } catch (error) {
    console.error("[packets] POST error:", error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to perform packet action"
    }, { status: 500 })
  }
}

/**
 * PUT /api/packets
 *
 * Update packet status and output (used by Claude Code MCP integration)
 *
 * Body:
 *   - projectId: The project ID
 *   - packetId: The packet ID
 *   - status: New status (queued, in_progress, completed, failed)
 *   - output?: Output or notes about the work done
 *   - filesChanged?: List of files modified
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { projectId, packetId, status, output, filesChanged } = body

    if (!packetId || !status) {
      return NextResponse.json({
        success: false,
        error: "packetId and status are required"
      }, { status: 400 })
    }

    // Map status to N8N format
    const statusMap: Record<string, PacketStatus> = {
      "queued": "queued",
      "in_progress": "running",
      "completed": "completed",
      "failed": "failed"
    }

    const n8nStatus = statusMap[status] || status

    const updateData: Record<string, unknown> = {
      status: n8nStatus,
      updatedAt: new Date().toISOString()
    }

    if (status === "completed") {
      updateData.completedAt = new Date().toISOString()
    }

    if (output) {
      updateData.workerOutputJSON = JSON.stringify({
        output,
        filesChanged: filesChanged || [],
        updatedAt: new Date().toISOString(),
        source: "claude-code-mcp"
      })
    }

    // Also update localStorage packets via activity event
    // This ensures the UI picks up the changes
    try {
      await fetch(`${request.nextUrl.origin}/api/activity-events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: status === "completed" ? "success" : status === "failed" ? "error" : "running",
          message: `Packet ${packetId} ${status}: ${output?.substring(0, 100) || "Updated via Claude Code"}`,
          projectId,
          detail: JSON.stringify({ packetId, status, filesChanged })
        })
      })
    } catch (e) {
      console.warn("Failed to create activity event:", e)
    }

    // Try webhook first
    try {
      const result = await n8nRequest<{ success: boolean; message?: string }>(
        "/webhook/packet-action",
        {
          method: "POST",
          body: JSON.stringify({
            action: "update",
            target: { type: "packet", id: packetId },
            data: updateData,
            timestamp: new Date().toISOString(),
            source: "claude-code-mcp"
          })
        }
      )

      return NextResponse.json({
        success: true,
        packetId,
        status,
        result
      })

    } catch (webhookError) {
      console.warn("Webhook failed, attempting direct update:", webhookError)

      // Try direct data table update
      try {
        await n8nRequest(
          `/api/v1/data-tables/${DATA_TABLES.ISSUE_PACKETS}/rows/${packetId}`,
          {
            method: "PATCH",
            body: JSON.stringify(updateData)
          }
        )

        return NextResponse.json({
          success: true,
          packetId,
          status,
          method: "direct-update"
        })

      } catch (updateError) {
        // If N8N fails, still return success since we created the activity event
        console.warn("N8N update failed:", updateError)
        return NextResponse.json({
          success: true,
          packetId,
          status,
          method: "activity-event-only",
          warning: "N8N update failed but activity event was created"
        })
      }
    }

  } catch (error) {
    console.error("[packets] PUT error:", error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to update packet"
    }, { status: 500 })
  }
}
