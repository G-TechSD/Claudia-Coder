/**
 * MCP Server Start API
 *
 * POST /api/mcp/start - Start an MCP server
 */

import { NextRequest, NextResponse } from "next/server"
import { getMCPManager } from "@/lib/mcp"

/**
 * POST /api/mcp/start
 * Start an MCP server by ID
 *
 * Body: { id: string } or { ids: string[] } for batch start
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const manager = getMCPManager()

    // Handle batch start
    if (body.ids && Array.isArray(body.ids)) {
      const results: Record<string, { success: boolean; status?: string; error?: string }> = {}

      for (const id of body.ids) {
        try {
          const status = await manager.startServer(id)
          results[id] = {
            success: true,
            status: status.status,
          }
        } catch (error) {
          results[id] = {
            success: false,
            error: error instanceof Error ? error.message : "Failed to start",
          }
        }
      }

      const successCount = Object.values(results).filter((r) => r.success).length

      return NextResponse.json({
        success: successCount > 0,
        results,
        started: successCount,
        failed: body.ids.length - successCount,
      })
    }

    // Handle single start
    const id = body.id
    if (!id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
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

    const status = await manager.startServer(id)

    return NextResponse.json({
      success: true,
      server: {
        id: config.id,
        name: config.name,
        status: status.status,
        pid: status.pid,
        toolCount: status.tools?.length || 0,
        tools: status.tools?.map((t) => ({
          name: t.name,
          description: t.description,
        })),
      },
    })
  } catch (error) {
    console.error("[MCP API] Start error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start MCP server" },
      { status: 500 }
    )
  }
}
