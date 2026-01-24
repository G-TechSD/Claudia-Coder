/**
 * Sandbox Security Module
 *
 * Provides path validation and sandbox isolation for beta testers
 * to prevent them from accessing Claudia Code platform source code
 * or other protected system paths.
 */

import { existsSync, mkdirSync } from "fs"
import * as os from "os"
import * as path from "path"

// Dynamic home directory for cross-platform compatibility
const HOME = os.homedir()

// ============================================
// Protected Paths Configuration
// ============================================

/**
 * Paths that require explicit developer access
 * Admins can access these when allowDeveloperPaths is true
 */
export const DEVELOPER_PATHS = [
  // Claudia Admin/Coder source code - accessible to developers
  path.join(HOME, "projects", "claudia-admin"),
  path.join(HOME, "projects", "claudia-coder"),
  path.join(HOME, "projects", "claudia"),
]

/**
 * Paths that can NEVER be accessed by Claude Code sessions
 * These paths are absolutely protected regardless of user role
 */
export const PROTECTED_PATHS = [
  // System configuration and credentials
  path.join(HOME, ".ssh"),
  path.join(HOME, ".gnupg"),
  path.join(HOME, ".aws"),
  path.join(HOME, ".config", "gcloud"),
  path.join(HOME, ".kube"),
  path.join(HOME, ".docker"),

  // Environment and secrets
  path.join(HOME, ".env"),
  path.join(HOME, ".bashrc"),
  path.join(HOME, ".bash_profile"),
  path.join(HOME, ".profile"),
  path.join(HOME, ".zshrc"),
  path.join(HOME, ".netrc"),

  // Database and storage
  path.join(HOME, ".local", "share"),

  // NOTE: ~/projects is NOT protected - users can access their own projects
  // Developer paths (claudia-admin, claudia-coder) are handled separately
  // via DEVELOPER_PATHS which requires admin access

  // System paths
  "/etc",
  "/root",
  "/var",
  "/usr/local/etc",
]

/**
 * File patterns that should never be accessed
 */
export const PROTECTED_FILE_PATTERNS = [
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  "credentials.json",
  "secrets.json",
  "config.json",
  ".npmrc",
  ".pypirc",
  "id_rsa",
  "id_ed25519",
  "*.pem",
  "*.key",
  "*.crt",
  ".git/config",
]

// Helper to escape special regex characters in a string
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

// Escaped HOME path for use in regex patterns
const HOME_ESCAPED = escapeRegExp(HOME)

/**
 * Command patterns that should be blocked
 */
export const BLOCKED_COMMAND_PATTERNS = [
  // Direct access to protected areas
  new RegExp(`cd\\s+${HOME_ESCAPED}(?:\\/|$)`, "i"),
  /cd\s+~(?:\/|$)/i,
  new RegExp(`cat\\s+${HOME_ESCAPED}`, "i"),
  new RegExp(`less\\s+${HOME_ESCAPED}`, "i"),
  new RegExp(`more\\s+${HOME_ESCAPED}`, "i"),
  new RegExp(`head\\s+${HOME_ESCAPED}`, "i"),
  new RegExp(`tail\\s+${HOME_ESCAPED}`, "i"),
  new RegExp(`vim?\\s+${HOME_ESCAPED}`, "i"),
  new RegExp(`nano\\s+${HOME_ESCAPED}`, "i"),
  new RegExp(`code\\s+${HOME_ESCAPED}`, "i"),

  // Reading environment files
  /cat\s+.*\.env/i,
  /less\s+.*\.env/i,
  /more\s+.*\.env/i,

  // Dangerous commands
  /rm\s+-rf?\s+\//i,
  /chmod\s+777/i,
  /chown\s+.*\s+\//i,

  // Network exfiltration
  /curl\s+.*\|\s*sh/i,
  /wget\s+.*\|\s*sh/i,
  /curl\s+.*-d\s+.*@/i,  // Sending file contents

  // SSH/credential access
  /cat\s+.*\.ssh/i,
  /ssh-keygen/i,
  /ssh-add/i,

  // System modification
  /sudo\s+/i,
  /su\s+-/i,
  /passwd/i,
  /useradd/i,
  /usermod/i,

  // Package managers with elevated access
  /npm\s+config\s+set/i,
  /pip\s+config/i,

  // Process manipulation
  /kill\s+-9\s+1/i,
  /pkill\s+/i,
]

// ============================================
// Sandbox Base Directory
// ============================================

/**
 * Base directory for all user sandboxes
 */
export const SANDBOX_BASE_DIR = "/home/claudia/users"

/**
 * Get the sandbox directory for a specific user
 */
export function getUserSandboxDir(userId: string): string {
  // Sanitize userId to prevent path traversal
  const sanitizedUserId = sanitizePathComponent(userId)
  return path.join(SANDBOX_BASE_DIR, sanitizedUserId, "projects")
}

/**
 * Ensure the sandbox directory exists for a user
 */
export function ensureUserSandbox(userId: string): string {
  const sandboxDir = getUserSandboxDir(userId)

  if (!existsSync(sandboxDir)) {
    mkdirSync(sandboxDir, { recursive: true, mode: 0o755 })
    console.log(`[sandbox] Created user sandbox directory: ${sandboxDir}`)
  }

  return sandboxDir
}

// ============================================
// Path Validation Functions
// ============================================

/**
 * Sanitize a path component to prevent path traversal attacks
 */
export function sanitizePathComponent(component: string): string {
  // Remove any path traversal attempts
  return component
    .replace(/\.\./g, "")
    .replace(/[\/\\]/g, "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
}

/**
 * Normalize a path for comparison (resolve symlinks, .., etc.)
 */
export function normalizePath(inputPath: string): string {
  // Resolve to absolute path
  const resolved = path.resolve(inputPath)

  // Normalize path separators and remove trailing slashes
  return resolved.replace(/\/+$/, "")
}

/**
 * Check if a path is a developer path (Claudia source code)
 * Developer paths can be accessed by admins with allowDeveloperPaths
 */
export function isDeveloperPath(inputPath: string): boolean {
  const normalizedPath = normalizePath(inputPath)

  for (const devPath of DEVELOPER_PATHS) {
    const normalizedDev = normalizePath(devPath)
    if (
      normalizedPath === normalizedDev ||
      normalizedPath.startsWith(normalizedDev + "/")
    ) {
      return true
    }
  }

  return false
}

/**
 * Check if a path is protected and should never be accessed
 * @param inputPath - The path to check
 * @param options - Optional settings
 * @param options.allowDeveloperPaths - If true, developer paths (Claudia source) are allowed
 */
export function isPathProtected(
  inputPath: string,
  options: { allowDeveloperPaths?: boolean } = {}
): boolean {
  const { allowDeveloperPaths = false } = options
  const normalizedPath = normalizePath(inputPath)

  // Check if this is a developer path
  if (isDeveloperPath(normalizedPath)) {
    // Allow if developer access is granted
    return !allowDeveloperPaths
  }

  // Check against protected paths
  for (const protectedPath of PROTECTED_PATHS) {
    const normalizedProtected = normalizePath(protectedPath)

    // Check if the path is the protected path or a subdirectory
    if (
      normalizedPath === normalizedProtected ||
      normalizedPath.startsWith(normalizedProtected + "/")
    ) {
      return true
    }
  }

  // Check for protected file patterns in the path
  const filename = path.basename(normalizedPath)
  for (const pattern of PROTECTED_FILE_PATTERNS) {
    if (pattern.startsWith("*")) {
      // Wildcard pattern
      const extension = pattern.slice(1)
      if (filename.endsWith(extension)) {
        return true
      }
    } else if (filename === pattern || normalizedPath.includes(`/${pattern}`)) {
      return true
    }
  }

  return false
}

/**
 * Check if a path is within a user's sandbox
 */
export function isPathInUserSandbox(inputPath: string, userId: string): boolean {
  const normalizedPath = normalizePath(inputPath)
  const userSandbox = normalizePath(getUserSandboxDir(userId))

  return (
    normalizedPath === userSandbox ||
    normalizedPath.startsWith(userSandbox + "/")
  )
}

/**
 * Validate that a project path is valid for a user
 * Returns validation result with error message if invalid
 */
export interface PathValidationResult {
  valid: boolean
  error?: string
  normalizedPath?: string
  suggestion?: string
}

export function validateProjectPath(
  inputPath: string,
  userId: string,
  options: {
    requireInSandbox?: boolean  // If true, path MUST be in user sandbox
    allowProtectedPaths?: boolean  // If true, skip protected path check (admin only)
    allowDeveloperPaths?: boolean  // If true, allow access to Claudia source code
  } = {}
): PathValidationResult {
  const { requireInSandbox = true, allowProtectedPaths = false, allowDeveloperPaths = false } = options

  try {
    const normalizedPath = normalizePath(inputPath)

    // Check for path traversal attempts
    if (inputPath.includes("..")) {
      return {
        valid: false,
        error: "Path traversal not allowed",
        suggestion: "Use absolute paths within your project directory",
      }
    }

    // Check if path is protected
    if (!allowProtectedPaths && isPathProtected(normalizedPath, { allowDeveloperPaths })) {
      return {
        valid: false,
        error: "Access to this path is not allowed",
        suggestion: `Use your sandbox directory: ${getUserSandboxDir(userId)}`,
      }
    }

    // Check if path is in user sandbox (if required)
    // Skip sandbox check if this is a developer path and developer access is allowed
    const skipSandboxCheck = allowDeveloperPaths && isDeveloperPath(normalizedPath)
    if (requireInSandbox && !skipSandboxCheck && !isPathInUserSandbox(normalizedPath, userId)) {
      return {
        valid: false,
        error: "Path must be within your sandbox directory",
        suggestion: `Your projects should be in: ${getUserSandboxDir(userId)}`,
      }
    }

    return {
      valid: true,
      normalizedPath,
    }

  } catch (error) {
    return {
      valid: false,
      error: `Invalid path: ${error instanceof Error ? error.message : "Unknown error"}`,
    }
  }
}

// ============================================
// Command Filtering
// ============================================

/**
 * Check if a command contains blocked patterns
 */
export function isCommandBlocked(command: string): { blocked: boolean; reason?: string } {
  for (const pattern of BLOCKED_COMMAND_PATTERNS) {
    if (pattern.test(command)) {
      return {
        blocked: true,
        reason: `Command matches blocked pattern: ${pattern.source}`,
      }
    }
  }

  return { blocked: false }
}

/**
 * Filter a command to remove or sanitize dangerous parts
 * Returns null if the command cannot be made safe
 */
export function filterCommand(
  command: string,
  userId: string
): { safe: boolean; command?: string; reason?: string } {
  // Check if command is entirely blocked
  const blockCheck = isCommandBlocked(command)
  if (blockCheck.blocked) {
    return { safe: false, reason: blockCheck.reason }
  }

  // Additional specific checks

  // Check for cd commands that try to escape sandbox
  const cdMatch = command.match(/cd\s+([^\s;|&]+)/i)
  if (cdMatch) {
    const targetPath = cdMatch[1]
    // Allow relative paths within sandbox
    if (!targetPath.startsWith("/") && !targetPath.startsWith("~")) {
      return { safe: true, command }
    }
    // Check if absolute path is in sandbox
    const validation = validateProjectPath(targetPath, userId)
    if (!validation.valid) {
      return { safe: false, reason: `Cannot cd to ${targetPath}: ${validation.error}` }
    }
  }

  return { safe: true, command }
}

// ============================================
// Security Logging
// ============================================

interface SecurityEvent {
  timestamp: string
  userId: string
  sessionId?: string
  eventType: "path_blocked" | "command_blocked" | "sandbox_violation" | "access_denied"
  details: string
  inputPath?: string
  inputCommand?: string
}

const securityLog: SecurityEvent[] = []
const MAX_LOG_SIZE = 1000

/**
 * Log a security event
 */
export function logSecurityEvent(event: Omit<SecurityEvent, "timestamp">): void {
  const fullEvent: SecurityEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  }

  console.warn(`[SECURITY] ${event.eventType}: ${event.details}`, {
    userId: event.userId,
    sessionId: event.sessionId,
    inputPath: event.inputPath,
    inputCommand: event.inputCommand,
  })

  securityLog.push(fullEvent)

  // Keep log size bounded
  if (securityLog.length > MAX_LOG_SIZE) {
    securityLog.shift()
  }
}

/**
 * Get recent security events for a user
 */
export function getSecurityEvents(userId: string, limit = 50): SecurityEvent[] {
  return securityLog
    .filter(e => e.userId === userId)
    .slice(-limit)
}

/**
 * Get all security events (admin only)
 */
export function getAllSecurityEvents(limit = 100): SecurityEvent[] {
  return securityLog.slice(-limit)
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if a user can access a specific path
 * Combines all security checks into one function
 */
export function canAccessPath(
  inputPath: string,
  userId: string,
  options: {
    isAdmin?: boolean
    isDeveloper?: boolean  // Can access Claudia source code
    sessionId?: string
  } = {}
): { allowed: boolean; reason?: string } {
  const { isAdmin = false, isDeveloper = false, sessionId } = options

  // Admins can access more paths but still not protected ones
  // Developers (admins working on Claudia itself) can access Claudia source
  const validation = validateProjectPath(inputPath, userId, {
    requireInSandbox: !isAdmin,
    allowProtectedPaths: false, // Never allow truly protected paths (ssh, etc)
    allowDeveloperPaths: isDeveloper || isAdmin, // Admins can work on Claudia source
  })

  if (!validation.valid) {
    logSecurityEvent({
      userId,
      sessionId,
      eventType: "path_blocked",
      details: validation.error || "Path validation failed",
      inputPath,
    })

    return { allowed: false, reason: validation.error }
  }

  return { allowed: true }
}

/**
 * Check if a command can be executed
 */
export function canExecuteCommand(
  command: string,
  userId: string,
  options: {
    sessionId?: string
  } = {}
): { allowed: boolean; reason?: string; filteredCommand?: string } {
  const { sessionId } = options

  const filterResult = filterCommand(command, userId)

  if (!filterResult.safe) {
    logSecurityEvent({
      userId,
      sessionId,
      eventType: "command_blocked",
      details: filterResult.reason || "Command blocked",
      inputCommand: command,
    })

    return { allowed: false, reason: filterResult.reason }
  }

  return { allowed: true, filteredCommand: filterResult.command }
}

// ============================================
// Export Summary
// ============================================
// All exports are named exports defined above
