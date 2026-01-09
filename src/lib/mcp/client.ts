/**
 * MCP Client
 *
 * Connects to MCP servers and translates tools to provider-specific formats.
 * Supports: Claude (native), OpenAI, Gemini, LM Studio
 */

import { spawn, ChildProcess } from "child_process"
import {
  MCPToolDefinition,
  MCPToolCall,
  MCPToolResult,
  MCPRequest,
  MCPResponse,
  ProviderType,
  OpenAITool,
  GeminiFunction,
  ClaudeTool,
  MCPServerConfig,
} from "./types"

export class MCPClient {
  private process: ChildProcess | null = null
  private config: MCPServerConfig
  private messageId = 0
  private pendingRequests = new Map<string | number, {
    resolve: (value: unknown) => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout
  }>()
  private buffer = ""
  private initialized = false
  private tools: MCPToolDefinition[] = []

  constructor(config: MCPServerConfig) {
    this.config = config
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.process) {
      throw new Error("Already connected")
    }

    return new Promise((resolve, reject) => {
      const env = {
        ...process.env,
        ...this.config.env,
      }

      this.process = spawn(this.config.command, this.config.args || [], {
        env,
        stdio: ["pipe", "pipe", "pipe"],
      })

      this.process.stdout?.on("data", (data) => {
        this.handleData(data.toString())
      })

      this.process.stderr?.on("data", (data) => {
        console.error(`[MCP ${this.config.name}] stderr:`, data.toString())
      })

      this.process.on("error", (error) => {
        console.error(`[MCP ${this.config.name}] process error:`, error)
        reject(error)
      })

      this.process.on("close", (code) => {
        console.log(`[MCP ${this.config.name}] process closed with code:`, code)
        this.cleanup()
      })

      // Initialize the MCP connection
      this.initialize()
        .then(() => {
          this.initialized = true
          resolve()
        })
        .catch(reject)
    })
  }

  /**
   * Handle incoming data from the MCP server
   */
  private handleData(data: string): void {
    this.buffer += data

    // MCP uses JSON-RPC over stdin/stdout with newline separators
    const lines = this.buffer.split("\n")
    this.buffer = lines.pop() || ""

    for (const line of lines) {
      if (!line.trim()) continue

      try {
        const message = JSON.parse(line) as MCPResponse
        const pending = this.pendingRequests.get(message.id)

        if (pending) {
          clearTimeout(pending.timeout)
          this.pendingRequests.delete(message.id)

          if (message.error) {
            pending.reject(new Error(message.error.message))
          } else {
            pending.resolve(message.result)
          }
        }
      } catch (error) {
        console.error(`[MCP ${this.config.name}] parse error:`, error, "line:", line)
      }
    }
  }

  /**
   * Send a request to the MCP server
   */
  private async sendRequest<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.process?.stdin) {
      throw new Error("Not connected")
    }

    const id = ++this.messageId
    const request: MCPRequest = {
      jsonrpc: "2.0",
      id,
      method,
      params,
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request ${method} timed out`))
      }, 30000)

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      })

      this.process!.stdin!.write(JSON.stringify(request) + "\n")
    })
  }

  /**
   * Initialize the MCP connection
   */
  private async initialize(): Promise<void> {
    await this.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
      clientInfo: {
        name: "claudia-admin",
        version: "1.0.0",
      },
    })

    // Send initialized notification
    if (this.process?.stdin) {
      this.process.stdin.write(JSON.stringify({
        jsonrpc: "2.0",
        method: "initialized",
      }) + "\n")
    }
  }

  /**
   * Get available tools from the server
   */
  async listTools(): Promise<MCPToolDefinition[]> {
    if (!this.initialized) {
      throw new Error("Not initialized")
    }

    const result = await this.sendRequest<{ tools: MCPToolDefinition[] }>("tools/list")
    this.tools = result.tools || []
    return this.tools
  }

  /**
   * Call a tool on the server
   */
  async callTool(call: MCPToolCall): Promise<MCPToolResult> {
    if (!this.initialized) {
      throw new Error("Not initialized")
    }

    const result = await this.sendRequest<MCPToolResult>("tools/call", {
      name: call.name,
      arguments: call.arguments,
    })

    return result
  }

  /**
   * Disconnect from the MCP server
   */
  disconnect(): void {
    if (this.process) {
      this.process.kill()
      this.cleanup()
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error("Connection closed"))
    }
    this.pendingRequests.clear()
    this.process = null
    this.initialized = false
    this.buffer = ""
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.process !== null && this.initialized
  }

  /**
   * Get the server configuration
   */
  getConfig(): MCPServerConfig {
    return this.config
  }

  /**
   * Get cached tools
   */
  getCachedTools(): MCPToolDefinition[] {
    return this.tools
  }

  /**
   * Get process ID
   */
  getPid(): number | undefined {
    return this.process?.pid
  }
}

/**
 * Tool Format Translator
 * Converts MCP tools to provider-specific formats
 */
export class ToolTranslator {
  /**
   * Convert MCP tool to Claude native format
   */
  static toClaudeFormat(tool: MCPToolDefinition): ClaudeTool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: "object",
        properties: tool.inputSchema.properties,
        required: tool.inputSchema.required,
      },
    }
  }

  /**
   * Convert MCP tool to OpenAI function calling format
   * Works for OpenAI, LM Studio, and other OpenAI-compatible providers
   */
  static toOpenAIFormat(tool: MCPToolDefinition): OpenAITool {
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: tool.inputSchema.properties,
          required: tool.inputSchema.required,
        },
      },
    }
  }

  /**
   * Convert MCP tool to Gemini function format
   */
  static toGeminiFormat(tool: MCPToolDefinition): GeminiFunction {
    // Convert JSON Schema types to Gemini types
    const convertType = (type: string): string => {
      const typeMap: Record<string, string> = {
        string: "STRING",
        number: "NUMBER",
        integer: "INTEGER",
        boolean: "BOOLEAN",
        array: "ARRAY",
        object: "OBJECT",
      }
      return typeMap[type] || "STRING"
    }

    const properties: Record<string, { type: string; description?: string; enum?: string[] }> = {}

    if (tool.inputSchema.properties) {
      for (const [key, prop] of Object.entries(tool.inputSchema.properties)) {
        properties[key] = {
          type: convertType(prop.type),
          description: prop.description,
          enum: prop.enum,
        }
      }
    }

    return {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "OBJECT",
        properties,
        required: tool.inputSchema.required,
      },
    }
  }

  /**
   * Convert multiple tools to a specific provider format
   */
  static translateTools(
    tools: MCPToolDefinition[],
    provider: ProviderType
  ): ClaudeTool[] | OpenAITool[] | GeminiFunction[] {
    switch (provider) {
      case "claude":
        return tools.map((t) => this.toClaudeFormat(t))
      case "openai":
      case "lmstudio":
        return tools.map((t) => this.toOpenAIFormat(t))
      case "gemini":
        return tools.map((t) => this.toGeminiFormat(t))
      default:
        throw new Error(`Unknown provider: ${provider}`)
    }
  }

  /**
   * Parse tool call from provider-specific format
   */
  static parseToolCall(
    call: unknown,
    provider: ProviderType
  ): MCPToolCall {
    switch (provider) {
      case "claude": {
        const claudeCall = call as { name: string; input: Record<string, unknown> }
        return {
          name: claudeCall.name,
          arguments: claudeCall.input,
        }
      }
      case "openai":
      case "lmstudio": {
        const openaiCall = call as { function: { name: string; arguments: string } }
        return {
          name: openaiCall.function.name,
          arguments: JSON.parse(openaiCall.function.arguments),
        }
      }
      case "gemini": {
        const geminiCall = call as { name: string; args: Record<string, unknown> }
        return {
          name: geminiCall.name,
          arguments: geminiCall.args,
        }
      }
      default:
        throw new Error(`Unknown provider: ${provider}`)
    }
  }

  /**
   * Format tool result for provider-specific response
   */
  static formatToolResult(
    result: MCPToolResult,
    provider: ProviderType
  ): unknown {
    // Extract text content
    const textContent = result.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n")

    switch (provider) {
      case "claude":
        return {
          type: "tool_result",
          content: result.content.map((c) => {
            if (c.type === "text") {
              return { type: "text", text: c.text }
            }
            if (c.type === "image") {
              return {
                type: "image",
                source: {
                  type: "base64",
                  media_type: c.mimeType,
                  data: c.data,
                },
              }
            }
            return { type: "text", text: JSON.stringify(c) }
          }),
          is_error: result.isError,
        }
      case "openai":
      case "lmstudio":
        return {
          role: "tool",
          content: textContent || JSON.stringify(result.content),
        }
      case "gemini":
        return {
          functionResponse: {
            response: result.isError ? { error: textContent } : { result: textContent },
          },
        }
      default:
        return result
    }
  }
}
