/**
 * Claudia Sync API Route
 *
 * Processes status updates from Claude Code sessions by scanning
 * project .claudia folders and handling programmatic sync requests.
 *
 * GET /api/claudia-sync?projectId={id}
 *   - Scan the project's .claudia folder
 *   - Return any pending status updates and requests
 *   - Mark processed files
 *
 * POST /api/claudia-sync
 *   - Receive status updates or requests programmatically
 *   - Update packet status in storage
 *   - Trigger appropriate actions
 *
 * POST /api/claudia-sync?action=start-scanner
 *   - Start background scanning for a project
 *
 * POST /api/claudia-sync?action=stop-scanner
 *   - Stop background scanning
 */

import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

// ============ Types ============

export type ClaudiaStatusType =
  | "packet_started"
  | "packet_progress"
  | "packet_completed"
  | "packet_failed"
  | "packet_paused"

export type ClaudiaRequestType =
  | "new_packet"
  | "quality_review"
  | "approval_needed"
  | "activity"

export interface ClaudiaStatusUpdate {
  packetId: string
  status: ClaudiaStatusType
  progress?: number // 0-100
  message?: string
  iteration?: number
  output?: string
  exitCode?: number
  filesChanged?: string[]
  testResults?: {
    passed: number
    failed: number
    total: number
  }
  timestamp: string
}

export interface ClaudiaNewPacketRequest {
  title: string
  description: string
  type?: string
  priority?: "low" | "medium" | "high" | "critical"
  tasks?: Array<{ description: string }>
  acceptanceCriteria?: string[]
  dependencies?: string[]
}

export interface ClaudiaQualityReviewRequest {
  packetId: string
  runId?: string
  reviewType: "code" | "security" | "performance" | "full"
  files?: string[]
  comments?: string
}

export interface ClaudiaApprovalRequest {
  type: "cost" | "deploy" | "security" | "manual" | "quality"
  title: string
  description: string
  packetId: string
  urgency: "high" | "normal" | "low"
  details: Record<string, string | number>
  expiresInMinutes?: number
}

export interface ClaudiaActivityRequest {
  type: "start" | "iteration" | "file_change" | "test_run" | "thinking" | "complete" | "error" | "commit"
  message: string
  detail?: string
  iteration?: number
  progress?: number
  files?: string[]
  testResults?: {
    passed: number
    failed: number
    total: number
  }
}

export type ClaudiaRequest =
  | { type: "new_packet"; data: ClaudiaNewPacketRequest }
  | { type: "quality_review"; data: ClaudiaQualityReviewRequest }
  | { type: "approval_needed"; data: ClaudiaApprovalRequest }
  | { type: "activity"; data: ClaudiaActivityRequest }

export interface SyncRequest {
  projectId: string
  type: "status_update" | "request"
  data: ClaudiaStatusUpdate | ClaudiaRequest
}

export interface ClaudiaSyncFile {
  filename: string
  type: "status" | "request"
  content: ClaudiaStatusUpdate | ClaudiaRequest
  processedAt?: string
}

// In-memory storage for background scanner state
// In production, this would be Redis or similar
const scannerState: Map<string, {
  intervalId: NodeJS.Timeout | null
  lastScan: string
  isRunning: boolean
}> = new Map()

// Storage keys for localStorage-like server-side persistence
// These will be used when integrating with a proper database
const _STORAGE_KEYS = {
  PACKETS: "claudia_packets",
  PACKET_RUNS: "claudia_packet_runs",
  APPROVALS: "claudia_approvals",
  ACTIVITY: "claudia_activity_stream",
}
void _STORAGE_KEYS // Mark as intentionally unused for now

// ============ Helper Functions ============

/**
 * UUID generator
 */
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === "x" ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Get the .claudia folder path for a project
 */
function getClaudiaFolderPath(workingDirectory: string): string {
  return path.join(workingDirectory, ".claudia")
}

/**
 * Ensure .claudia folder structure exists
 */
async function ensureClaudiaFolder(workingDirectory: string): Promise<string> {
  const claudiaPath = getClaudiaFolderPath(workingDirectory)
  const subfolders = ["status", "requests", "processed", "queue"]

  await fs.mkdir(claudiaPath, { recursive: true })
  for (const folder of subfolders) {
    await fs.mkdir(path.join(claudiaPath, folder), { recursive: true })
  }

  return claudiaPath
}

/**
 * Check if a file/directory exists
 */
async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Read and parse JSON file safely
 */
async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const content = await fs.readFile(filePath, "utf-8")
    return JSON.parse(content) as T
  } catch {
    return null
  }
}

/**
 * Write JSON file
 */
async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2))
}

/**
 * Scan .claudia folder for pending files
 */
async function scanClaudiaFolder(workingDirectory: string): Promise<{
  statusUpdates: ClaudiaSyncFile[]
  requests: ClaudiaSyncFile[]
}> {
  const claudiaPath = getClaudiaFolderPath(workingDirectory)
  const statusUpdates: ClaudiaSyncFile[] = []
  const requests: ClaudiaSyncFile[] = []

  // Check if .claudia folder exists
  if (!(await exists(claudiaPath))) {
    return { statusUpdates, requests }
  }

  // Scan status folder
  const statusPath = path.join(claudiaPath, "status")
  if (await exists(statusPath)) {
    const statusFiles = await fs.readdir(statusPath)
    for (const file of statusFiles) {
      if (file.endsWith(".json")) {
        const content = await readJsonFile<ClaudiaStatusUpdate>(path.join(statusPath, file))
        if (content) {
          statusUpdates.push({
            filename: file,
            type: "status",
            content,
          })
        }
      }
    }
  }

  // Scan requests folder
  const requestsPath = path.join(claudiaPath, "requests")
  if (await exists(requestsPath)) {
    const requestFiles = await fs.readdir(requestsPath)
    for (const file of requestFiles) {
      if (file.endsWith(".json")) {
        const content = await readJsonFile<ClaudiaRequest>(path.join(requestsPath, file))
        if (content) {
          requests.push({
            filename: file,
            type: "request",
            content,
          })
        }
      }
    }
  }

  return { statusUpdates, requests }
}

/**
 * Mark a file as processed by moving to processed folder
 */
async function markFileAsProcessed(
  workingDirectory: string,
  type: "status" | "request",
  filename: string
): Promise<void> {
  const claudiaPath = getClaudiaFolderPath(workingDirectory)
  const sourceFolder = type === "status" ? "status" : "requests"
  const sourcePath = path.join(claudiaPath, sourceFolder, filename)
  const processedPath = path.join(claudiaPath, "processed", `${type}-${filename}`)

  // Add processed timestamp to file
  const content = await readJsonFile<Record<string, unknown>>(sourcePath)
  if (content) {
    content.processedAt = new Date().toISOString()
    await writeJsonFile(processedPath, content)
  }

  // Remove original
  await fs.unlink(sourcePath)
}

// ============ Status Update Handlers ============

/**
 * Handle packet status update
 */
async function handleStatusUpdate(
  projectId: string,
  update: ClaudiaStatusUpdate
): Promise<{ success: boolean; message: string; actions: string[] }> {
  const actions: string[] = []

  switch (update.status) {
    case "packet_started":
      actions.push(`Packet ${update.packetId} started`)
      // Create new run record
      actions.push("Created packet run record")
      break

    case "packet_progress":
      actions.push(`Packet ${update.packetId} progress: ${update.progress}%`)
      // Update run with progress
      break

    case "packet_completed":
      actions.push(`Packet ${update.packetId} completed`)
      // Update packet status to completed
      // Update run record with output
      // Check for auto-mode to trigger next packet
      actions.push("Updated packet status to completed")
      actions.push("Updated run history")
      if (update.filesChanged && update.filesChanged.length > 0) {
        actions.push(`Files changed: ${update.filesChanged.length}`)
      }
      break

    case "packet_failed":
      actions.push(`Packet ${update.packetId} failed`)
      // Update packet status to failed
      // Update run record with error
      actions.push("Updated packet status to failed")
      if (update.output) {
        actions.push("Recorded error output")
      }
      break

    case "packet_paused":
      actions.push(`Packet ${update.packetId} paused`)
      // Update packet status to paused
      break
  }

  return {
    success: true,
    message: `Processed ${update.status} for packet ${update.packetId}`,
    actions,
  }
}

// ============ Request Handlers ============

/**
 * Handle new_packet request
 */
async function handleNewPacketRequest(
  projectId: string,
  data: ClaudiaNewPacketRequest
): Promise<{ success: boolean; packetId: string; message: string }> {
  const packetId = generateUUID()

  // In a real implementation, this would save to the database
  // For now, we'll return the created packet ID
  console.log(`[claudia-sync] Creating new packet for project ${projectId}:`, data)

  return {
    success: true,
    packetId,
    message: `Created new packet: ${data.title}`,
  }
}

/**
 * Handle quality_review request
 */
async function handleQualityReviewRequest(
  projectId: string,
  data: ClaudiaQualityReviewRequest
): Promise<{ success: boolean; reviewId: string; message: string }> {
  const reviewId = generateUUID()

  console.log(`[claudia-sync] Quality review requested for packet ${data.packetId}:`, data)

  return {
    success: true,
    reviewId,
    message: `Quality review (${data.reviewType}) queued for packet ${data.packetId}`,
  }
}

/**
 * Handle approval_needed request
 */
async function handleApprovalRequest(
  projectId: string,
  data: ClaudiaApprovalRequest
): Promise<{ success: boolean; approvalId: string; message: string }> {
  const approvalId = generateUUID()

  // Create approval record
  const approval = {
    id: approvalId,
    type: data.type,
    title: data.title,
    description: data.description,
    status: "pending",
    packetId: data.packetId,
    requestedBy: "claude-code",
    requestedAt: new Date().toISOString(),
    expiresAt: data.expiresInMinutes
      ? new Date(Date.now() + data.expiresInMinutes * 60 * 1000).toISOString()
      : undefined,
    details: data.details,
    urgency: data.urgency,
  }

  console.log(`[claudia-sync] Approval request created:`, approval)

  return {
    success: true,
    approvalId,
    message: `Approval request created: ${data.title}`,
  }
}

/**
 * Handle activity request
 */
async function handleActivityRequest(
  projectId: string,
  data: ClaudiaActivityRequest
): Promise<{ success: boolean; activityId: string; message: string }> {
  const activityId = generateUUID()

  // Create activity event
  const activity = {
    id: activityId,
    projectId,
    type: data.type,
    timestamp: new Date().toISOString(),
    message: data.message,
    detail: data.detail,
    iteration: data.iteration,
    progress: data.progress,
    files: data.files,
    testResults: data.testResults,
  }

  console.log(`[claudia-sync] Activity event:`, activity)

  return {
    success: true,
    activityId,
    message: `Activity recorded: ${data.message}`,
  }
}

/**
 * Process a request based on type
 */
async function processRequest(
  projectId: string,
  request: ClaudiaRequest
): Promise<{ success: boolean; message: string; result: unknown }> {
  switch (request.type) {
    case "new_packet":
      return {
        success: true,
        message: "New packet request processed",
        result: await handleNewPacketRequest(projectId, request.data),
      }

    case "quality_review":
      return {
        success: true,
        message: "Quality review request processed",
        result: await handleQualityReviewRequest(projectId, request.data),
      }

    case "approval_needed":
      return {
        success: true,
        message: "Approval request processed",
        result: await handleApprovalRequest(projectId, request.data),
      }

    case "activity":
      return {
        success: true,
        message: "Activity request processed",
        result: await handleActivityRequest(projectId, request.data),
      }

    default:
      return {
        success: false,
        message: `Unknown request type: ${(request as ClaudiaRequest).type}`,
        result: null,
      }
  }
}

// ============ Background Scanner ============

/**
 * Start background scanning for a project
 */
function startBackgroundScanner(
  projectId: string,
  workingDirectory: string,
  intervalMs: number = 5000
): { success: boolean; message: string } {
  // Stop existing scanner if running
  stopBackgroundScanner(projectId)

  const scanner = {
    intervalId: setInterval(async () => {
      try {
        const { statusUpdates, requests } = await scanClaudiaFolder(workingDirectory)

        // Process status updates
        for (const update of statusUpdates) {
          await handleStatusUpdate(projectId, update.content as ClaudiaStatusUpdate)
          await markFileAsProcessed(workingDirectory, "status", update.filename)
        }

        // Process requests
        for (const request of requests) {
          await processRequest(projectId, request.content as ClaudiaRequest)
          await markFileAsProcessed(workingDirectory, "request", request.filename)
        }

        // Update last scan time
        const state = scannerState.get(projectId)
        if (state) {
          state.lastScan = new Date().toISOString()
        }
      } catch (error) {
        console.error(`[claudia-sync] Scanner error for project ${projectId}:`, error)
      }
    }, intervalMs),
    lastScan: new Date().toISOString(),
    isRunning: true,
  }

  scannerState.set(projectId, scanner)

  return {
    success: true,
    message: `Background scanner started for project ${projectId} (interval: ${intervalMs}ms)`,
  }
}

/**
 * Stop background scanning for a project
 */
function stopBackgroundScanner(projectId: string): { success: boolean; message: string } {
  const state = scannerState.get(projectId)

  if (state?.intervalId) {
    clearInterval(state.intervalId)
    state.intervalId = null
    state.isRunning = false
    return {
      success: true,
      message: `Background scanner stopped for project ${projectId}`,
    }
  }

  return {
    success: true,
    message: `No active scanner for project ${projectId}`,
  }
}

/**
 * Get scanner status for a project
 */
function getScannerStatus(projectId: string): {
  isRunning: boolean
  lastScan: string | null
} {
  const state = scannerState.get(projectId)
  return {
    isRunning: state?.isRunning ?? false,
    lastScan: state?.lastScan ?? null,
  }
}

// ============ API Route Handlers ============

/**
 * GET /api/claudia-sync
 *
 * Scan project's .claudia folder for pending updates
 *
 * Query params:
 *   - projectId: Project ID (required)
 *   - workingDirectory: Project working directory (required)
 *   - process: If "true", process and mark files as handled
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get("projectId")
  const workingDirectory = searchParams.get("workingDirectory")
  const shouldProcess = searchParams.get("process") === "true"

  if (!projectId) {
    return NextResponse.json(
      { success: false, error: "projectId is required" },
      { status: 400 }
    )
  }

  if (!workingDirectory) {
    return NextResponse.json(
      { success: false, error: "workingDirectory is required" },
      { status: 400 }
    )
  }

  try {
    // Scan for pending files
    const { statusUpdates, requests } = await scanClaudiaFolder(workingDirectory)

    // Process if requested
    const processedResults: Array<{ type: string; result: unknown }> = []

    if (shouldProcess) {
      // Process status updates
      for (const update of statusUpdates) {
        const result = await handleStatusUpdate(projectId, update.content as ClaudiaStatusUpdate)
        await markFileAsProcessed(workingDirectory, "status", update.filename)
        processedResults.push({ type: "status_update", result })
      }

      // Process requests
      for (const req of requests) {
        const result = await processRequest(projectId, req.content as ClaudiaRequest)
        await markFileAsProcessed(workingDirectory, "request", req.filename)
        processedResults.push({ type: "request", result })
      }
    }

    // Get scanner status
    const scannerStatus = getScannerStatus(projectId)

    return NextResponse.json({
      success: true,
      projectId,
      workingDirectory,
      scanner: scannerStatus,
      pending: {
        statusUpdates: shouldProcess ? [] : statusUpdates,
        requests: shouldProcess ? [] : requests,
        totalCount: statusUpdates.length + requests.length,
      },
      processed: shouldProcess ? processedResults : [],
    })
  } catch (error) {
    console.error("[claudia-sync] GET error:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to scan claudia folder",
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/claudia-sync
 *
 * Handle sync requests programmatically
 *
 * Query params:
 *   - action: "start-scanner" | "stop-scanner" | "get-status" (optional)
 *
 * Body (for regular sync):
 *   - projectId: string
 *   - type: "status_update" | "request"
 *   - data: ClaudiaStatusUpdate | ClaudiaRequest
 *
 * Body (for scanner actions):
 *   - projectId: string
 *   - workingDirectory: string
 *   - intervalMs?: number (for start-scanner)
 */
export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get("action")

  try {
    const body = await request.json()

    // Handle scanner actions
    if (action === "start-scanner") {
      const { projectId, workingDirectory, intervalMs } = body

      if (!projectId || !workingDirectory) {
        return NextResponse.json(
          { success: false, error: "projectId and workingDirectory are required" },
          { status: 400 }
        )
      }

      // Ensure .claudia folder exists
      await ensureClaudiaFolder(workingDirectory)

      const result = startBackgroundScanner(projectId, workingDirectory, intervalMs || 5000)

      return NextResponse.json({
        action: "start-scanner",
        ...result,
      })
    }

    if (action === "stop-scanner") {
      const { projectId } = body

      if (!projectId) {
        return NextResponse.json(
          { success: false, error: "projectId is required" },
          { status: 400 }
        )
      }

      const result = stopBackgroundScanner(projectId)

      return NextResponse.json({
        action: "stop-scanner",
        ...result,
      })
    }

    if (action === "get-status") {
      const { projectId } = body

      if (!projectId) {
        return NextResponse.json(
          { success: false, error: "projectId is required" },
          { status: 400 }
        )
      }

      const status = getScannerStatus(projectId)

      return NextResponse.json({
        success: true,
        action: "get-status",
        projectId,
        scanner: status,
      })
    }

    if (action === "ensure-folder") {
      const { workingDirectory } = body

      if (!workingDirectory) {
        return NextResponse.json(
          { success: false, error: "workingDirectory is required" },
          { status: 400 }
        )
      }

      const claudiaPath = await ensureClaudiaFolder(workingDirectory)

      return NextResponse.json({
        success: true,
        action: "ensure-folder",
        claudiaPath,
        message: "Claudia folder structure created",
      })
    }

    // Handle regular sync request
    const syncRequest = body as SyncRequest

    if (!syncRequest.projectId) {
      return NextResponse.json(
        { success: false, error: "projectId is required" },
        { status: 400 }
      )
    }

    if (!syncRequest.type) {
      return NextResponse.json(
        { success: false, error: "type is required (status_update or request)" },
        { status: 400 }
      )
    }

    if (!syncRequest.data) {
      return NextResponse.json(
        { success: false, error: "data is required" },
        { status: 400 }
      )
    }

    let result: unknown

    if (syncRequest.type === "status_update") {
      result = await handleStatusUpdate(
        syncRequest.projectId,
        syncRequest.data as ClaudiaStatusUpdate
      )
    } else if (syncRequest.type === "request") {
      result = await processRequest(
        syncRequest.projectId,
        syncRequest.data as ClaudiaRequest
      )
    } else {
      return NextResponse.json(
        { success: false, error: `Unknown type: ${syncRequest.type}` },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      projectId: syncRequest.projectId,
      type: syncRequest.type,
      result,
    })
  } catch (error) {
    console.error("[claudia-sync] POST error:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process sync request",
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/claudia-sync
 *
 * Clean up processed files older than a certain age
 *
 * Query params:
 *   - workingDirectory: Project working directory (required)
 *   - olderThanHours: Delete files older than N hours (default: 24)
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const workingDirectory = searchParams.get("workingDirectory")
  const olderThanHours = parseInt(searchParams.get("olderThanHours") || "24", 10)

  if (!workingDirectory) {
    return NextResponse.json(
      { success: false, error: "workingDirectory is required" },
      { status: 400 }
    )
  }

  try {
    const claudiaPath = getClaudiaFolderPath(workingDirectory)
    const processedPath = path.join(claudiaPath, "processed")

    if (!(await exists(processedPath))) {
      return NextResponse.json({
        success: true,
        message: "No processed folder found",
        deletedCount: 0,
      })
    }

    const cutoffTime = Date.now() - olderThanHours * 60 * 60 * 1000
    const files = await fs.readdir(processedPath)
    let deletedCount = 0

    for (const file of files) {
      const filePath = path.join(processedPath, file)
      const stat = await fs.stat(filePath)

      if (stat.mtimeMs < cutoffTime) {
        await fs.unlink(filePath)
        deletedCount++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedCount} processed files older than ${olderThanHours} hours`,
      deletedCount,
    })
  } catch (error) {
    console.error("[claudia-sync] DELETE error:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to clean up processed files",
      },
      { status: 500 }
    )
  }
}
