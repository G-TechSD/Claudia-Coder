/**
 * MCP Server Manager
 *
 * Manages the lifecycle of MCP servers:
 * - Start/stop servers
 * - Track running servers
 * - Get available tools
 * - Route tool calls to appropriate server
 */

import { MCPClient, ToolTranslator } from "./client"
import {
  MCPServerConfig,
  MCPServerStatus,
  MCPToolDefinition,
  MCPToolCall,
  MCPToolResult,
  ProviderType,
  UnifiedTool,
  ClaudeTool,
  OpenAITool,
  GeminiFunction,
} from "./types"

export class MCPServerManager {
  private static instance: MCPServerManager
  private clients = new Map<string, MCPClient>()
  private configs = new Map<string, MCPServerConfig>()
  private statuses = new Map<string, MCPServerStatus>()

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): MCPServerManager {
    if (!MCPServerManager.instance) {
      MCPServerManager.instance = new MCPServerManager()
    }
    return MCPServerManager.instance
  }

  /**
   * Add a server configuration
   */
  addConfig(config: MCPServerConfig): void {
    this.configs.set(config.id, config)
    this.statuses.set(config.id, {
      id: config.id,
      name: config.name,
      status: "stopped",
    })
  }

  /**
   * Remove a server configuration
   */
  removeConfig(id: string): void {
    this.stopServer(id).catch(console.error)
    this.configs.delete(id)
    this.statuses.delete(id)
  }

  /**
   * Update a server configuration
   */
  updateConfig(config: MCPServerConfig): void {
    const wasRunning = this.clients.has(config.id)
    if (wasRunning) {
      this.stopServer(config.id).catch(console.error)
    }
    this.configs.set(config.id, config)
    if (wasRunning && config.enabled) {
      this.startServer(config.id).catch(console.error)
    }
  }

  /**
   * Get all server configurations
   */
  getConfigs(): MCPServerConfig[] {
    return Array.from(this.configs.values())
  }

  /**
   * Get a specific server configuration
   */
  getConfig(id: string): MCPServerConfig | undefined {
    return this.configs.get(id)
  }

  /**
   * Start an MCP server
   */
  async startServer(id: string): Promise<MCPServerStatus> {
    const config = this.configs.get(id)
    if (!config) {
      throw new Error(`Server ${id} not found`)
    }

    if (!config.enabled) {
      throw new Error(`Server ${id} is disabled`)
    }

    // Check if already running
    if (this.clients.has(id)) {
      const status = this.statuses.get(id)
      if (status?.status === "running") {
        return status
      }
    }

    // Update status to starting
    this.statuses.set(id, {
      id,
      name: config.name,
      status: "starting",
      lastStarted: new Date().toISOString(),
    })

    try {
      const client = new MCPClient(config)
      await client.connect()

      // Get tools after connecting
      const tools = await client.listTools()

      this.clients.set(id, client)

      const status: MCPServerStatus = {
        id,
        name: config.name,
        status: "running",
        pid: client.getPid(),
        tools,
        lastStarted: new Date().toISOString(),
      }

      this.statuses.set(id, status)
      return status
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)

      const status: MCPServerStatus = {
        id,
        name: config.name,
        status: "error",
        error: errorMessage,
        lastError: new Date().toISOString(),
      }

      this.statuses.set(id, status)
      throw error
    }
  }

  /**
   * Stop an MCP server
   */
  async stopServer(id: string): Promise<MCPServerStatus> {
    const client = this.clients.get(id)
    const config = this.configs.get(id)

    if (client) {
      client.disconnect()
      this.clients.delete(id)
    }

    const status: MCPServerStatus = {
      id,
      name: config?.name || id,
      status: "stopped",
    }

    this.statuses.set(id, status)
    return status
  }

  /**
   * Get server status
   */
  getServerStatus(id: string): MCPServerStatus | undefined {
    return this.statuses.get(id)
  }

  /**
   * Get all server statuses
   */
  getAllStatuses(): MCPServerStatus[] {
    return Array.from(this.statuses.values())
  }

  /**
   * Get tools from a specific server
   */
  async getServerTools(id: string): Promise<MCPToolDefinition[]> {
    const client = this.clients.get(id)
    if (!client) {
      throw new Error(`Server ${id} is not running`)
    }

    return client.listTools()
  }

  /**
   * Get all tools from all running servers
   */
  async getAllTools(): Promise<UnifiedTool[]> {
    const allTools: UnifiedTool[] = []

    for (const [id, client] of this.clients) {
      const config = this.configs.get(id)
      if (!config) continue

      try {
        const tools = await client.listTools()
        for (const tool of tools) {
          allTools.push({
            name: tool.name,
            description: tool.description,
            serverId: id,
            serverName: config.name,
            mcpTool: tool,
          })
        }
      } catch (error) {
        console.error(`[MCPManager] Error getting tools from ${id}:`, error)
      }
    }

    return allTools
  }

  /**
   * Get all tools in a specific provider format
   */
  async getToolsForProvider(provider: ProviderType): Promise<ClaudeTool[] | OpenAITool[] | GeminiFunction[]> {
    const allTools = await this.getAllTools()
    const mcpTools = allTools.map((t) => t.mcpTool)
    return ToolTranslator.translateTools(mcpTools, provider)
  }

  /**
   * Find which server has a specific tool
   */
  findToolServer(toolName: string): { serverId: string; client: MCPClient } | null {
    for (const [id, client] of this.clients) {
      const tools = client.getCachedTools()
      if (tools.some((t) => t.name === toolName)) {
        return { serverId: id, client }
      }
    }
    return null
  }

  /**
   * Call a tool by name
   */
  async callTool(call: MCPToolCall): Promise<MCPToolResult> {
    const server = this.findToolServer(call.name)
    if (!server) {
      return {
        content: [{ type: "text", text: `Tool "${call.name}" not found on any running server` }],
        isError: true,
      }
    }

    return server.client.callTool(call)
  }

  /**
   * Call a tool on a specific server
   */
  async callToolOnServer(serverId: string, call: MCPToolCall): Promise<MCPToolResult> {
    const client = this.clients.get(serverId)
    if (!client) {
      return {
        content: [{ type: "text", text: `Server "${serverId}" is not running` }],
        isError: true,
      }
    }

    return client.callTool(call)
  }

  /**
   * Call tool from provider-specific format
   */
  async callToolFromProvider(
    call: unknown,
    provider: ProviderType
  ): Promise<{ result: MCPToolResult; formattedResult: unknown }> {
    const mcpCall = ToolTranslator.parseToolCall(call, provider)
    const result = await this.callTool(mcpCall)
    const formattedResult = ToolTranslator.formatToolResult(result, provider)

    return { result, formattedResult }
  }

  /**
   * Start all enabled servers
   */
  async startAllEnabled(): Promise<Map<string, MCPServerStatus>> {
    const results = new Map<string, MCPServerStatus>()

    for (const [id, config] of this.configs) {
      if (config.enabled && (config.autoStart ?? true)) {
        try {
          const status = await this.startServer(id)
          results.set(id, status)
        } catch (error) {
          console.error(`[MCPManager] Failed to start ${id}:`, error)
          results.set(id, this.statuses.get(id)!)
        }
      }
    }

    return results
  }

  /**
   * Stop all running servers
   */
  async stopAll(): Promise<void> {
    for (const id of this.clients.keys()) {
      await this.stopServer(id)
    }
  }

  /**
   * Check if a server is running
   */
  isServerRunning(id: string): boolean {
    const client = this.clients.get(id)
    return client?.isConnected() ?? false
  }

  /**
   * Get running server count
   */
  getRunningCount(): number {
    return this.clients.size
  }

  /**
   * Reload server configuration from storage
   */
  loadConfigs(configs: MCPServerConfig[]): void {
    this.configs.clear()
    for (const config of configs) {
      this.configs.set(config.id, config)
      if (!this.statuses.has(config.id)) {
        this.statuses.set(config.id, {
          id: config.id,
          name: config.name,
          status: "stopped",
        })
      }
    }
  }

  /**
   * Export configurations for storage
   */
  exportConfigs(): MCPServerConfig[] {
    return Array.from(this.configs.values())
  }
}

// Export singleton getter
export function getMCPManager(): MCPServerManager {
  return MCPServerManager.getInstance()
}
