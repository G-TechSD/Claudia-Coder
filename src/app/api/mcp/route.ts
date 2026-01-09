/**
 * MCP Server Management API
 *
 * GET - List configured MCP servers and their status
 * POST - Add new MCP server config
 * PUT - Update MCP server config
 * DELETE - Remove MCP server
 */

import { NextRequest, NextResponse } from "next/server"
import { getMCPManager } from "@/lib/mcp"
import { MCPServerConfig } from "@/lib/mcp/types"

// Generate unique ID
function generateId(): string {
  return `mcp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * GET /api/mcp
 * List all configured MCP servers and their status
 */
export async function GET() {
  try {
    const manager = getMCPManager()
    const configs = manager.getConfigs()
    const statuses = manager.getAllStatuses()

    // Combine configs with their statuses
    const servers = configs.map((config) => {
      const status = statuses.find((s) => s.id === config.id)
      return {
        ...config,
        status: status?.status || "stopped",
        error: status?.error,
        pid: status?.pid,
        toolCount: status?.tools?.length || 0,
        lastStarted: status?.lastStarted,
        lastError: status?.lastError,
      }
    })

    return NextResponse.json({
      servers,
      runningCount: manager.getRunningCount(),
      totalCount: configs.length,
    })
  } catch (error) {
    console.error("[MCP API] GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get MCP servers" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/mcp
 * Add a new MCP server configuration
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate required fields
    if (!body.name || !body.command) {
      return NextResponse.json(
        { error: "Missing required fields: name and command are required" },
        { status: 400 }
      )
    }

    const config: MCPServerConfig = {
      id: body.id || generateId(),
      name: body.name,
      description: body.description,
      command: body.command,
      args: body.args || [],
      env: body.env || {},
      enabled: body.enabled ?? true,
      autoStart: body.autoStart ?? false,
    }

    const manager = getMCPManager()
    manager.addConfig(config)

    // Auto-start if requested
    if (config.enabled && config.autoStart) {
      try {
        await manager.startServer(config.id)
      } catch (startError) {
        console.error("[MCP API] Auto-start failed:", startError)
      }
    }

    const status = manager.getServerStatus(config.id)

    return NextResponse.json({
      success: true,
      server: {
        ...config,
        status: status?.status || "stopped",
        error: status?.error,
      },
    })
  } catch (error) {
    console.error("[MCP API] POST error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add MCP server" },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/mcp
 * Update an existing MCP server configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.id) {
      return NextResponse.json(
        { error: "Missing required field: id" },
        { status: 400 }
      )
    }

    const manager = getMCPManager()
    const existing = manager.getConfig(body.id)

    if (!existing) {
      return NextResponse.json(
        { error: `Server ${body.id} not found` },
        { status: 404 }
      )
    }

    const config: MCPServerConfig = {
      ...existing,
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      command: body.command ?? existing.command,
      args: body.args ?? existing.args,
      env: body.env ?? existing.env,
      enabled: body.enabled ?? existing.enabled,
      autoStart: body.autoStart ?? existing.autoStart,
    }

    manager.updateConfig(config)
    const status = manager.getServerStatus(config.id)

    return NextResponse.json({
      success: true,
      server: {
        ...config,
        status: status?.status || "stopped",
        error: status?.error,
      },
    })
  } catch (error) {
    console.error("[MCP API] PUT error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update MCP server" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/mcp
 * Remove an MCP server configuration
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json(
        { error: "Missing required parameter: id" },
        { status: 400 }
      )
    }

    const manager = getMCPManager()
    const existing = manager.getConfig(id)

    if (!existing) {
      return NextResponse.json(
        { error: `Server ${id} not found` },
        { status: 404 }
      )
    }

    manager.removeConfig(id)

    return NextResponse.json({
      success: true,
      removed: id,
    })
  } catch (error) {
    console.error("[MCP API] DELETE error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove MCP server" },
      { status: 500 }
    )
  }
}
