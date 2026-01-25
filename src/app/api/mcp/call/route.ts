/**
 * MCP Tool Call API
 *
 * POST /api/mcp/call - Call a tool on an MCP server
 *
 * Security: User boundary validation for beta testers
 */

import { NextRequest, NextResponse } from "next/server"
import { getMCPManager } from "@/lib/mcp"
import { ToolTranslator } from "@/lib/mcp/client"
import { ProviderType, MCPToolCall } from "@/lib/mcp/types"
import {
  validateProjectPath,
  isPathProtected,
  canExecuteCommand,
  logSecurityEvent,
  getUserSandboxDir,
} from "@/lib/security/sandbox"

/**
 * Validate tool arguments for path-based tools
 * Ensures sandboxed users cannot access paths outside their sandbox
 */
function validateToolArguments(
  toolName: string,
  args: Record<string, unknown>,
  userId?: string,
  userRole?: string
): { valid: boolean; error?: string } {
  // Skip validation for admins
  const isAdmin = userRole === "admin" || userRole === "owner"
  if (isAdmin || !userId) {
    return { valid: true }
  }

  // List of tools that take path arguments
  const pathTools = [
    "read_file", "write_file", "edit_file", "create_file",
    "delete_file", "move_file", "copy_file",
    "list_directory", "create_directory", "delete_directory",
    "search_files", "grep", "find",
    "execute_command", "run_command", "bash", "shell",
  ]

  // Check if this is a path-based tool
  const toolLower = toolName.toLowerCase()
  const isPathTool = pathTools.some(pt => toolLower.includes(pt))

  if (!isPathTool) {
    return { valid: true }
  }

  // Check common path argument names
  const pathArgNames = ["path", "file", "directory", "dir", "target", "source", "dest", "destination", "cwd"]

  for (const argName of pathArgNames) {
    const value = args[argName]
    if (typeof value === "string" && value) {
      // Validate the path
      if (isPathProtected(value)) {
        logSecurityEvent({
          userId,
          eventType: "path_blocked",
          details: `MCP tool ${toolName} attempted to access protected path: ${value}`,
          inputPath: value,
        })
        return {
          valid: false,
          error: `Access denied: Path "${value}" is protected`,
        }
      }

      // For sandboxed users, ensure path is within sandbox
      const isBetaTester = userRole === "beta" || userRole === "beta_tester"
      if (isBetaTester) {
        const validation = validateProjectPath(value, userId, { requireInSandbox: true })
        if (!validation.valid) {
          logSecurityEvent({
            userId,
            eventType: "sandbox_violation",
            details: `MCP tool ${toolName} attempted sandbox escape: ${value}`,
            inputPath: value,
          })
          return {
            valid: false,
            error: validation.error || "Path outside sandbox",
          }
        }
      }
    }
  }

  // For command execution tools, validate the command
  const commandArgNames = ["command", "cmd", "script"]
  for (const argName of commandArgNames) {
    const value = args[argName]
    if (typeof value === "string" && value) {
      const cmdCheck = canExecuteCommand(value, userId)
      if (!cmdCheck.allowed) {
        logSecurityEvent({
          userId,
          eventType: "command_blocked",
          details: `MCP tool ${toolName} attempted blocked command: ${value}`,
          inputCommand: value,
        })
        return {
          valid: false,
          error: cmdCheck.reason || "Command blocked",
        }
      }
    }
  }

  return { valid: true }
}

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
 *   - userId?: string - User ID for sandbox isolation
 *   - userRole?: string - User role for permission checks
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const manager = getMCPManager()

    const provider = body.provider as ProviderType | undefined
    const serverId = body.serverId as string | undefined
    const userId = body.userId as string | undefined
    const userRole = body.userRole as string | undefined

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

    // ============================================
    // SECURITY: Validate tool arguments for sandboxed users
    // ============================================
    const validation = validateToolArguments(
      toolCall.name,
      toolCall.arguments,
      userId,
      userRole
    )

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: validation.error || "Access denied",
          code: "SANDBOX_VIOLATION",
          sandboxDir: userId ? getUserSandboxDir(userId) : undefined,
        },
        { status: 403 }
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
 *
 * Security: Validates each tool call for sandboxed users
 */
async function handleBatchCall(
  calls: Array<{ name: string; arguments?: Record<string, unknown>; serverId?: string }>,
  provider?: ProviderType,
  userId?: string,
  userRole?: string
) {
  const manager = getMCPManager()
  const results: Array<{
    toolName: string
    success: boolean
    result?: unknown
    error?: string
    blocked?: boolean
  }> = []

  for (const call of calls) {
    try {
      const toolCall: MCPToolCall = {
        name: call.name,
        arguments: call.arguments || {},
      }

      // Validate tool arguments for sandboxed users
      const validation = validateToolArguments(
        toolCall.name,
        toolCall.arguments,
        userId,
        userRole
      )

      if (!validation.valid) {
        results.push({
          toolName: call.name,
          success: false,
          error: validation.error || "Access denied",
          blocked: true,
        })
        continue
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

// Note: handleBatchCall is internal to this route and not exported
// If batch calls are needed from other modules, use the API endpoint instead
