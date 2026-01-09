/**
 * MCP Tools API
 *
 * POST /api/mcp/tools - Get tools from MCP servers
 */

import { NextRequest, NextResponse } from "next/server"
import { getMCPManager } from "@/lib/mcp"
import { ProviderType } from "@/lib/mcp/types"

/**
 * POST /api/mcp/tools
 * Get available tools from MCP servers
 *
 * Body:
 *   - serverId?: string - Get tools from a specific server (optional)
 *   - provider?: "claude" | "openai" | "gemini" | "lmstudio" - Format for provider (optional)
 *
 * If serverId is not provided, returns tools from all running servers.
 * If provider is specified, returns tools in that provider's format.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const manager = getMCPManager()

    const serverId = body.serverId as string | undefined
    const provider = body.provider as ProviderType | undefined

    // Get tools from specific server or all servers
    if (serverId) {
      // Check if server exists
      const config = manager.getConfig(serverId)
      if (!config) {
        return NextResponse.json(
          { error: `Server ${serverId} not found` },
          { status: 404 }
        )
      }

      // Check if server is running
      if (!manager.isServerRunning(serverId)) {
        return NextResponse.json(
          { error: `Server ${serverId} is not running` },
          { status: 400 }
        )
      }

      const tools = await manager.getServerTools(serverId)

      // Format for provider if specified
      if (provider) {
        const { ToolTranslator } = await import("@/lib/mcp/client")
        const formattedTools = ToolTranslator.translateTools(tools, provider)
        return NextResponse.json({
          serverId,
          serverName: config.name,
          provider,
          tools: formattedTools,
          count: formattedTools.length,
        })
      }

      return NextResponse.json({
        serverId,
        serverName: config.name,
        tools,
        count: tools.length,
      })
    }

    // Get all tools from all running servers
    const allTools = await manager.getAllTools()

    // Format for provider if specified
    if (provider) {
      const { ToolTranslator } = await import("@/lib/mcp/client")
      const mcpTools = allTools.map((t) => t.mcpTool)
      const formattedTools = ToolTranslator.translateTools(mcpTools, provider)

      return NextResponse.json({
        provider,
        tools: formattedTools,
        count: formattedTools.length,
        servers: [...new Set(allTools.map((t) => t.serverName))],
      })
    }

    // Return unified format with server info
    return NextResponse.json({
      tools: allTools.map((t) => ({
        name: t.name,
        description: t.description,
        serverId: t.serverId,
        serverName: t.serverName,
        inputSchema: t.mcpTool.inputSchema,
      })),
      count: allTools.length,
      servers: [...new Set(allTools.map((t) => t.serverName))],
    })
  } catch (error) {
    console.error("[MCP API] Tools error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get tools" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/mcp/tools
 * Quick endpoint to list all available tools
 */
export async function GET() {
  try {
    const manager = getMCPManager()
    const allTools = await manager.getAllTools()

    return NextResponse.json({
      tools: allTools.map((t) => ({
        name: t.name,
        description: t.description,
        serverId: t.serverId,
        serverName: t.serverName,
      })),
      count: allTools.length,
      runningServers: manager.getRunningCount(),
    })
  } catch (error) {
    console.error("[MCP API] Tools GET error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get tools" },
      { status: 500 }
    )
  }
}
