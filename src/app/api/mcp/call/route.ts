/**
 * MCP Tool Call API
 *
 * POST /api/mcp/call - Call a tool on an MCP server
 */

import { NextRequest, NextResponse } from "next/server"
import { getMCPManager } from "@/lib/mcp"
import { ToolTranslator } from "@/lib/mcp/client"
import { ProviderType, MCPToolCall } from "@/lib/mcp/types"

/**
 * POST /api/mcp/call
 * Call a tool on an MCP server
 *
 * Body:
 *   - name: string - Tool name
 *   - arguments: object - Tool arguments
 *   - serverId?: string - Target server (optional, will auto-find if not specified)
 *   - provider?: "claude" | "openai" | "gemini" | "lmstudio" - Provider format for result
 *   - providerCall?: object - Provider-specific call format (alternative to name/arguments)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const manager = getMCPManager()

    const provider = body.provider as ProviderType | undefined
    const serverId = body.serverId as string | undefined

    // Parse tool call - either from provider format or direct MCP format
    let toolCall: MCPToolCall

    if (body.providerCall && provider) {
      // Parse from provider-specific format
      toolCall = ToolTranslator.parseToolCall(body.providerCall, provider)
    } else if (body.name) {
      // Direct MCP format
      toolCall = {
        name: body.name,
        arguments: body.arguments || {},
      }
    } else {
      return NextResponse.json(
        { error: "Missing required field: name (or providerCall with provider)" },
        { status: 400 }
      )
    }

    // Call the tool
    let result

    if (serverId) {
      // Call on specific server
      if (!manager.isServerRunning(serverId)) {
        return NextResponse.json(
          { error: `Server ${serverId} is not running` },
          { status: 400 }
        )
      }
      result = await manager.callToolOnServer(serverId, toolCall)
    } else {
      // Auto-find server with this tool
      const server = manager.findToolServer(toolCall.name)
      if (!server) {
        return NextResponse.json(
          { error: `Tool "${toolCall.name}" not found on any running server` },
          { status: 404 }
        )
      }
      result = await manager.callTool(toolCall)
    }

    // Format result for provider if specified
    if (provider) {
      const formattedResult = ToolTranslator.formatToolResult(result, provider)
      return NextResponse.json({
        success: !result.isError,
        toolName: toolCall.name,
        provider,
        result: formattedResult,
        raw: result,
      })
    }

    // Return raw MCP result
    return NextResponse.json({
      success: !result.isError,
      toolName: toolCall.name,
      result,
    })
  } catch (error) {
    console.error("[MCP API] Call error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to call tool" },
      { status: 500 }
    )
  }
}

/**
 * Batch call multiple tools
 * POST /api/mcp/call with { batch: true, calls: [...] }
 */
async function handleBatchCall(
  calls: Array<{ name: string; arguments?: Record<string, unknown>; serverId?: string }>,
  provider?: ProviderType
) {
  const manager = getMCPManager()
  const results: Array<{
    toolName: string
    success: boolean
    result?: unknown
    error?: string
  }> = []

  for (const call of calls) {
    try {
      const toolCall: MCPToolCall = {
        name: call.name,
        arguments: call.arguments || {},
      }

      let result
      if (call.serverId) {
        result = await manager.callToolOnServer(call.serverId, toolCall)
      } else {
        result = await manager.callTool(toolCall)
      }

      if (provider) {
        const formattedResult = ToolTranslator.formatToolResult(result, provider)
        results.push({
          toolName: call.name,
          success: !result.isError,
          result: formattedResult,
        })
      } else {
        results.push({
          toolName: call.name,
          success: !result.isError,
          result,
        })
      }
    } catch (error) {
      results.push({
        toolName: call.name,
        success: false,
        error: error instanceof Error ? error.message : "Failed to call tool",
      })
    }
  }

  return {
    success: results.every((r) => r.success),
    results,
    successCount: results.filter((r) => r.success).length,
    failCount: results.filter((r) => !r.success).length,
  }
}

// Export for use in other handlers
export { handleBatchCall }
