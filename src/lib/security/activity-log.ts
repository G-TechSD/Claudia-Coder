/**
 * Security Activity Log for Claudia Code
 *
 * Logs security events to a dedicated log file for auditing
 * and monitoring of security-related activities.
 *
 * Event types:
 * - injection_attempt: Prompt injection detected
 * - path_violation: Unauthorized path access attempt
 * - unauthorized_access: Access without proper authorization
 * - revoked_access: Access attempt with revoked credentials
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "fs"
import * as path from "path"

// Types
export type SecurityEventType =
  | "injection_attempt"
  | "path_violation"
  | "unauthorized_access"
  | "revoked_access"
  | "rate_limit_exceeded"
  | "suspicious_activity"

export type SecuritySeverity = "low" | "medium" | "high" | "critical"

export interface SecurityEvent {
  id: string
  timestamp: string
  userId: string
  type: SecurityEventType
  severity: SecuritySeverity
  details: Record<string, unknown>
  ip?: string
  userAgent?: string
  sessionId?: string
}

export interface SecurityEventInput {
  userId: string
  type: SecurityEventType
  severity?: SecuritySeverity
  details: Record<string, unknown>
  ip?: string
  userAgent?: string
  sessionId?: string
}

// Configuration
const STORAGE_DIR = process.env.CLAUDIA_STORAGE_DIR || path.join(process.cwd(), ".local-storage")
const SECURITY_LOG_FILE = path.join(STORAGE_DIR, "security-events.json")
const MAX_EVENTS_IN_MEMORY = 1000
const MAX_LOG_FILE_SIZE = 10 * 1024 * 1024 // 10MB

// In-memory cache for recent events
let recentEvents: SecurityEvent[] = []

/**
 * Ensure storage directory exists
 */
function ensureStorageDir(): void {
  if (!existsSync(STORAGE_DIR)) {
    mkdirSync(STORAGE_DIR, { recursive: true })
  }
}

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 8)
  return `sec-${timestamp}-${random}`
}

/**
 * Load events from log file
 */
function loadEvents(): SecurityEvent[] {
  try {
    ensureStorageDir()
    if (existsSync(SECURITY_LOG_FILE)) {
      const content = readFileSync(SECURITY_LOG_FILE, "utf-8")
      const data = JSON.parse(content)
      return Array.isArray(data) ? data : []
    }
  } catch (error) {
    console.error("[security-log] Error loading events:", error)
  }
  return []
}

/**
 * Save events to log file
 */
function saveEvents(events: SecurityEvent[]): void {
  try {
    ensureStorageDir()
    writeFileSync(SECURITY_LOG_FILE, JSON.stringify(events, null, 2))
  } catch (error) {
    console.error("[security-log] Error saving events:", error)
  }
}

/**
 * Append a single event to the log file (more efficient for single writes)
 */
function appendEvent(event: SecurityEvent): void {
  try {
    ensureStorageDir()

    // Check file size and rotate if needed
    if (existsSync(SECURITY_LOG_FILE)) {
      const stats = statSync(SECURITY_LOG_FILE)
      if (stats.size > MAX_LOG_FILE_SIZE) {
        rotateLogFile()
      }
    }

    // Load existing events, add new one, save
    const events = loadEvents()
    events.push(event)

    // Keep only last N events in file
    const trimmedEvents = events.slice(-5000)
    saveEvents(trimmedEvents)
  } catch (error) {
    console.error("[security-log] Error appending event:", error)
  }
}

/**
 * Rotate log file when it gets too large
 */
function rotateLogFile(): void {
  try {
    const timestamp = new Date().toISOString().split("T")[0]
    const archivePath = path.join(STORAGE_DIR, `security-events-${timestamp}.json`)

    if (existsSync(SECURITY_LOG_FILE)) {
      const content = readFileSync(SECURITY_LOG_FILE, "utf-8")
      writeFileSync(archivePath, content)
      writeFileSync(SECURITY_LOG_FILE, "[]")
      console.log(`[security-log] Rotated log file to ${archivePath}`)
    }
  } catch (error) {
    console.error("[security-log] Error rotating log file:", error)
  }
}

/**
 * Log a security event
 */
export function logSecurityEvent(input: SecurityEventInput): SecurityEvent {
  const event: SecurityEvent = {
    id: generateEventId(),
    timestamp: new Date().toISOString(),
    userId: input.userId,
    type: input.type,
    severity: input.severity || determineSeverity(input.type, input.details),
    details: input.details,
    ip: input.ip,
    userAgent: input.userAgent,
    sessionId: input.sessionId
  }

  // Add to in-memory cache
  recentEvents.push(event)
  if (recentEvents.length > MAX_EVENTS_IN_MEMORY) {
    recentEvents = recentEvents.slice(-MAX_EVENTS_IN_MEMORY)
  }

  // Persist to file
  appendEvent(event)

  // Log to console for immediate visibility
  const logLevel = event.severity === "critical" || event.severity === "high" ? "warn" : "info"
  console[logLevel](
    `[SECURITY] [${event.severity.toUpperCase()}] ${event.type} - User: ${event.userId}`,
    JSON.stringify(event.details)
  )

  return event
}

/**
 * Determine severity based on event type and details
 */
function determineSeverity(
  type: SecurityEventType,
  details: Record<string, unknown>
): SecuritySeverity {
  // Injection attempts with blocking are critical
  if (type === "injection_attempt") {
    if (details.blocked) return "critical"
    const patterns = details.patterns as Array<{ severity: string }> | undefined
    if (patterns?.some(p => p.severity === "critical")) return "critical"
    if (patterns?.some(p => p.severity === "high")) return "high"
    return "medium"
  }

  // Default severities by type
  const defaultSeverities: Record<SecurityEventType, SecuritySeverity> = {
    injection_attempt: "high",
    path_violation: "high",
    unauthorized_access: "critical",
    revoked_access: "critical",
    rate_limit_exceeded: "medium",
    suspicious_activity: "medium"
  }

  return defaultSeverities[type] || "medium"
}

/**
 * Get recent security events
 */
export function getSecurityEvents(options?: {
  limit?: number
  type?: SecurityEventType
  userId?: string
  severity?: SecuritySeverity
  startDate?: string
  endDate?: string
}): SecurityEvent[] {
  // Load from file if memory cache is empty
  if (recentEvents.length === 0) {
    recentEvents = loadEvents()
  }

  let filtered = [...recentEvents]

  // Filter by type
  if (options?.type) {
    filtered = filtered.filter(e => e.type === options.type)
  }

  // Filter by user
  if (options?.userId) {
    filtered = filtered.filter(e => e.userId === options.userId)
  }

  // Filter by severity
  if (options?.severity) {
    filtered = filtered.filter(e => e.severity === options.severity)
  }

  // Filter by date range
  if (options?.startDate) {
    const startTime = new Date(options.startDate).getTime()
    filtered = filtered.filter(e => new Date(e.timestamp).getTime() >= startTime)
  }

  if (options?.endDate) {
    const endTime = new Date(options.endDate).getTime()
    filtered = filtered.filter(e => new Date(e.timestamp).getTime() <= endTime)
  }

  // Sort by timestamp descending (most recent first)
  filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  // Apply limit
  if (options?.limit) {
    filtered = filtered.slice(0, options.limit)
  }

  return filtered
}

/**
 * Get security event by ID
 */
export function getSecurityEventById(id: string): SecurityEvent | null {
  // Check in-memory first
  const event = recentEvents.find(e => e.id === id)
  if (event) return event

  // Load from file
  const events = loadEvents()
  return events.find(e => e.id === id) || null
}

/**
 * Get security event statistics
 */
export function getSecurityStats(options?: {
  startDate?: string
  endDate?: string
}): {
  total: number
  byType: Record<SecurityEventType, number>
  bySeverity: Record<SecuritySeverity, number>
  criticalEvents: number
  recentAlerts: SecurityEvent[]
} {
  const events = getSecurityEvents(options)

  const byType: Record<SecurityEventType, number> = {
    injection_attempt: 0,
    path_violation: 0,
    unauthorized_access: 0,
    revoked_access: 0,
    rate_limit_exceeded: 0,
    suspicious_activity: 0
  }

  const bySeverity: Record<SecuritySeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0
  }

  for (const event of events) {
    byType[event.type]++
    bySeverity[event.severity]++
  }

  // Get critical events from last 24 hours
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const recentAlerts = events.filter(
    e => e.timestamp >= oneDayAgo && (e.severity === "critical" || e.severity === "high")
  ).slice(0, 10)

  return {
    total: events.length,
    byType,
    bySeverity,
    criticalEvents: bySeverity.critical + bySeverity.high,
    recentAlerts
  }
}

/**
 * Clear old events (for maintenance)
 */
export function clearOldEvents(olderThanDays: number = 30): number {
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000).toISOString()
  const events = loadEvents()
  const filtered = events.filter(e => e.timestamp >= cutoffDate)
  const removed = events.length - filtered.length

  saveEvents(filtered)
  recentEvents = filtered.slice(-MAX_EVENTS_IN_MEMORY)

  console.log(`[security-log] Cleared ${removed} events older than ${olderThanDays} days`)
  return removed
}

/**
 * Export events for analysis
 */
export function exportEvents(options?: {
  format?: "json" | "csv"
  startDate?: string
  endDate?: string
}): string {
  const events = getSecurityEvents(options)

  if (options?.format === "csv") {
    const headers = ["id", "timestamp", "userId", "type", "severity", "details", "ip", "sessionId"]
    const rows = events.map(e => [
      e.id,
      e.timestamp,
      e.userId,
      e.type,
      e.severity,
      JSON.stringify(e.details),
      e.ip || "",
      e.sessionId || ""
    ])

    return [headers.join(","), ...rows.map(r => r.join(","))].join("\n")
  }

  return JSON.stringify(events, null, 2)
}

/**
 * Check if a user has had recent security events
 */
export function hasRecentSecurityEvents(
  userId: string,
  options?: {
    withinMinutes?: number
    type?: SecurityEventType
    minSeverity?: SecuritySeverity
  }
): boolean {
  const minutes = options?.withinMinutes || 60
  const cutoff = new Date(Date.now() - minutes * 60 * 1000).toISOString()

  const events = getSecurityEvents({
    userId,
    type: options?.type,
    startDate: cutoff
  })

  if (!options?.minSeverity) {
    return events.length > 0
  }

  const severityOrder = ["low", "medium", "high", "critical"]
  const minIndex = severityOrder.indexOf(options.minSeverity)

  return events.some(e => severityOrder.indexOf(e.severity) >= minIndex)
}
