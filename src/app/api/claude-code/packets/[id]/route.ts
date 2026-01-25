/**
 * Claude Code Individual Packet API
 *
 * PATCH /api/claude-code/packets/[id] - Update a packet (status, tasks, etc.)
 * GET /api/claude-code/packets/[id] - Get packet details
 *
 * This enables Claude Code to mark packets complete and update progress.
 *
 * NOTE: Uses file-based storage (.local-storage/packets.json)
 */

import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs/promises"
import * as path from "path"
import { checkTouchdown } from "@/lib/touchdown/detector"

interface RouteParams {
  params: Promise<{ id: string }>
}

// Storage configuration (same as parent route)
const STORAGE_DIR = path.join(process.cwd(), ".local-storage")
const PACKETS_FILE = path.join(STORAGE_DIR, "packets.json")

interface WorkPacket {
  id: string
  phaseId: string
  title: string
  description: string
  type: string
  priority: string
  status: string
  tasks?: Array<{ id: string; description: string; completed: boolean; order: number }>
  acceptanceCriteria?: string[]
  suggestedTaskType?: string
  estimatedTokens?: number
  blockedBy?: string[]
  blocks?: string[]
  metadata?: Record<string, unknown>
}

interface PacketsStore {
  packets: Record<string, WorkPacket[]>
  lastUpdated: string
}

async function ensureStorageDir(): Promise<void> {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true })
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code !== "EEXIST") throw error
  }
}

async function readPacketsStore(): Promise<PacketsStore> {
  try {
    await ensureStorageDir()
    const data = await fs.readFile(PACKETS_FILE, "utf-8")
    const parsed = JSON.parse(data)
    if (parsed && typeof parsed.packets === "object") {
      return parsed as PacketsStore
    }
    return { packets: {}, lastUpdated: new Date().toISOString() }
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === "ENOENT" || error instanceof SyntaxError) {
      return { packets: {}, lastUpdated: new Date().toISOString() }
    }
    throw error
  }
}

async function writePacketsStore(store: PacketsStore): Promise<void> {
  await ensureStorageDir()
  store.lastUpdated = new Date().toISOString()
  await fs.writeFile(PACKETS_FILE, JSON.stringify(store, null, 2), "utf-8")
}

async function getPacketsForProject(projectId: string): Promise<WorkPacket[]> {
  const store = await readPacketsStore()
  return store.packets[projectId] || []
}

async function savePackets(projectId: string, packets: WorkPacket[]): Promise<void> {
  const store = await readPacketsStore()
  store.packets[projectId] = packets
  await writePacketsStore(store)
}

// ============================================================================
// Helpers
// ============================================================================

function validateSession(request: NextRequest): { valid: boolean; projectId?: string } {
  const projectId = request.headers.get("x-claudia-project")
  const host = request.headers.get("host") || ""
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1")

  if (isLocal && projectId) {
    return { valid: true, projectId }
  }

  const sessionToken = request.headers.get("x-claudia-session")
  if (sessionToken && projectId) {
    return { valid: true, projectId }
  }

  return { valid: false }
}

// ============================================================================
// GET - Get packet details
// ============================================================================

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = validateSession(request)
  if (!session.valid || !session.projectId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: packetId } = await params

  try {
    const packets = await getPacketsForProject(session.projectId)
    const packet = packets.find((p: WorkPacket) => p.id === packetId)

    if (!packet) {
      return NextResponse.json({ error: "Packet not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      packet,
    })
  } catch (error) {
    console.error("[claude-code/packets/[id]] GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get packet" },
      { status: 500 }
    )
  }
}

// ============================================================================
// PATCH - Update packet
// ============================================================================

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = validateSession(request)
  if (!session.valid || !session.projectId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id: packetId } = await params

  try {
    const body = await request.json()
    const {
      status,
      tasks,
      completedTaskIds,
      addTasks,
      notes,
      outputSummary,
      filesChanged,
    } = body

    const packets = await getPacketsForProject(session.projectId)
    const packetIndex = packets.findIndex((p: WorkPacket) => p.id === packetId)

    if (packetIndex === -1) {
      return NextResponse.json({ error: "Packet not found" }, { status: 404 })
    }

    const packet = packets[packetIndex]
    const previousStatus = packet.status

    // Update status if provided
    if (status && ["queued", "in_progress", "completed", "blocked"].includes(status)) {
      packet.status = status
    }

    // Mark specific tasks as completed
    if (completedTaskIds && Array.isArray(completedTaskIds) && packet.tasks) {
      for (const taskId of completedTaskIds) {
        const task = packet.tasks.find(t => t.id === taskId)
        if (task) {
          task.completed = true
        }
      }
    }

    // Replace all tasks if provided
    if (tasks && Array.isArray(tasks)) {
      packet.tasks = tasks.map((t: { id?: string; description: string; completed?: boolean }, i: number) => ({
        id: t.id || `task-${Date.now()}-${i}`,
        description: t.description,
        completed: t.completed || false,
        order: i,
      }))
    }

    // Add new tasks
    if (addTasks && Array.isArray(addTasks)) {
      const existingCount = packet.tasks?.length || 0
      const newTasks = addTasks.map((t: string | { description: string }, i: number) => ({
        id: `task-${Date.now()}-${existingCount + i}`,
        description: typeof t === "string" ? t : t.description,
        completed: false,
        order: existingCount + i,
      }))
      packet.tasks = [...(packet.tasks || []), ...newTasks]
    }

    // Update metadata
    if (!packet.metadata) {
      packet.metadata = { source: "claude-code" }
    }

    if (notes) {
      packet.metadata.claudeCodeNotes = notes
    }

    if (outputSummary) {
      packet.metadata.outputSummary = outputSummary
    }

    if (filesChanged) {
      packet.metadata.filesChanged = filesChanged
    }

    packet.metadata.lastUpdatedAt = new Date().toISOString()
    packet.metadata.updatedBy = "claude-code"

    // If status changed to completed, record completion time
    if (status === "completed" && previousStatus !== "completed") {
      packet.metadata.completedAt = new Date().toISOString()
    }

    // Save updated packets
    packets[packetIndex] = packet
    await await savePackets(session.projectId, packets)

    console.log(`[claude-code/packets/[id]] Updated packet "${packet.title}" - status: ${packet.status}`)

    // Check for touchdown (all packets completed)
    let touchdownTriggered = false
    if (status === "completed") {
      const touchdownResult = await checkTouchdown(session.projectId)
      touchdownTriggered = touchdownResult.triggered
      if (touchdownTriggered) {
        console.log(`[claude-code/packets/[id]] TOUCHDOWN! All packets completed for project ${session.projectId}`)
      }
    }

    return NextResponse.json({
      success: true,
      packet: {
        id: packet.id,
        title: packet.title,
        status: packet.status,
        tasksCompleted: packet.tasks?.filter(t => t.completed).length || 0,
        totalTasks: packet.tasks?.length || 0,
      },
      touchdownTriggered,
    })
  } catch (error) {
    console.error("[claude-code/packets/[id]] PATCH error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update packet" },
      { status: 500 }
    )
  }
}
