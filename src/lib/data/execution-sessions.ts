/**
 * Execution Sessions Data Layer
 *
 * Server-side persistence of execution state to survive page navigation.
 * Stores active execution sessions in a JSON file (.local-storage/execution-sessions.json)
 * so the UI can restore execution state when the user returns to the page.
 *
 * This module provides functions to:
 * - Create and track new execution sessions
 * - Update session progress and events
 * - Query active executions for a project
 * - Complete/finalize execution sessions
 */

import * as fs from "fs/promises"
import * as path from "path"

// Storage configuration
const STORAGE_DIR = path.join(process.cwd(), ".local-storage")
const SESSIONS_FILE = path.join(STORAGE_DIR, "execution-sessions.json")
const SESSIONS_BACKUP_FILE = path.join(STORAGE_DIR, "execution-sessions.backup.json")
const MAX_SESSIONS = 100 // Keep at most 100 sessions

// ============ Types ============

export type ExecutionStatus = "running" | "complete" | "error" | "cancelled"

export interface ExecutionEvent {
  id: string
  type: "info" | "success" | "error" | "warning" | "progress"
  message: string
  timestamp: string
  detail?: string
}

export interface QualityGateResults {
  passed: boolean
  tests: {
    success: boolean
    output: string
    errorCount?: number
  }
  typeCheck: {
    success: boolean
    output: string
    errorCount?: number
  }
  build: {
    success: boolean
    output: string
  }
}

export interface ExecutionSession {
  id: string
  projectId: string
  projectName?: string
  packetIds: string[]
  packetTitles?: string[]
  userId: string
  status: ExecutionStatus
  progress: number // 0-100
  currentPacketIndex: number
  events: ExecutionEvent[]
  startedAt: string
  completedAt?: string
  error?: string
  qualityGates?: QualityGateResults
  mode?: string // e.g., "local", "remote", "hybrid"
  output?: string // Final output/summary
}

interface ExecutionSessionsStore {
  sessions: ExecutionSession[]
  lastUpdated: string
}

// ============ File Operations ============

/**
 * Ensure storage directory exists
 */
async function ensureStorageDir(): Promise<void> {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true })
  } catch (error) {
    // Directory might already exist, that's fine
    const err = error as NodeJS.ErrnoException
    if (err.code !== "EEXIST") {
      console.error("[execution-sessions] Failed to create storage directory:", error)
      throw error
    }
  }
}

/**
 * Read sessions from file with error handling
 */
async function readSessionsFile(): Promise<ExecutionSessionsStore> {
  try {
    await ensureStorageDir()
    const data = await fs.readFile(SESSIONS_FILE, "utf-8")
    const parsed = JSON.parse(data)

    // Validate structure
    if (parsed && Array.isArray(parsed.sessions)) {
      return parsed as ExecutionSessionsStore
    }

    console.warn("[execution-sessions] File contained invalid data, returning empty store")
    return { sessions: [], lastUpdated: new Date().toISOString() }
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === "ENOENT") {
      // File doesn't exist yet
      return { sessions: [], lastUpdated: new Date().toISOString() }
    }
    // For JSON parse errors or other issues, return empty store instead of throwing
    if (error instanceof SyntaxError) {
      console.error("[execution-sessions] JSON parse error, returning empty store:", error.message)
      return { sessions: [], lastUpdated: new Date().toISOString() }
    }
    console.error("[execution-sessions] Failed to read sessions file:", error)
    // Return empty store instead of throwing to prevent API 500 errors
    return { sessions: [], lastUpdated: new Date().toISOString() }
  }
}

/**
 * Write sessions to file atomically with backup
 */
async function writeSessionsFile(store: ExecutionSessionsStore): Promise<void> {
  await ensureStorageDir()

  // Update timestamp
  store.lastUpdated = new Date().toISOString()

  // Create backup of existing file first
  try {
    await fs.access(SESSIONS_FILE)
    await fs.copyFile(SESSIONS_FILE, SESSIONS_BACKUP_FILE)
  } catch {
    // File doesn't exist yet, no backup needed
  }

  // Write to temp file first for atomic operation
  const tempFile = SESSIONS_FILE + ".tmp"
  const jsonContent = JSON.stringify(store, null, 2)

  // Validate JSON before writing
  JSON.parse(jsonContent) // Will throw if invalid

  await fs.writeFile(tempFile, jsonContent, "utf-8")
  await fs.rename(tempFile, SESSIONS_FILE)
}

/**
 * Trim old sessions to prevent unbounded growth
 */
function trimSessions(sessions: ExecutionSession[]): ExecutionSession[] {
  if (sessions.length <= MAX_SESSIONS) {
    return sessions
  }

  // Sort by startedAt descending (newest first)
  const sorted = [...sessions].sort((a, b) =>
    new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )

  // Keep running sessions + most recent completed sessions
  const running = sorted.filter(s => s.status === "running")
  const completed = sorted.filter(s => s.status !== "running")

  // Always keep all running sessions, fill rest with recent completed
  const maxCompleted = MAX_SESSIONS - running.length
  return [...running, ...completed.slice(0, maxCompleted)]
}

// ============ ID Generation ============

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 10)
  return `exec-${timestamp}-${random}`
}

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 6)
  return `evt-${timestamp}-${random}`
}

// ============ Public API ============

/**
 * Create a new execution session
 *
 * @param projectId - The project being executed
 * @param packetIds - Array of packet IDs to execute
 * @param userId - The user initiating the execution
 * @param options - Optional additional session data
 * @returns The created session
 */
export async function createExecutionSession(
  projectId: string,
  packetIds: string[],
  userId: string,
  options?: {
    projectName?: string
    packetTitles?: string[]
    mode?: string
  }
): Promise<ExecutionSession> {
  const store = await readSessionsFile()
  const now = new Date().toISOString()

  const session: ExecutionSession = {
    id: generateSessionId(),
    projectId,
    projectName: options?.projectName,
    packetIds,
    packetTitles: options?.packetTitles,
    userId,
    status: "running",
    progress: 0,
    currentPacketIndex: 0,
    events: [
      {
        id: generateEventId(),
        type: "info",
        message: `Processing started for ${packetIds.length} packet(s)`,
        timestamp: now
      }
    ],
    startedAt: now,
    mode: options?.mode
  }

  store.sessions.push(session)
  store.sessions = trimSessions(store.sessions)

  await writeSessionsFile(store)

  console.log(`[execution-sessions] Created session ${session.id} for project ${projectId}`)
  return session
}

/**
 * Get an execution session by ID
 *
 * @param sessionId - The session ID
 * @returns The session or null if not found
 */
export async function getExecutionSession(sessionId: string): Promise<ExecutionSession | null> {
  const store = await readSessionsFile()
  return store.sessions.find(s => s.id === sessionId) || null
}

/**
 * Get active (running) execution for a project
 *
 * @param projectId - The project ID
 * @returns The active session or null if none
 */
export async function getActiveExecutionForProject(projectId: string): Promise<ExecutionSession | null> {
  const store = await readSessionsFile()

  // Find the most recent running session for this project
  const runningSessions = store.sessions
    .filter(s => s.projectId === projectId && s.status === "running")
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())

  return runningSessions[0] || null
}

/**
 * Get all active executions for a user
 *
 * @param userId - The user ID
 * @returns Array of active sessions
 */
export async function getActiveExecutionsForUser(userId: string): Promise<ExecutionSession[]> {
  const store = await readSessionsFile()

  return store.sessions
    .filter(s => s.userId === userId && s.status === "running")
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
}

/**
 * Get execution history for a project
 *
 * @param projectId - The project ID
 * @param limit - Maximum number of sessions to return
 * @returns Array of sessions (newest first)
 */
export async function getExecutionHistory(
  projectId: string,
  limit: number = 20
): Promise<ExecutionSession[]> {
  const store = await readSessionsFile()

  return store.sessions
    .filter(s => s.projectId === projectId)
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, limit)
}

/**
 * Update an execution session with partial updates
 *
 * @param sessionId - The session ID
 * @param updates - Partial updates to apply
 * @returns The updated session or null if not found
 */
export async function updateExecutionSession(
  sessionId: string,
  updates: Partial<Pick<ExecutionSession,
    "status" | "progress" | "currentPacketIndex" | "error" | "qualityGates" | "output"
  >>
): Promise<ExecutionSession | null> {
  const store = await readSessionsFile()
  const index = store.sessions.findIndex(s => s.id === sessionId)

  if (index === -1) {
    console.warn(`[execution-sessions] Session ${sessionId} not found for update`)
    return null
  }

  // Apply updates (don't allow changing id, projectId, packetIds, userId, startedAt)
  store.sessions[index] = {
    ...store.sessions[index],
    ...updates
  }

  await writeSessionsFile(store)

  return store.sessions[index]
}

/**
 * Add an event to an execution session
 *
 * @param sessionId - The session ID
 * @param event - The event to add (id and timestamp will be auto-generated if not provided)
 * @returns The updated session or null if not found
 */
export async function addExecutionEvent(
  sessionId: string,
  event: Omit<ExecutionEvent, "id" | "timestamp"> & { id?: string; timestamp?: string }
): Promise<ExecutionSession | null> {
  const store = await readSessionsFile()
  const index = store.sessions.findIndex(s => s.id === sessionId)

  if (index === -1) {
    console.warn(`[execution-sessions] Session ${sessionId} not found for adding event`)
    return null
  }

  const fullEvent: ExecutionEvent = {
    id: event.id || generateEventId(),
    type: event.type,
    message: event.message,
    timestamp: event.timestamp || new Date().toISOString(),
    detail: event.detail
  }

  store.sessions[index].events.push(fullEvent)

  // Limit events to prevent unbounded growth (keep last 200)
  if (store.sessions[index].events.length > 200) {
    store.sessions[index].events = store.sessions[index].events.slice(-200)
  }

  await writeSessionsFile(store)

  return store.sessions[index]
}

/**
 * Complete an execution session
 *
 * @param sessionId - The session ID
 * @param result - The completion result
 * @returns The updated session or null if not found
 */
export async function completeExecutionSession(
  sessionId: string,
  result: {
    status: "complete" | "error" | "cancelled"
    error?: string
    qualityGates?: QualityGateResults
    output?: string
  }
): Promise<ExecutionSession | null> {
  const store = await readSessionsFile()
  const index = store.sessions.findIndex(s => s.id === sessionId)

  if (index === -1) {
    console.warn(`[execution-sessions] Session ${sessionId} not found for completion`)
    return null
  }

  const now = new Date().toISOString()

  // Add completion event
  const eventMessage = result.status === "complete"
    ? "Execution completed successfully"
    : result.status === "cancelled"
      ? "Execution cancelled"
      : `Execution failed: ${result.error || "Unknown error"}`

  store.sessions[index].events.push({
    id: generateEventId(),
    type: result.status === "complete" ? "success" : result.status === "cancelled" ? "warning" : "error",
    message: eventMessage,
    timestamp: now,
    detail: result.error
  })

  // Update session
  store.sessions[index] = {
    ...store.sessions[index],
    status: result.status,
    progress: result.status === "complete" ? 100 : store.sessions[index].progress,
    completedAt: now,
    error: result.error,
    qualityGates: result.qualityGates,
    output: result.output
  }

  await writeSessionsFile(store)

  console.log(`[execution-sessions] Completed session ${sessionId} with status: ${result.status}`)
  return store.sessions[index]
}

/**
 * Delete an execution session
 *
 * @param sessionId - The session ID
 * @returns True if deleted, false if not found
 */
export async function deleteExecutionSession(sessionId: string): Promise<boolean> {
  const store = await readSessionsFile()
  const initialLength = store.sessions.length

  store.sessions = store.sessions.filter(s => s.id !== sessionId)

  if (store.sessions.length === initialLength) {
    return false
  }

  await writeSessionsFile(store)
  console.log(`[execution-sessions] Deleted session ${sessionId}`)
  return true
}

/**
 * Clear all completed sessions (keep running ones)
 *
 * @returns Number of sessions cleared
 */
export async function clearCompletedSessions(): Promise<number> {
  const store = await readSessionsFile()
  const initialLength = store.sessions.length

  store.sessions = store.sessions.filter(s => s.status === "running")
  const clearedCount = initialLength - store.sessions.length

  await writeSessionsFile(store)
  console.log(`[execution-sessions] Cleared ${clearedCount} completed sessions`)
  return clearedCount
}

/**
 * Get execution statistics
 */
export async function getExecutionStats(): Promise<{
  total: number
  running: number
  completed: number
  failed: number
  cancelled: number
}> {
  const store = await readSessionsFile()

  return {
    total: store.sessions.length,
    running: store.sessions.filter(s => s.status === "running").length,
    completed: store.sessions.filter(s => s.status === "complete").length,
    failed: store.sessions.filter(s => s.status === "error").length,
    cancelled: store.sessions.filter(s => s.status === "cancelled").length
  }
}

/**
 * Mark stale running sessions as errored
 * Call this on server startup to clean up sessions from previous runs
 *
 * @param maxAge - Max age in milliseconds for a running session (default: 1 hour)
 * @returns Number of sessions marked as stale
 */
export async function cleanupStaleSessions(maxAge: number = 60 * 60 * 1000): Promise<number> {
  const store = await readSessionsFile()
  const now = Date.now()
  let staleCount = 0

  for (const session of store.sessions) {
    if (session.status === "running") {
      const sessionAge = now - new Date(session.startedAt).getTime()
      if (sessionAge > maxAge) {
        session.status = "error"
        session.completedAt = new Date().toISOString()
        session.error = "Session timed out (server restart or stale session)"
        session.events.push({
          id: generateEventId(),
          type: "error",
          message: "Session marked as stale after server restart",
          timestamp: new Date().toISOString()
        })
        staleCount++
      }
    }
  }

  if (staleCount > 0) {
    await writeSessionsFile(store)
    console.log(`[execution-sessions] Cleaned up ${staleCount} stale sessions`)
  }

  return staleCount
}

// ============ Run History Functions ============

import type { RunHistoryEntry } from "./types"

/**
 * Get run history list with optional filters
 *
 * @param options - Filter options
 * @returns Array of run history entries (summary form)
 */
export async function getRunHistoryList(options?: {
  projectId?: string
  userId?: string
  limit?: number
  offset?: number
}): Promise<RunHistoryEntry[]> {
  const store = await readSessionsFile()
  const { projectId, userId, limit = 50, offset = 0 } = options || {}

  let sessions = store.sessions

  // Filter by projectId if provided
  if (projectId) {
    sessions = sessions.filter(s => s.projectId === projectId)
  }

  // Filter by userId if provided
  if (userId) {
    sessions = sessions.filter(s => s.userId === userId)
  }

  // Sort by startedAt descending (newest first)
  sessions = sessions.sort((a, b) =>
    new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )

  // Apply pagination
  sessions = sessions.slice(offset, offset + limit)

  // Convert to RunHistoryEntry format (summary only)
  return sessions.map(session => sessionToRunHistoryEntry(session))
}

/**
 * Get full run history entry with all details
 *
 * @param sessionId - The session/run ID
 * @returns Full run history entry or null
 */
export async function getRunHistoryEntry(sessionId: string): Promise<RunHistoryEntry | null> {
  const store = await readSessionsFile()
  const session = store.sessions.find(s => s.id === sessionId)

  if (!session) {
    return null
  }

  return sessionToRunHistoryEntry(session, true)
}

/**
 * Export run as markdown
 *
 * @param sessionId - The session/run ID
 * @returns Markdown string or null
 */
export async function exportRunAsMarkdown(sessionId: string): Promise<string | null> {
  const entry = await getRunHistoryEntry(sessionId)

  if (!entry) {
    return null
  }

  const duration = entry.duration
    ? `${Math.round(entry.duration / 1000)}s`
    : "N/A"

  const statusEmoji = {
    running: "🔄",
    complete: "✅",
    error: "❌",
    cancelled: "⚠️"
  }[entry.status]

  let markdown = `# Run Report: ${entry.projectName || entry.projectId}

**Run ID:** ${entry.id}
**Status:** ${statusEmoji} ${entry.status}
**Started:** ${new Date(entry.startedAt).toLocaleString()}
${entry.completedAt ? `**Completed:** ${new Date(entry.completedAt).toLocaleString()}` : ""}
**Duration:** ${duration}
**Mode:** ${entry.mode || "N/A"}

## Summary

- **Packets:** ${entry.packetCount}
- **Successful:** ${entry.successCount}
- **Failed:** ${entry.failedCount}

`

  if (entry.packetTitles && entry.packetTitles.length > 0) {
    markdown += `## Packets Processed

${entry.packetTitles.map((title, i) => `${i + 1}. ${title}`).join("\n")}

`
  }

  if (entry.events && entry.events.length > 0) {
    markdown += `## Activity Log

| Time | Type | Message |
|------|------|---------|
${entry.events.map(e => `| ${new Date(e.timestamp).toLocaleTimeString()} | ${e.type} | ${e.message} |`).join("\n")}

`
  }

  if (entry.qualityGates) {
    const qg = entry.qualityGates
    markdown += `## Quality Gates

- **Overall:** ${qg.passed ? "✅ Passed" : "❌ Failed"}
- **Tests:** ${qg.tests.success ? "✅" : "❌"} ${qg.tests.errorCount ? `(${qg.tests.errorCount} errors)` : ""}
- **TypeScript:** ${qg.typeCheck.success ? "✅" : "❌"} ${qg.typeCheck.errorCount ? `(${qg.typeCheck.errorCount} errors)` : ""}
- **Build:** ${qg.build.success ? "✅" : "❌"}

`
  }

  if (entry.output) {
    markdown += `## Output

\`\`\`
${entry.output}
\`\`\`
`
  }

  markdown += `
---
*Generated by Claudia Coder*
`

  return markdown
}

/**
 * Export run as JSON
 *
 * @param sessionId - The session/run ID
 * @returns JSON object or null
 */
export async function exportRunAsJSON(sessionId: string): Promise<RunHistoryEntry | null> {
  return getRunHistoryEntry(sessionId)
}

/**
 * Get all runs for a specific project (for AI context)
 *
 * @param projectId - The project ID
 * @param limit - Maximum number of runs to return
 * @returns Array of run history entries
 */
export async function getRecentRunsForProject(
  projectId: string,
  limit: number = 10
): Promise<RunHistoryEntry[]> {
  return getRunHistoryList({ projectId, limit })
}

// Helper: Convert ExecutionSession to RunHistoryEntry
function sessionToRunHistoryEntry(
  session: ExecutionSession,
  includeDetails: boolean = false
): RunHistoryEntry {
  // Calculate success/failed counts from events
  let successCount = 0
  let failedCount = 0

  for (const event of session.events) {
    if (event.type === "success" && event.message.toLowerCase().includes("completed")) {
      successCount++
    } else if (event.type === "error" && event.message.toLowerCase().includes("failed")) {
      failedCount++
    }
  }

  // Calculate duration
  const duration = session.completedAt
    ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()
    : undefined

  const entry: RunHistoryEntry = {
    id: session.id,
    projectId: session.projectId,
    projectName: session.projectName,
    userId: session.userId,
    startedAt: session.startedAt,
    completedAt: session.completedAt,
    status: session.status,
    packetCount: session.packetIds.length,
    successCount,
    failedCount,
    duration,
    mode: session.mode,
  }

  if (includeDetails) {
    entry.events = session.events
    entry.packetIds = session.packetIds
    entry.packetTitles = session.packetTitles
    entry.qualityGates = session.qualityGates
    entry.output = session.output
  }

  return entry
}
