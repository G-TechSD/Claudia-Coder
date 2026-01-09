/**
 * System Lockdown Module
 * Emergency lockdown functionality for beta security
 *
 * This module stores lockdown state in a file (not DB) so it works
 * even if the database is compromised. The lockdown file is stored
 * in a secure location outside the web root.
 */

import fs from "fs"
import path from "path"

// Lockdown state file location - stored in .local-storage for persistence
const LOCKDOWN_DIR = path.join(process.cwd(), ".local-storage")
const LOCKDOWN_FILE = path.join(LOCKDOWN_DIR, "lockdown.json")

// Environment variable override for lockdown
const ENV_LOCKDOWN_ENABLED = process.env.CLAUDIA_LOCKDOWN_ENABLED === "true"

interface LockdownState {
  enabled: boolean
  enabledAt: string | null
  enabledBy: string | null
  reason: string | null
  allowedAdminIds: string[]
}

interface SecurityEvent {
  id: string
  timestamp: string
  type: "lockdown_enabled" | "lockdown_disabled" | "access_revoked" | "access_restored" | "suspicious_activity"
  userId: string | null
  targetUserId: string | null
  details: string
  ipAddress: string | null
}

const DEFAULT_STATE: LockdownState = {
  enabled: false,
  enabledAt: null,
  enabledBy: null,
  reason: null,
  allowedAdminIds: [],
}

/**
 * Ensure the lockdown directory exists
 */
function ensureDir(): void {
  if (!fs.existsSync(LOCKDOWN_DIR)) {
    fs.mkdirSync(LOCKDOWN_DIR, { recursive: true })
  }
}

/**
 * Read the current lockdown state from file
 */
function readLockdownState(): LockdownState {
  try {
    ensureDir()
    if (fs.existsSync(LOCKDOWN_FILE)) {
      const data = fs.readFileSync(LOCKDOWN_FILE, "utf-8")
      return { ...DEFAULT_STATE, ...JSON.parse(data) }
    }
  } catch (error) {
    console.error("[Lockdown] Error reading lockdown state:", error)
  }
  return DEFAULT_STATE
}

/**
 * Write the lockdown state to file
 */
function writeLockdownState(state: LockdownState): void {
  try {
    ensureDir()
    fs.writeFileSync(LOCKDOWN_FILE, JSON.stringify(state, null, 2), "utf-8")
  } catch (error) {
    console.error("[Lockdown] Error writing lockdown state:", error)
    throw new Error("Failed to update lockdown state")
  }
}

/**
 * Check if lockdown mode is enabled
 * Checks environment variable first, then file
 */
export function isLockdownMode(): boolean {
  // Environment variable takes precedence
  if (ENV_LOCKDOWN_ENABLED) {
    return true
  }

  const state = readLockdownState()
  return state.enabled
}

/**
 * Get full lockdown state including metadata
 */
export function getLockdownState(): LockdownState {
  const state = readLockdownState()
  // Override enabled status if env var is set
  if (ENV_LOCKDOWN_ENABLED) {
    state.enabled = true
    if (!state.enabledAt) {
      state.reason = "Enabled via environment variable"
    }
  }
  return state
}

/**
 * Enable lockdown mode
 * Only allows admin access when enabled
 */
export function enableLockdown(adminId: string, reason: string): boolean {
  const state: LockdownState = {
    enabled: true,
    enabledAt: new Date().toISOString(),
    enabledBy: adminId,
    reason,
    allowedAdminIds: [adminId], // The admin who enabled lockdown is always allowed
  }

  try {
    writeLockdownState(state)
    logSecurityEvent({
      type: "lockdown_enabled",
      userId: adminId,
      targetUserId: null,
      details: `Lockdown enabled: ${reason}`,
      ipAddress: null,
    })
    console.log(`[Lockdown] System lockdown ENABLED by ${adminId}: ${reason}`)
    return true
  } catch {
    return false
  }
}

/**
 * Disable lockdown mode
 * Restores normal access
 */
export function disableLockdown(adminId: string): boolean {
  const currentState = readLockdownState()

  const state: LockdownState = {
    enabled: false,
    enabledAt: null,
    enabledBy: null,
    reason: null,
    allowedAdminIds: [],
  }

  try {
    writeLockdownState(state)
    logSecurityEvent({
      type: "lockdown_disabled",
      userId: adminId,
      targetUserId: null,
      details: `Lockdown disabled. Was enabled at ${currentState.enabledAt} for: ${currentState.reason}`,
      ipAddress: null,
    })
    console.log(`[Lockdown] System lockdown DISABLED by ${adminId}`)
    return true
  } catch {
    return false
  }
}

/**
 * Add an admin to the allowed list during lockdown
 */
export function addAllowedAdmin(adminId: string): void {
  const state = readLockdownState()
  if (!state.allowedAdminIds.includes(adminId)) {
    state.allowedAdminIds.push(adminId)
    writeLockdownState(state)
  }
}

/**
 * Check if a specific admin is allowed during lockdown
 */
export function isAdminAllowedDuringLockdown(adminId: string): boolean {
  const state = readLockdownState()
  return state.allowedAdminIds.includes(adminId)
}

// Security event log file
const SECURITY_LOG_FILE = path.join(LOCKDOWN_DIR, "security-events.json")

/**
 * Read security events from file
 */
export function getSecurityEvents(limit = 100): SecurityEvent[] {
  try {
    ensureDir()
    if (fs.existsSync(SECURITY_LOG_FILE)) {
      const data = fs.readFileSync(SECURITY_LOG_FILE, "utf-8")
      const events: SecurityEvent[] = JSON.parse(data)
      // Return most recent events first, limited
      return events.slice(-limit).reverse()
    }
  } catch (error) {
    console.error("[Lockdown] Error reading security events:", error)
  }
  return []
}

/**
 * Log a security event
 */
export function logSecurityEvent(event: Omit<SecurityEvent, "id" | "timestamp">): void {
  try {
    ensureDir()
    let events: SecurityEvent[] = []

    if (fs.existsSync(SECURITY_LOG_FILE)) {
      const data = fs.readFileSync(SECURITY_LOG_FILE, "utf-8")
      events = JSON.parse(data)
    }

    const newEvent: SecurityEvent = {
      ...event,
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
    }

    events.push(newEvent)

    // Keep only last 1000 events
    if (events.length > 1000) {
      events = events.slice(-1000)
    }

    fs.writeFileSync(SECURITY_LOG_FILE, JSON.stringify(events, null, 2), "utf-8")
  } catch (error) {
    console.error("[Lockdown] Error logging security event:", error)
  }
}

/**
 * Clear security event log (admin only)
 */
export function clearSecurityEvents(adminId: string): void {
  try {
    ensureDir()
    fs.writeFileSync(SECURITY_LOG_FILE, "[]", "utf-8")
    logSecurityEvent({
      type: "suspicious_activity",
      userId: adminId,
      targetUserId: null,
      details: "Security event log cleared",
      ipAddress: null,
    })
  } catch (error) {
    console.error("[Lockdown] Error clearing security events:", error)
  }
}

// Export the LOCKDOWN_ENABLED flag for convenience
export const LOCKDOWN_ENABLED = isLockdownMode()
