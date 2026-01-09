/**
 * MCP Server Storage Service
 * Manages MCP server configurations in localStorage and Claude Desktop config
 */

import {
  MCPManagedServer,
  MCPStorageData,
  ClaudeDesktopConfig,
  ClaudeDesktopMCPServer
} from "./types"

const STORAGE_KEY = "claudia-mcp-servers"
const STORAGE_VERSION = "1.0"

// Generate unique ID for servers
export function generateServerId(): string {
  return `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// ============================================
// localStorage Operations
// ============================================

export function getMCPServers(): MCPManagedServer[] {
  if (typeof window === "undefined") return []

  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []

    const parsed: MCPStorageData = JSON.parse(data)
    return parsed.servers || []
  } catch (error) {
    console.error("Error reading MCP servers from localStorage:", error)
    return []
  }
}

export function saveMCPServers(servers: MCPManagedServer[]): void {
  if (typeof window === "undefined") return

  const data: MCPStorageData = {
    servers,
    version: STORAGE_VERSION
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function addMCPServer(server: Omit<MCPManagedServer, "id" | "createdAt" | "updatedAt" | "status">): MCPManagedServer {
  const servers = getMCPServers()

  const newServer: MCPManagedServer = {
    ...server,
    id: generateServerId(),
    status: "stopped",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  servers.push(newServer)
  saveMCPServers(servers)

  return newServer
}

export function updateMCPServer(id: string, updates: Partial<MCPManagedServer>): MCPManagedServer | null {
  const servers = getMCPServers()
  const index = servers.findIndex(s => s.id === id)

  if (index === -1) return null

  servers[index] = {
    ...servers[index],
    ...updates,
    updatedAt: new Date().toISOString()
  }

  saveMCPServers(servers)
  return servers[index]
}

export function deleteMCPServer(id: string): boolean {
  const servers = getMCPServers()
  const index = servers.findIndex(s => s.id === id)

  if (index === -1) return false

  servers.splice(index, 1)
  saveMCPServers(servers)

  return true
}

export function toggleMCPServer(id: string): MCPManagedServer | null {
  const servers = getMCPServers()
  const server = servers.find(s => s.id === id)

  if (!server) return null

  return updateMCPServer(id, { enabled: !server.enabled })
}

export function getMCPServersByScope(scope: "global" | "project", projectId?: string): MCPManagedServer[] {
  const servers = getMCPServers()

  if (scope === "global") {
    return servers.filter(s => s.scope === "global")
  }

  return servers.filter(s => s.scope === "project" && s.projectId === projectId)
}

// ============================================
// Claude Desktop Config Operations
// ============================================

export function buildClaudeDesktopConfig(servers: MCPManagedServer[]): ClaudeDesktopConfig {
  const mcpServers: Record<string, ClaudeDesktopMCPServer> = {}

  // Only include enabled servers
  servers
    .filter(s => s.enabled)
    .forEach(server => {
      mcpServers[server.name] = {
        command: server.command,
        args: server.args.length > 0 ? server.args : undefined,
        env: server.env && Object.keys(server.env).length > 0 ? server.env : undefined
      }
    })

  return { mcpServers }
}

export async function writeClaudeDesktopConfig(servers: MCPManagedServer[]): Promise<{ success: boolean; error?: string }> {
  const config = buildClaudeDesktopConfig(servers)

  try {
    const response = await fetch("/api/mcp/write-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config)
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.message || "Failed to write config" }
    }

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

export async function readClaudeDesktopConfig(): Promise<{ config: ClaudeDesktopConfig | null; error?: string }> {
  try {
    const response = await fetch("/api/mcp/read-config")

    if (!response.ok) {
      const error = await response.json()
      return { config: null, error: error.message || "Failed to read config" }
    }

    const config = await response.json()
    return { config }
  } catch (error) {
    return {
      config: null,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

// ============================================
// Sync Operations
// ============================================

export async function syncToClaudeDesktop(): Promise<{ success: boolean; error?: string }> {
  const servers = getMCPServers()
  return writeClaudeDesktopConfig(servers)
}

export async function importFromClaudeDesktop(): Promise<{
  success: boolean
  imported: number
  error?: string
}> {
  const { config, error } = await readClaudeDesktopConfig()

  if (error || !config) {
    return { success: false, imported: 0, error }
  }

  if (!config.mcpServers) {
    return { success: true, imported: 0 }
  }

  const existingServers = getMCPServers()
  const existingNames = new Set(existingServers.map(s => s.name))
  let imported = 0

  for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
    if (!existingNames.has(name)) {
      addMCPServer({
        name,
        command: serverConfig.command,
        args: serverConfig.args || [],
        env: serverConfig.env,
        scope: "global",
        enabled: true
      })
      imported++
    }
  }

  return { success: true, imported }
}
