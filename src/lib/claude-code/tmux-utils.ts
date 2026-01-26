/**
 * Tmux Session Utilities for Claude Code
 *
 * Provides tmux session management with human-readable naming.
 */

import { execSync } from "child_process"

// ============================================
// TMUX SESSION PERSISTENCE CONFIGURATION
// ============================================
export const TMUX_SESSION_PREFIX = process.env.CLAUDE_CODE_TMUX_PREFIX || "claude-code"
// Default to true - users can disable via settings or env var
export const TMUX_ENABLED_DEFAULT = process.env.CLAUDE_CODE_USE_TMUX !== "false"

// Check if tmux is available on the system
let tmuxAvailableCache: boolean | null = null

export function isTmuxAvailable(): boolean {
  if (tmuxAvailableCache !== null) return tmuxAvailableCache

  try {
    execSync("which tmux", { stdio: "pipe" })
    tmuxAvailableCache = true
    console.log("[claude-code] tmux is available for session persistence")
  } catch {
    tmuxAvailableCache = false
    console.log("[claude-code] tmux not found - sessions will not persist across reconnects")
  }
  return tmuxAvailableCache
}

// Get tmux session name for a terminal (human-readable with label)
export function getTmuxSessionName(terminalId: string, label?: string): string {
  if (label) {
    // Create human-readable name from label
    const sanitized = label
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 20)
    const shortId = terminalId.slice(0, 4)
    return `${TMUX_SESSION_PREFIX}-${sanitized}-${shortId}`
  }
  return `${TMUX_SESSION_PREFIX}-${terminalId}`
}

// Check if a tmux session exists
export function tmuxSessionExists(sessionName: string): boolean {
  try {
    execSync(`tmux has-session -t ${sessionName} 2>/dev/null`, { stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

// List all claude-code tmux sessions
export function listClaudeCodeTmuxSessions(): string[] {
  try {
    const output = execSync(`tmux list-sessions -F "#{session_name}" 2>/dev/null`, {
      encoding: "utf-8",
    })
    return output
      .split("\n")
      .filter((s) => s.startsWith(TMUX_SESSION_PREFIX))
  } catch {
    return []
  }
}

// Get detailed info about tmux sessions
export interface TmuxSessionInfo {
  name: string
  created: string
  attached: boolean
  windows: number
}

export function getTmuxSessionsInfo(): TmuxSessionInfo[] {
  try {
    const output = execSync(
      `tmux list-sessions -F "#{session_name}|#{session_created}|#{session_attached}|#{session_windows}" 2>/dev/null`,
      { encoding: "utf-8" }
    )
    return output
      .split("\n")
      .filter((s) => s.startsWith(TMUX_SESSION_PREFIX))
      .map((line) => {
        const [name, created, attached, windows] = line.split("|")
        return {
          name,
          created: new Date(parseInt(created) * 1000).toISOString(),
          attached: attached === "1",
          windows: parseInt(windows) || 1,
        }
      })
  } catch {
    return []
  }
}

// Kill a specific tmux session
export function killTmuxSession(sessionName: string): boolean {
  try {
    execSync(`tmux kill-session -t ${sessionName} 2>/dev/null`, { stdio: "pipe" })
    console.log(`[claude-code] Killed tmux session: ${sessionName}`)
    return true
  } catch {
    return false
  }
}

// Kill all claude-code tmux sessions
export function killAllTmuxSessions(): number {
  const sessions = listClaudeCodeTmuxSessions()
  let killed = 0
  for (const session of sessions) {
    if (killTmuxSession(session)) {
      killed++
    }
  }
  return killed
}
