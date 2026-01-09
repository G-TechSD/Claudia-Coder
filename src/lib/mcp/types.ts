/**
 * MCP Types and Interfaces
 * Shared types for MCP integration across all providers
 */

// MCP Tool Definition (from MCP protocol)
export interface MCPToolDefinition {
  name: string
  description?: string
  inputSchema: {
    type: "object"
    properties?: Record<string, {
      type: string
      description?: string
      enum?: string[]
      items?: { type: string }
      required?: boolean
    }>
    required?: string[]
  }
}

// Tool call request
export interface MCPToolCall {
  name: string
  arguments: Record<string, unknown>
}

// Tool call result
export interface MCPToolResult {
  content: Array<{
    type: "text" | "image" | "resource"
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}

// MCP Server Configuration
export interface MCPServerConfig {
  id: string
  name: string
  description?: string
  command: string
  args?: string[]
  env?: Record<string, string>
  enabled: boolean
  autoStart?: boolean
}

// MCP Server Status
export interface MCPServerStatus {
  id: string
  name: string
  status: "stopped" | "starting" | "running" | "error"
  error?: string
  pid?: number
  tools?: MCPToolDefinition[]
  lastStarted?: string
  lastError?: string
}

// Provider-specific tool formats
export type ProviderType = "claude" | "openai" | "gemini" | "lmstudio"

// OpenAI Function format
export interface OpenAIFunction {
  name: string
  description?: string
  parameters: {
    type: "object"
    properties?: Record<string, {
      type: string
      description?: string
      enum?: string[]
      items?: { type: string }
    }>
    required?: string[]
  }
}

// OpenAI Tool format (wraps function)
export interface OpenAITool {
  type: "function"
  function: OpenAIFunction
}

// Gemini Function Declaration
export interface GeminiFunction {
  name: string
  description?: string
  parameters: {
    type: "OBJECT"
    properties?: Record<string, {
      type: string
      description?: string
      enum?: string[]
    }>
    required?: string[]
  }
}

// Claude native tool format
export interface ClaudeTool {
  name: string
  description?: string
  input_schema: {
    type: "object"
    properties?: Record<string, {
      type: string
      description?: string
      enum?: string[]
      items?: { type: string }
    }>
    required?: string[]
  }
}

// Unified tool format for internal use
export interface UnifiedTool {
  name: string
  description?: string
  serverId: string
  serverName: string
  mcpTool: MCPToolDefinition
}

// MCP Message types (from MCP protocol)
export interface MCPRequest {
  jsonrpc: "2.0"
  id: string | number
  method: string
  params?: Record<string, unknown>
}

export interface MCPResponse {
  jsonrpc: "2.0"
  id: string | number
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

// MCP Protocol Methods
export type MCPMethod =
  | "initialize"
  | "initialized"
  | "tools/list"
  | "tools/call"
  | "resources/list"
  | "resources/read"
  | "prompts/list"
  | "prompts/get"

// ============================================
// MCP Server Manager Types
// ============================================

export type MCPScope = "global" | "project"

export interface MCPEnvironmentVariable {
  key: string
  value: string
}

export interface MCPManagedServer {
  id: string
  name: string
  command: string
  args: string[]
  env?: Record<string, string>
  scope: MCPScope
  projectId?: string // Only set if scope is "project"
  enabled: boolean
  status: "running" | "stopped" | "error" | "unknown"
  lastError?: string
  createdAt: string
  updatedAt: string
}

export interface MCPServerTemplate {
  id: string
  name: string
  description: string
  command: string
  args: string[]
  env?: Record<string, string>
  envPlaceholders?: Record<string, string> // Placeholder descriptions for env vars
  category: string
  icon?: string
  documentation?: string
}

// Claude Desktop config format (for writing to ~/.claude/claude_desktop_config.json)
export interface ClaudeDesktopConfig {
  mcpServers?: Record<string, ClaudeDesktopMCPServer>
}

export interface ClaudeDesktopMCPServer {
  command: string
  args?: string[]
  env?: Record<string, string>
}

// Storage format for Claudia Coder localStorage
export interface MCPStorageData {
  servers: MCPManagedServer[]
  version: string
}
