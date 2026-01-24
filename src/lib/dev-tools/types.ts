/**
 * Dev Tools Types
 *
 * Unified types for all development tools: Claude Code, Ganesha AI, VS Code
 */

// Tool identifiers
export type DevToolId = "claude-code" | "ganesha" | "vscode"

// Tool session types
export type ToolSessionType = "terminal" | "iframe"

// Tool installation status
export type InstallStatus = "installed" | "not-installed" | "checking" | "installing" | "error"

// Tool status for the status API
export interface DevToolStatus {
  id: DevToolId
  name: string
  status: InstallStatus
  version?: string
  binaryPath?: string
  error?: string
  lastChecked?: string
}

// Tool configuration
export interface DevToolConfig {
  id: DevToolId
  name: string
  description: string
  sessionType: ToolSessionType
  icon: string // Lucide icon name
  color: string // Tailwind color class

  // Binary detection
  binaryNames: string[] // Possible binary names (e.g., ["claude", "claude-code"])
  binaryPaths: string[] // Common installation paths
  versionCommand: string // Command to get version (e.g., "claude --version")

  // Installation
  installCommand: string // Command to install the tool
  installUrl: string // URL for manual installation instructions
  installInstructions: string // Human-readable install instructions

  // Session configuration
  defaultPort?: number // For iframe-based tools
  portRange?: [number, number] // Port range for dynamic allocation
}

// Terminal session (for Claude Code, Ganesha)
export interface TerminalSession {
  id: string
  toolId: DevToolId
  projectId: string
  workingDirectory: string
  startedAt: Date
  status: "starting" | "running" | "stopped" | "error" | "background"
  pid?: number
  claudeSessionId?: string // For Claude Code resume functionality
  ganeshaSessionId?: string // For Ganesha resume functionality
  mode?: GaneshaMode // For Ganesha-specific modes
  userId?: string
  isSandboxed?: boolean
}

// Stored terminal session (persisted to file)
export interface StoredTerminalSession {
  id: string
  toolId: DevToolId
  projectId: string
  workingDirectory: string
  startedAt: string // ISO date string
  status: "starting" | "running" | "stopped" | "error" | "background"
  isBackground: boolean
  claudeSessionId?: string
  ganeshaSessionId?: string
  mode?: GaneshaMode
  lastActivity?: string
  userId?: string
  isSandboxed?: boolean
}

// Iframe session (for VS Code)
export interface IframeSession {
  id: string
  toolId: DevToolId
  projectId: string
  workingDirectory: string
  startedAt: Date
  status: "starting" | "running" | "stopped" | "error"
  port: number
  pid: number
  url: string
  userId?: string
}

// Stored iframe session (persisted to file)
export interface StoredIframeSession {
  id: string
  toolId: DevToolId
  projectId: string
  workingDirectory: string
  startedAt: string
  status: "starting" | "running" | "stopped" | "error"
  port: number
  pid: number
  url: string
  lastActivity?: string
  userId?: string
}

// Combined session type
export type DevToolSession = TerminalSession | IframeSession

// Ganesha-specific modes
export type GaneshaMode = "interactive" | "auto" | "flux"

// Ganesha session start options
export interface GaneshaSessionOptions {
  projectId: string
  workingDirectory: string
  mode?: GaneshaMode
  fluxDuration?: string // e.g., "30m", "1h", "2h"
  resumeLast?: boolean
  resumeSessionId?: string
  bypassPermissions?: boolean
  userId?: string
  userRole?: string
}

// VS Code session start options
export interface VSCodeSessionOptions {
  projectId: string
  workingDirectory: string
  userId?: string
  userRole?: string
}

// Installation progress event
export interface InstallProgressEvent {
  type: "output" | "error" | "status" | "complete"
  content?: string
  status?: InstallStatus
  error?: string
}

// API response types
export interface DevToolsStatusResponse {
  tools: DevToolStatus[]
  timestamp: string
  cached: boolean
}

export interface InstallStartResponse {
  success: boolean
  sessionId: string
  toolId: DevToolId
  message?: string
}

export interface GaneshaSessionResponse {
  success: boolean
  sessionId: string
  message: string
  pid?: number
  mode?: GaneshaMode
  resumed?: boolean
  continued?: boolean
  isSandboxed?: boolean
  sandboxDir?: string
}

export interface VSCodeSessionResponse {
  success: boolean
  instanceId: string
  port: number
  url: string
  pid: number
  message?: string
}

// List of running instances
export interface VSCodeInstancesResponse {
  instances: IframeSession[]
}
