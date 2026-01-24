/**
 * Dev Tools Registry
 *
 * Configuration registry for all development tools
 */

import { exec } from "child_process"
import { promisify } from "util"
import { existsSync } from "fs"
import path from "path"
import os from "os"
import { DevToolConfig, DevToolId, DevToolStatus, InstallStatus } from "./types"

const execAsync = promisify(exec)

// Tool configurations
export const DEV_TOOLS: Record<DevToolId, DevToolConfig> = {
  "claude-code": {
    id: "claude-code",
    name: "Claude Code",
    description: "Anthropic's AI coding assistant CLI",
    sessionType: "terminal",
    icon: "Terminal",
    color: "text-orange-500",

    binaryNames: ["claude"],
    binaryPaths: [
      path.join(os.homedir(), ".local/bin/claude"),
      "/usr/local/bin/claude",
      "/usr/bin/claude",
    ],
    versionCommand: "claude --version",

    installCommand: "npm install -g @anthropic-ai/claude-code",
    installUrl: "https://www.npmjs.com/package/@anthropic-ai/claude-code",
    installInstructions: `Install Claude Code CLI:
npm install -g @anthropic-ai/claude-code

Or if using yarn:
yarn global add @anthropic-ai/claude-code

After installation, run 'claude' to authenticate.`,
  },

  ganesha: {
    id: "ganesha",
    name: "Ganesha AI",
    description: "Ganesha AI coding assistant with flux mode",
    sessionType: "terminal",
    icon: "Sparkles",
    color: "text-purple-500",

    binaryNames: ["ganesha"],
    binaryPaths: [
      path.join(os.homedir(), ".local/bin/ganesha"),
      "/usr/local/bin/ganesha",
      "/usr/bin/ganesha",
    ],
    versionCommand: "ganesha --version",

    installCommand: "curl -sSL https://ganesha.dev/install.sh | bash",
    installUrl: "https://ganesha.dev",
    installInstructions: `Install Ganesha AI:
curl -sSL https://ganesha.dev/install.sh | bash

Or download manually from https://ganesha.dev/download

After installation, run 'ganesha' to authenticate.`,
  },

  vscode: {
    id: "vscode",
    name: "VS Code",
    description: "Visual Studio Code via code-server",
    sessionType: "iframe",
    icon: "Code2",
    color: "text-blue-500",

    binaryNames: ["code-server"],
    binaryPaths: [
      path.join(os.homedir(), ".local/bin/code-server"),
      "/usr/local/bin/code-server",
      "/usr/bin/code-server",
    ],
    versionCommand: "code-server --version",

    installCommand: "curl -fsSL https://code-server.dev/install.sh | sh",
    installUrl: "https://coder.com/docs/code-server/latest",
    installInstructions: `Install code-server:
curl -fsSL https://code-server.dev/install.sh | sh

Or on macOS with Homebrew:
brew install code-server

After installation, code-server will be available at http://localhost:8080`,

    defaultPort: 8100,
    portRange: [8100, 8199],
  },
}

/**
 * Get all tool configurations
 */
export function getAllToolConfigs(): DevToolConfig[] {
  return Object.values(DEV_TOOLS)
}

/**
 * Get a specific tool configuration
 */
export function getToolConfig(toolId: DevToolId): DevToolConfig | undefined {
  return DEV_TOOLS[toolId]
}

/**
 * Check if a command exists in PATH
 */
async function checkCommand(command: string): Promise<{ available: boolean; path?: string; error?: string }> {
  try {
    const isWindows = process.platform === "win32"
    const whichCommand = isWindows ? "where" : "which"

    const { stdout } = await execAsync(`${whichCommand} ${command}`)
    return {
      available: true,
      path: stdout.trim().split("\n")[0],
    }
  } catch {
    return {
      available: false,
      error: `${command} not found in PATH`,
    }
  }
}

/**
 * Get version of a command
 */
async function getVersion(versionCommand: string): Promise<string | undefined> {
  try {
    const { stdout, stderr } = await execAsync(versionCommand)
    const output = stdout.trim() || stderr.trim()
    // Extract version number
    const versionMatch = output.match(/v?(\d+\.\d+\.?\d*)/i)
    return versionMatch ? versionMatch[0] : output.split("\n")[0]
  } catch {
    return undefined
  }
}

/**
 * Find a tool's binary path
 */
export function findBinaryPath(toolId: DevToolId): string | null {
  const config = DEV_TOOLS[toolId]
  if (!config) return null

  // Check known paths first
  for (const binaryPath of config.binaryPaths) {
    if (existsSync(binaryPath)) {
      return binaryPath
    }
  }

  // Return first binary name for PATH lookup
  return config.binaryNames[0]
}

/**
 * Check if a tool is installed
 */
export async function checkToolInstalled(toolId: DevToolId): Promise<DevToolStatus> {
  const config = DEV_TOOLS[toolId]
  if (!config) {
    return {
      id: toolId,
      name: toolId,
      status: "error" as InstallStatus,
      error: "Unknown tool",
      lastChecked: new Date().toISOString(),
    }
  }

  // Check each binary name
  for (const binaryName of config.binaryNames) {
    const cmdCheck = await checkCommand(binaryName)
    if (cmdCheck.available) {
      const version = await getVersion(config.versionCommand)
      return {
        id: toolId,
        name: config.name,
        status: "installed" as InstallStatus,
        version,
        binaryPath: cmdCheck.path,
        lastChecked: new Date().toISOString(),
      }
    }
  }

  // Also check known paths directly
  for (const binaryPath of config.binaryPaths) {
    if (existsSync(binaryPath)) {
      const version = await getVersion(config.versionCommand)
      return {
        id: toolId,
        name: config.name,
        status: "installed" as InstallStatus,
        version,
        binaryPath,
        lastChecked: new Date().toISOString(),
      }
    }
  }

  return {
    id: toolId,
    name: config.name,
    status: "not-installed" as InstallStatus,
    lastChecked: new Date().toISOString(),
  }
}

/**
 * Check all tools installation status
 */
export async function checkAllTools(): Promise<DevToolStatus[]> {
  const toolIds = Object.keys(DEV_TOOLS) as DevToolId[]
  const results = await Promise.all(toolIds.map(id => checkToolInstalled(id)))
  return results
}

/**
 * Get install instructions for a tool
 */
export function getInstallInstructions(toolId: DevToolId): string {
  const config = DEV_TOOLS[toolId]
  return config?.installInstructions || `Installation instructions not available for ${toolId}`
}

/**
 * Get the install command for a tool
 */
export function getInstallCommand(toolId: DevToolId): string {
  const config = DEV_TOOLS[toolId]
  return config?.installCommand || ""
}
