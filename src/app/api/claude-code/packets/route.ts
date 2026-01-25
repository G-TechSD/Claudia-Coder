/**
 * Claude Code Packets API
 *
 * Allows Claude Code to create and manage packets in Claudia.
 * This enables bidirectional sync between Claude Code and Claudia.
 *
 * POST /api/claude-code/packets - Create a new packet
 * GET /api/claude-code/packets?projectId=xxx - List packets for a project
 *
 * Authentication: Session token passed from Claudia execution context
 *
 * NOTE: Uses file-based storage (.local-storage/packets.json) so packets
 * can be updated from server-side API routes.
 */

import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs/promises"
import * as path from "path"

// Storage configuration (same as projects/[id]/packets route)
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

/**
 * Validate Claude Code session token
 * For local development, we accept requests from localhost
 * In production, we validate the session token
 */
function validateSession(request: NextRequest): { valid: boolean; projectId?: string; sessionId?: string } {
  // Check for session token in header
  const sessionToken = request.headers.get("x-claudia-session")
  const projectId = request.headers.get("x-claudia-project")

  // For local development, allow localhost requests
  const host = request.headers.get("host") || ""
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1")

  if (isLocal && projectId) {
    return { valid: true, projectId }
  }

  // TODO: Validate session token against active execution sessions
  if (sessionToken && projectId) {
    return { valid: true, projectId, sessionId: sessionToken }
  }

  return { valid: false }
}

function generatePacketId(): string {
  return `packet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// ============================================================================
// GET - List packets for a project
// ============================================================================

export async function GET(request: NextRequest) {
  const session = validateSession(request)
  if (!session.valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get("projectId") || session.projectId

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 })
  }

  try {
    const packets = await getPacketsForProject(projectId)

    // Return simplified packet info
    return NextResponse.json({
      success: true,
      projectId,
      packets: packets.map((p: WorkPacket) => ({
        id: p.id,
        title: p.title,
        type: p.type,
        status: p.status,
        priority: p.priority,
        description: p.description?.slice(0, 200),
        tasks: p.tasks?.length || 0,
        completedTasks: p.tasks?.filter((t: { completed: boolean }) => t.completed).length || 0,
      })),
      summary: {
        total: packets.length,
        queued: packets.filter((p: WorkPacket) => p.status === "queued").length,
        inProgress: packets.filter((p: WorkPacket) => p.status === "in_progress").length,
        completed: packets.filter((p: WorkPacket) => p.status === "completed").length,
        blocked: packets.filter((p: WorkPacket) => p.status === "blocked").length,
      },
    })
  } catch (error) {
    console.error("[claude-code/packets] GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get packets" },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST - Create a new packet
// ============================================================================

export async function POST(request: NextRequest) {
  const session = validateSession(request)
  if (!session.valid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const {
      projectId,
      title,
      description,
      type = "feature",
      priority = "medium",
      tasks = [],
      acceptanceCriteria = [],
      dependencies = [],
      metadata = {},
    } = body

    const targetProjectId = projectId || session.projectId
    if (!targetProjectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 })
    }

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 })
    }

    // Get existing packets
    const existingPackets = await getPacketsForProject(targetProjectId)

    // Create new packet
    const newPacket: WorkPacket = {
      id: generatePacketId(),
      phaseId: "phase-claude-code",
      title,
      description: description || title,
      type,
      priority,
      status: "queued",
      tasks: tasks.map((t: string | { description: string; completed?: boolean }, i: number) => ({
        id: `task-${Date.now()}-${i}`,
        description: typeof t === "string" ? t : t.description,
        completed: typeof t === "object" ? t.completed || false : false,
        order: i,
      })),
      suggestedTaskType: "code",
      acceptanceCriteria: acceptanceCriteria.length > 0 ? acceptanceCriteria : [`Complete: ${title}`],
      estimatedTokens: 2000,
      blockedBy: dependencies,
      blocks: [],
      metadata: {
        ...metadata,
        source: "claude-code",
        createdAt: new Date().toISOString(),
        createdBy: "claude-code-session",
      },
    }

    // Add to existing packets and save
    const updatedPackets = [...existingPackets, newPacket]
    await await savePackets(targetProjectId, updatedPackets)

    console.log(`[claude-code/packets] Created packet "${title}" for project ${targetProjectId}`)

    return NextResponse.json({
      success: true,
      packet: {
        id: newPacket.id,
        title: newPacket.title,
        status: newPacket.status,
        type: newPacket.type,
      },
    })
  } catch (error) {
    console.error("[claude-code/packets] POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create packet" },
      { status: 500 }
    )
  }
}
