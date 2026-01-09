/**
 * MCP Server Stop API
 *
 * POST /api/mcp/stop - Stop an MCP server
 */

import { NextRequest, NextResponse } from "next/server"
import { getMCPManager } from "@/lib/mcp"

/**
 * POST /api/mcp/stop
 * Stop an MCP server by ID
 *
 * Body: { id: string } or { ids: string[] } for batch stop
 *       { all: true } to stop all running servers
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const manager = getMCPManager()

    // Handle stop all
    if (body.all === true) {
      const statuses = manager.getAllStatuses()
      const runningIds = statuses
        .filter((s) => s.status === "running")
        .map((s) => s.id)

      await manager.stopAll()

      return NextResponse.json({
        success: true,
        stopped: runningIds,
        count: runningIds.length,
      })
    }

    // Handle batch stop
    if (body.ids && Array.isArray(body.ids)) {
      const results: Record<string, { success: boolean; error?: string }> = {}

      for (const id of body.ids) {
        try {
          await manager.stopServer(id)
          results[id] = { success: true }
        } catch (error) {
          results[id] = {
            success: false,
            error: error instanceof Error ? error.message : "Failed to stop",
          }
        }
      }

      const successCount = Object.values(results).filter((r) => r.success).length

      return NextResponse.json({
        success: successCount > 0,
        results,
        stopped: successCount,
        failed: body.ids.length - successCount,
      })
    }

    // Handle single stop
    const id = body.id
    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id (or use ids array, or all: true)" },
        { status: 400 }
      )
    }

    const config = manager.getConfig(id)
    if (!config) {
      return NextResponse.json(
        { error: `Server ${id} not found` },
        { status: 404 }
      )
    }

    const status = await manager.stopServer(id)

    return NextResponse.json({
      success: true,
      server: {
        id: config.id,
        name: config.name,
        status: status.status,
      },
    })
  } catch (error) {
    console.error("[MCP API] Stop error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to stop MCP server" },
      { status: 500 }
    )
  }
}
