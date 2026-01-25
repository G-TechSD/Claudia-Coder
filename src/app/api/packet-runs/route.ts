/**
 * Packet Runs API Route
 *
 * GET /api/packet-runs - List packet runs (with optional projectId filter)
 * POST /api/packet-runs - Create a new packet run
 * PUT /api/packet-runs - Update a packet run
 * DELETE /api/packet-runs - Delete a packet run
 */

import { NextRequest, NextResponse } from "next/server"
import {
  readPacketRunsFile,
  addPacketRun,
  updatePacketRun,
  deletePacketRun,
  getPacketRunsForProject,
  getPacketRunsForUser,
  PacketRun
} from "@/lib/data/server-packet-runs"
import { getSessionWithBypass, unauthorizedResponse } from "@/lib/auth/api-helpers"

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionWithBypass()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")

    let runs: PacketRun[]
    if (projectId) {
      runs = await getPacketRunsForProject(projectId)
    } else {
      runs = await getPacketRunsForUser(session.user.id)
    }

    return NextResponse.json({
      success: true,
      runs
    })
  } catch (error) {
    console.error("[packet-runs] GET error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to fetch packet runs" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionWithBypass()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const run: PacketRun = {
      id: body.id || `run-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      packetId: body.packetId,
      projectId: body.projectId,
      status: body.status || "pending",
      startedAt: body.startedAt || new Date().toISOString(),
      completedAt: body.completedAt,
      model: body.model,
      server: body.server,
      error: body.error,
      output: body.output,
      files: body.files,
      commitUrl: body.commitUrl,
      branch: body.branch,
      duration: body.duration,
      userId: session.user.id
    }

    const created = await addPacketRun(run)

    return NextResponse.json({
      success: true,
      run: created
    })
  } catch (error) {
    console.error("[packet-runs] POST error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create packet run" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionWithBypass()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }

    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Run ID required" },
        { status: 400 }
      )
    }

    const updated = await updatePacketRun(id, updates)

    if (!updated) {
      return NextResponse.json(
        { success: false, error: "Packet run not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      run: updated
    })
  } catch (error) {
    console.error("[packet-runs] PUT error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to update packet run" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionWithBypass()
    if (!session?.user?.id) {
      return unauthorizedResponse()
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Run ID required" },
        { status: 400 }
      )
    }

    const deleted = await deletePacketRun(id)

    return NextResponse.json({
      success: deleted,
      error: deleted ? undefined : "Packet run not found"
    })
  } catch (error) {
    console.error("[packet-runs] DELETE error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to delete packet run" },
      { status: 500 }
    )
  }
}
