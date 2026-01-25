/**
 * Project Packets API
 *
 * GET /api/projects/[id]/packets - List packets for a project
 * PUT /api/projects/[id]/packets - Replace all packets for a project
 * PATCH /api/projects/[id]/packets - Update specific packet(s)
 *
 * This provides server-side access to packet data, enabling:
 * - Claude Code to update packet status
 * - Project page to refresh packet state
 * - Cross-session packet persistence
 */

import { NextRequest, NextResponse } from "next/server"
import * as fs from "fs/promises"
import * as path from "path"

interface RouteParams {
  params: Promise<{ id: string }>
}

// Storage configuration
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
  packets: Record<string, WorkPacket[]>  // projectId -> packets[]
  lastUpdated: string
}

// ============ File Operations ============

async function ensureStorageDir(): Promise<void> {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true })
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code !== "EEXIST") {
      console.error("[packets] Failed to create storage directory:", error)
      throw error
    }
  }
}

async function readPacketsFile(): Promise<PacketsStore> {
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
    if (err.code === "ENOENT") {
      return { packets: {}, lastUpdated: new Date().toISOString() }
    }
    if (error instanceof SyntaxError) {
      console.error("[packets] JSON parse error:", error.message)
      return { packets: {}, lastUpdated: new Date().toISOString() }
    }
    throw error
  }
}

async function writePacketsFile(store: PacketsStore): Promise<void> {
  await ensureStorageDir()
  store.lastUpdated = new Date().toISOString()
  await fs.writeFile(PACKETS_FILE, JSON.stringify(store, null, 2), "utf-8")
}

// ============ API Handlers ============

/**
 * GET - List packets for a project
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: projectId } = await params

  try {
    const store = await readPacketsFile()
    const packets = store.packets[projectId] || []

    // Calculate summary stats
    const summary = {
      total: packets.length,
      queued: packets.filter((p: WorkPacket) => p.status === "queued").length,
      inProgress: packets.filter((p: WorkPacket) => p.status === "in_progress").length,
      completed: packets.filter((p: WorkPacket) => p.status === "completed").length,
      blocked: packets.filter((p: WorkPacket) => p.status === "blocked").length,
    }

    return NextResponse.json({
      success: true,
      projectId,
      packets,
      summary,
      lastUpdated: store.lastUpdated,
    })
  } catch (error) {
    console.error("[packets] GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get packets" },
      { status: 500 }
    )
  }
}

/**
 * PUT - Replace all packets for a project
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id: projectId } = await params

  try {
    const body = await request.json()
    const { packets } = body

    if (!Array.isArray(packets)) {
      return NextResponse.json({ error: "packets must be an array" }, { status: 400 })
    }

    const store = await readPacketsFile()
    store.packets[projectId] = packets
    await writePacketsFile(store)

    console.log(`[packets] Replaced ${packets.length} packets for project ${projectId}`)

    return NextResponse.json({
      success: true,
      projectId,
      packetCount: packets.length,
    })
  } catch (error) {
    console.error("[packets] PUT error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save packets" },
      { status: 500 }
    )
  }
}

/**
 * PATCH - Update specific packet(s) by ID
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: projectId } = await params

  try {
    const body = await request.json()
    const { packetId, bulkUpdates } = body

    // Support both "updates: {status, ...}" format and direct fields like "status: ..."
    // This makes the API more flexible for different clients
    let updates = body.updates
    if (!updates && !bulkUpdates) {
      // Extract potential update fields from the top level
      const { status, tasks, metadata } = body
      if (status || tasks || metadata) {
        updates = { status, tasks, metadata }
      }
    }

    const store = await readPacketsFile()
    const packets = store.packets[projectId] || []

    // Handle bulk updates (array of { packetId, updates })
    if (bulkUpdates && Array.isArray(bulkUpdates)) {
      let updatedCount = 0

      for (const update of bulkUpdates) {
        const index = packets.findIndex((p: WorkPacket) => p.id === update.packetId)
        if (index !== -1) {
          packets[index] = { ...packets[index], ...update.updates }
          updatedCount++
        }
      }

      store.packets[projectId] = packets
      await writePacketsFile(store)

      console.log(`[packets] Bulk updated ${updatedCount} packets for project ${projectId}`)

      return NextResponse.json({
        success: true,
        updatedCount,
      })
    }

    // Handle single packet update
    if (!packetId) {
      return NextResponse.json({ error: "packetId is required" }, { status: 400 })
    }

    if (!updates || typeof updates !== "object") {
      return NextResponse.json({ error: "updates object is required" }, { status: 400 })
    }

    const packetIndex = packets.findIndex((p: WorkPacket) => p.id === packetId)
    if (packetIndex === -1) {
      return NextResponse.json({ error: "Packet not found" }, { status: 404 })
    }

    // Apply updates
    const packet = packets[packetIndex]
    const previousStatus = packet.status

    if (updates.status) {
      packet.status = updates.status
    }

    if (updates.tasks) {
      packet.tasks = updates.tasks
    }

    if (updates.metadata) {
      packet.metadata = { ...packet.metadata, ...updates.metadata }
    }

    // Track completion time
    if (updates.status === "completed" && previousStatus !== "completed") {
      packet.metadata = {
        ...packet.metadata,
        completedAt: new Date().toISOString(),
      }
    }

    packets[packetIndex] = packet
    store.packets[projectId] = packets
    await writePacketsFile(store)

    console.log(`[packets] Updated packet "${packet.title}" - status: ${packet.status}`)

    // Check if all packets are now completed (Touchdown!)
    const allCompleted = packets.every((p: WorkPacket) => p.status === "completed")

    return NextResponse.json({
      success: true,
      packet: {
        id: packet.id,
        title: packet.title,
        status: packet.status,
      },
      allCompleted,
    })
  } catch (error) {
    console.error("[packets] PATCH error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update packet" },
      { status: 500 }
    )
  }
}

/**
 * POST - Sync packets from localStorage (for migration/sync)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: projectId } = await params

  try {
    const body = await request.json()
    const { packets, source = "sync" } = body

    if (!Array.isArray(packets)) {
      return NextResponse.json({ error: "packets must be an array" }, { status: 400 })
    }

    const store = await readPacketsFile()

    // Merge strategy: server wins for status, but accept new packets
    const existingPackets = store.packets[projectId] || []
    const existingIds = new Set(existingPackets.map((p: WorkPacket) => p.id))

    // Keep existing packets with their status, add new ones
    const mergedPackets = [...existingPackets]

    for (const packet of packets) {
      if (!existingIds.has(packet.id)) {
        mergedPackets.push(packet)
      }
    }

    store.packets[projectId] = mergedPackets
    await writePacketsFile(store)

    console.log(`[packets] Synced packets for project ${projectId} from ${source}`)

    return NextResponse.json({
      success: true,
      projectId,
      packetCount: mergedPackets.length,
      newPackets: packets.length - existingPackets.length,
    })
  } catch (error) {
    console.error("[packets] POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sync packets" },
      { status: 500 }
    )
  }
}
