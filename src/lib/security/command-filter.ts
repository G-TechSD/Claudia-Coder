/**
 * Command Filter Module
 *
 * Provides real-time filtering of commands sent to Claude Code sessions.
 * Prevents beta testers from executing commands that could access protected paths
 * or perform dangerous operations.
 */

import {
  PROTECTED_FILE_PATTERNS,
  BLOCKED_COMMAND_PATTERNS,
  isPathProtected,
  getUserSandboxDir,
  logSecurityEvent,
} from "./sandbox"

// ============================================
// Command Pattern Definitions
// ============================================

/**
 * Patterns that indicate file system navigation commands
 */
const FILE_NAVIGATION_COMMANDS = [
  "cd",
  "pushd",
  "popd",
]

/**
 * Patterns that indicate file reading commands
 */
const FILE_READ_COMMANDS = [
  "cat",
  "less",
  "more",
  "head",
  "tail",
  "bat",  // bat (better cat)
  "view",
  "vim",
  "vi",
  "nano",
  "code",
  "subl",
  "atom",
]

/**
 * Patterns that indicate file writing/modification commands
 */
const FILE_WRITE_COMMANDS = [
  "touch",
  "mkdir",
  "rm",
  "rmdir",
  "mv",
  "cp",
  "ln",
  "chmod",
  "chown",
  "echo",  // when redirecting
  "tee",
]

/**
 * Patterns that indicate listing/searching commands
 */
const FILE_SEARCH_COMMANDS = [
  "ls",
  "dir",
  "find",
  "locate",
  "grep",
  "rg",
  "ag",
  "fd",
  "tree",
]

/**
 * Dangerous commands that should always be blocked
 */
const ALWAYS_BLOCKED_COMMANDS = [
  "sudo",
  "su",
  "passwd",
  "useradd",
  "userdel",
  "usermod",
  "groupadd",
  "groupdel",
  "groupmod",
  "visudo",
  "mount",
  "umount",
  "fdisk",
  "mkfs",
  "dd",
  "systemctl",
  "service",
  "init",
  "shutdown",
  "reboot",
  "halt",
  "poweroff",
]

// ============================================
// Command Analysis Functions
// ============================================

interface CommandAnalysis {
  command: string
  baseCommand: string
  arguments: string[]
  targetPaths: string[]
  hasRedirection: boolean
  hasPipe: boolean
  isChained: boolean
  subCommands: string[]
}

/**
 * Parse a command string into components for analysis
 */
export function analyzeCommand(commandStr: string): CommandAnalysis {
  // Handle command chaining (&&, ||, ;)
  const chainedCommands = commandStr.split(/\s*(?:&&|\|\||;)\s*/)
  const isChained = chainedCommands.length > 1

  // Get the first/primary command
  const primaryCommand = chainedCommands[0].trim()

  // Check for pipes
  const hasPipe = primaryCommand.includes("|")
  const pipeSegments = primaryCommand.split("|").map(s => s.trim())

  // Get base command and arguments
  const parts = pipeSegments[0].split(/\s+/)
  const baseCommand = parts[0]
  const args = parts.slice(1)

  // Check for redirection
  const hasRedirection = /[<>]/.test(primaryCommand)

  // Extract target paths from arguments
  const targetPaths: string[] = []
  for (const arg of args) {
    // Skip flags
    if (arg.startsWith("-")) continue

    // Check if it looks like a path
    if (arg.startsWith("/") || arg.startsWith("~") || arg.startsWith(".")) {
      targetPaths.push(arg)
    }
    // Also capture paths after redirection operators
    const redirectMatch = arg.match(/[<>]+(.+)/)
    if (redirectMatch) {
      targetPaths.push(redirectMatch[1])
    }
  }

  return {
    command: commandStr,
    baseCommand,
    arguments: args,
    targetPaths,
    hasRedirection,
    hasPipe,
    isChained,
    subCommands: chainedCommands,
  }
}

/**
 * Expand tilde (~) in a path to the user's home directory
 */
function expandTilde(pathStr: string, homeDir: string = "/home/bill"): string {
  if (pathStr.startsWith("~")) {
    return pathStr.replace(/^~/, homeDir)
  }
  return pathStr
}

/**
 * Check if a target path is attempting to access protected areas
 */
function isTargetPathProtected(targetPath: string): boolean {
  const expandedPath = expandTilde(targetPath)

  // Check against protected paths
  if (isPathProtected(expandedPath)) {
    return true
  }

  // Check for protected file patterns in the path
  for (const pattern of PROTECTED_FILE_PATTERNS) {
    if (pattern.startsWith("*")) {
      const extension = pattern.slice(1)
      if (targetPath.endsWith(extension)) {
        return true
      }
    } else if (targetPath.includes(pattern)) {
      return true
    }
  }

  return false
}

// ============================================
// Command Filtering Functions
// ============================================

export interface CommandFilterResult {
  allowed: boolean
  reason?: string
  blockedPaths?: string[]
  suggestion?: string
}

/**
 * Filter a command for a sandboxed user
 * Returns whether the command is allowed and why it was blocked
 */
export function filterCommandForUser(
  commandStr: string,
  userId: string,
  options: {
    sessionId?: string
    strictMode?: boolean  // If true, use stricter filtering
  } = {}
): CommandFilterResult {
  const { sessionId, strictMode = true } = options
  const analysis = analyzeCommand(commandStr)
  const userSandbox = getUserSandboxDir(userId)

  // Check against always-blocked commands
  if (ALWAYS_BLOCKED_COMMANDS.includes(analysis.baseCommand)) {
    logSecurityEvent({
      userId,
      sessionId,
      eventType: "command_blocked",
      details: `Blocked dangerous command: ${analysis.baseCommand}`,
      inputCommand: commandStr,
    })
    return {
      allowed: false,
      reason: `Command '${analysis.baseCommand}' is not allowed for security reasons`,
    }
  }

  // Check against regex patterns
  for (const pattern of BLOCKED_COMMAND_PATTERNS) {
    if (pattern.test(commandStr)) {
      logSecurityEvent({
        userId,
        sessionId,
        eventType: "command_blocked",
        details: `Command matched blocked pattern: ${pattern.source}`,
        inputCommand: commandStr,
      })
      return {
        allowed: false,
        reason: `Command matches blocked security pattern`,
        suggestion: `Ensure your command only accesses your sandbox: ${userSandbox}`,
      }
    }
  }

  // Check if command accesses protected paths
  const blockedPaths: string[] = []
  for (const targetPath of analysis.targetPaths) {
    if (isTargetPathProtected(targetPath)) {
      blockedPaths.push(targetPath)
    }
  }

  if (blockedPaths.length > 0) {
    logSecurityEvent({
      userId,
      sessionId,
      eventType: "path_blocked",
      details: `Command attempted to access protected paths: ${blockedPaths.join(", ")}`,
      inputCommand: commandStr,
    })
    return {
      allowed: false,
      reason: "Command attempts to access protected paths",
      blockedPaths,
      suggestion: `Only access files within your sandbox: ${userSandbox}`,
    }
  }

  // In strict mode, check for navigation to parent directories
  if (strictMode && FILE_NAVIGATION_COMMANDS.includes(analysis.baseCommand)) {
    for (const arg of analysis.arguments) {
      if (arg.includes("..")) {
        logSecurityEvent({
          userId,
          sessionId,
          eventType: "sandbox_violation",
          details: `Path traversal attempt detected in cd command`,
          inputCommand: commandStr,
        })
        return {
          allowed: false,
          reason: "Path traversal (using ..) is not allowed",
          suggestion: "Use absolute paths within your sandbox",
        }
      }
    }
  }

  // Check for chained commands in strict mode
  if (strictMode && analysis.isChained) {
    // Recursively check all subcommands
    for (const subCmd of analysis.subCommands.slice(1)) {
      const subResult = filterCommandForUser(subCmd.trim(), userId, { sessionId, strictMode })
      if (!subResult.allowed) {
        return {
          allowed: false,
          reason: `Chained command blocked: ${subResult.reason}`,
          suggestion: subResult.suggestion,
        }
      }
    }
  }

  return { allowed: true }
}

/**
 * Filter PTY input data for sandboxed sessions
 * This is called when input is being sent to the PTY
 */
export function filterPtyInput(
  input: string,
  userId: string,
  options: {
    sessionId?: string
    currentWorkingDirectory?: string
  } = {}
): CommandFilterResult {
  const { sessionId } = options
  // currentWorkingDirectory reserved for future path resolution

  // Skip filtering for non-command input (e.g., single keypresses, special keys)
  // Commands typically end with newline or are substantial
  if (input.length < 2 && !input.includes("\n") && !input.includes("\r")) {
    return { allowed: true }
  }

  // Extract command from input (handle both Enter key scenarios)
  const commandMatch = input.match(/^(.+?)[\r\n]/)
  if (!commandMatch) {
    // Not a command submission, allow it
    return { allowed: true }
  }

  const command = commandMatch[1].trim()
  if (!command) {
    return { allowed: true }
  }

  // Filter the command
  return filterCommandForUser(command, userId, { sessionId })
}

/**
 * Create a filtered shell environment for sandboxed users
 * Returns environment variables that restrict command availability
 */
export function createSandboxedEnvironment(
  userId: string,
  baseEnv: Record<string, string> = {}
): Record<string, string> {
  const userSandbox = getUserSandboxDir(userId)

  return {
    ...baseEnv,
    // Override HOME to sandbox
    HOME: userSandbox,
    // Set a restricted PATH (remove dangerous locations)
    PATH: "/usr/local/bin:/usr/bin:/bin",
    // Prevent history from being saved outside sandbox
    HISTFILE: `${userSandbox}/.bash_history`,
    // Set umask for secure file creation
    UMASK: "077",
    // Mark as sandboxed for any scripts that check
    CLAUDIA_SANDBOXED: "true",
    CLAUDIA_USER_ID: userId,
    CLAUDIA_SANDBOX_DIR: userSandbox,
  }
}

// ============================================
// Export Summary
// ============================================
// All exports are named exports defined above
