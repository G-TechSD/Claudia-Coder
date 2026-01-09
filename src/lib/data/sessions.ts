/**
 * Session Tracking Data Layer
 * Manages recorded user sessions for replay and analysis
 */

import { db } from "@/lib/auth/db"

export interface SessionEvent {
  type: number
  data: unknown
  timestamp: number
}

export interface RecordedSession {
  id: string
  userId: string
  userName: string
  userEmail: string
  userImage: string | null
  startedAt: string
  endedAt: string | null
  duration: number | null
  clickCount: number
  errorCount: number
  pageCount: number
  userAgent: string | null
  deviceType: string | null
  browser: string | null
  os: string | null
  screenWidth: number | null
  screenHeight: number | null
  pagesVisited: string | null  // JSON array of pages
  createdAt: string
  updatedAt: string
}

export interface SessionWithEvents extends RecordedSession {
  events: SessionEvent[]
}

export interface SessionStats {
  total: number
  today: number
  thisWeek: number
  thisMonth: number
  totalDuration: number
  avgDuration: number
  totalClicks: number
  totalErrors: number
  uniqueUsers: number
}

export interface SessionFilter {
  userId?: string
  startDate?: string
  endDate?: string
  search?: string
  limit?: number
  offset?: number
}

// Initialize the session tables
function initializeSessionTables() {
  // Sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS recorded_session (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      startedAt TEXT NOT NULL DEFAULT (datetime('now')),
      endedAt TEXT,
      duration INTEGER,
      clickCount INTEGER DEFAULT 0,
      errorCount INTEGER DEFAULT 0,
      pageCount INTEGER DEFAULT 0,
      userAgent TEXT,
      deviceType TEXT,
      browser TEXT,
      os TEXT,
      screenWidth INTEGER,
      screenHeight INTEGER,
      pagesVisited TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Session events table (stores rrweb events)
  db.exec(`
    CREATE TABLE IF NOT EXISTS session_event (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT NOT NULL REFERENCES recorded_session(id) ON DELETE CASCADE,
      type INTEGER NOT NULL,
      data TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `)

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_recorded_session_userId ON recorded_session(userId);
    CREATE INDEX IF NOT EXISTS idx_recorded_session_startedAt ON recorded_session(startedAt);
    CREATE INDEX IF NOT EXISTS idx_session_event_sessionId ON session_event(sessionId);
    CREATE INDEX IF NOT EXISTS idx_session_event_timestamp ON session_event(timestamp);
  `)
}

// Initialize tables on import
initializeSessionTables()

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Create a new recorded session
 */
export function createSession(data: {
  id: string
  userId: string
  userAgent?: string
  deviceType?: string
  browser?: string
  os?: string
  screenWidth?: number
  screenHeight?: number
}): RecordedSession | null {
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT INTO recorded_session (
        id, userId, userAgent, deviceType, browser, os,
        screenWidth, screenHeight, startedAt, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.id,
      data.userId,
      data.userAgent || null,
      data.deviceType || null,
      data.browser || null,
      data.os || null,
      data.screenWidth || null,
      data.screenHeight || null,
      now,
      now,
      now
    )

    return getSessionById(data.id)
  } catch (error) {
    console.error("[Sessions] Failed to create session:", error)
    return null
  }
}

/**
 * Add events to a session
 */
export function addSessionEvents(sessionId: string, events: SessionEvent[]): boolean {
  try {
    const insertStmt = db.prepare(`
      INSERT INTO session_event (sessionId, type, data, timestamp)
      VALUES (?, ?, ?, ?)
    `)

    const insertMany = db.transaction((events: SessionEvent[]) => {
      for (const event of events) {
        insertStmt.run(
          sessionId,
          event.type,
          JSON.stringify(event.data),
          event.timestamp
        )
      }
    })

    insertMany(events)

    // Update session stats
    updateSessionStats(sessionId)

    return true
  } catch (error) {
    console.error("[Sessions] Failed to add events:", error)
    return false
  }
}

/**
 * Update session statistics based on events
 */
function updateSessionStats(sessionId: string) {
  const now = new Date().toISOString()

  // Count clicks (event type 3 is incremental snapshot, check for click in data)
  // For simplicity, we'll count mouse interactions
  const clickCount = db.prepare(`
    SELECT COUNT(*) as count FROM session_event
    WHERE sessionId = ? AND type = 3
    AND json_extract(data, '$.source') = 2
  `).get(sessionId) as { count: number }

  // Count console errors (custom events with error type)
  const errorCount = db.prepare(`
    SELECT COUNT(*) as count FROM session_event
    WHERE sessionId = ? AND type = 6
  `).get(sessionId) as { count: number }

  // Get first and last timestamp for duration
  const timestamps = db.prepare(`
    SELECT MIN(timestamp) as startTs, MAX(timestamp) as endTs
    FROM session_event WHERE sessionId = ?
  `).get(sessionId) as { startTs: number | null; endTs: number | null }

  const duration = timestamps.startTs && timestamps.endTs
    ? Math.floor((timestamps.endTs - timestamps.startTs) / 1000)
    : null

  db.prepare(`
    UPDATE recorded_session
    SET clickCount = ?, errorCount = ?, duration = ?, updatedAt = ?
    WHERE id = ?
  `).run(
    clickCount.count || 0,
    errorCount.count || 0,
    duration,
    now,
    sessionId
  )
}

/**
 * End a recording session
 */
export function endSession(sessionId: string, pagesVisited?: string[]): boolean {
  const now = new Date().toISOString()

  try {
    // Get final duration from events
    const timestamps = db.prepare(`
      SELECT MIN(timestamp) as startTs, MAX(timestamp) as endTs
      FROM session_event WHERE sessionId = ?
    `).get(sessionId) as { startTs: number | null; endTs: number | null }

    const duration = timestamps.startTs && timestamps.endTs
      ? Math.floor((timestamps.endTs - timestamps.startTs) / 1000)
      : 0

    db.prepare(`
      UPDATE recorded_session
      SET endedAt = ?, duration = ?, pageCount = ?, pagesVisited = ?, updatedAt = ?
      WHERE id = ?
    `).run(
      now,
      duration,
      pagesVisited?.length || 0,
      pagesVisited ? JSON.stringify(pagesVisited) : null,
      now,
      sessionId
    )

    return true
  } catch (error) {
    console.error("[Sessions] Failed to end session:", error)
    return false
  }
}

/**
 * Get a session by ID
 */
export function getSessionById(id: string): RecordedSession | null {
  const session = db.prepare(`
    SELECT
      rs.*,
      u.name as userName,
      u.email as userEmail,
      u.image as userImage
    FROM recorded_session rs
    LEFT JOIN user u ON rs.userId = u.id
    WHERE rs.id = ?
  `).get(id) as RecordedSession | undefined

  return session || null
}

/**
 * Get a session with all its events
 */
export function getSessionWithEvents(id: string): SessionWithEvents | null {
  const session = getSessionById(id)
  if (!session) return null

  const events = db.prepare(`
    SELECT type, data, timestamp
    FROM session_event
    WHERE sessionId = ?
    ORDER BY timestamp ASC
  `).all(id) as { type: number; data: string; timestamp: number }[]

  return {
    ...session,
    events: events.map((e) => ({
      type: e.type,
      data: JSON.parse(e.data),
      timestamp: e.timestamp,
    })),
  }
}

/**
 * Get all sessions with optional filtering
 */
export function getSessions(filter?: SessionFilter): {
  sessions: RecordedSession[]
  total: number
} {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filter?.userId) {
    conditions.push("rs.userId = ?")
    params.push(filter.userId)
  }

  if (filter?.startDate) {
    conditions.push("rs.startedAt >= ?")
    params.push(filter.startDate)
  }

  if (filter?.endDate) {
    conditions.push("rs.startedAt <= ?")
    params.push(filter.endDate)
  }

  if (filter?.search) {
    conditions.push("(u.name LIKE ? OR u.email LIKE ?)")
    params.push(`%${filter.search}%`, `%${filter.search}%`)
  }

  const whereClause = conditions.length > 0
    ? `WHERE ${conditions.join(" AND ")}`
    : ""

  // Get total count
  const countResult = db.prepare(`
    SELECT COUNT(*) as count
    FROM recorded_session rs
    LEFT JOIN user u ON rs.userId = u.id
    ${whereClause}
  `).get(...params) as { count: number }

  // Get paginated results
  const limit = filter?.limit || 50
  const offset = filter?.offset || 0

  const sessions = db.prepare(`
    SELECT
      rs.*,
      u.name as userName,
      u.email as userEmail,
      u.image as userImage
    FROM recorded_session rs
    LEFT JOIN user u ON rs.userId = u.id
    ${whereClause}
    ORDER BY rs.startedAt DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as RecordedSession[]

  return {
    sessions,
    total: countResult.count,
  }
}

/**
 * Get sessions grouped by user
 */
export function getSessionsByUser(): {
  userId: string
  userName: string
  userEmail: string
  userImage: string | null
  sessionCount: number
  totalDuration: number
  lastSessionAt: string
}[] {
  return db.prepare(`
    SELECT
      u.id as userId,
      u.name as userName,
      u.email as userEmail,
      u.image as userImage,
      COUNT(rs.id) as sessionCount,
      COALESCE(SUM(rs.duration), 0) as totalDuration,
      MAX(rs.startedAt) as lastSessionAt
    FROM user u
    LEFT JOIN recorded_session rs ON u.id = rs.userId
    WHERE rs.id IS NOT NULL
    GROUP BY u.id
    ORDER BY lastSessionAt DESC
  `).all() as {
    userId: string
    userName: string
    userEmail: string
    userImage: string | null
    sessionCount: number
    totalDuration: number
    lastSessionAt: string
  }[]
}

/**
 * Get session statistics
 */
export function getSessionStats(): SessionStats {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
  const weekStart = new Date(now.setDate(now.getDate() - 7)).toISOString()
  const monthStart = new Date(now.setMonth(now.getMonth() - 1)).toISOString()

  const stats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN startedAt >= ? THEN 1 ELSE 0 END) as today,
      SUM(CASE WHEN startedAt >= ? THEN 1 ELSE 0 END) as thisWeek,
      SUM(CASE WHEN startedAt >= ? THEN 1 ELSE 0 END) as thisMonth,
      COALESCE(SUM(duration), 0) as totalDuration,
      COALESCE(AVG(duration), 0) as avgDuration,
      COALESCE(SUM(clickCount), 0) as totalClicks,
      COALESCE(SUM(errorCount), 0) as totalErrors,
      COUNT(DISTINCT userId) as uniqueUsers
    FROM recorded_session
  `).get(todayStart, weekStart, monthStart) as SessionStats

  return stats
}

/**
 * Delete a session and its events
 */
export function deleteSession(id: string): boolean {
  try {
    db.prepare("DELETE FROM session_event WHERE sessionId = ?").run(id)
    db.prepare("DELETE FROM recorded_session WHERE id = ?").run(id)
    return true
  } catch (error) {
    console.error("[Sessions] Failed to delete session:", error)
    return false
  }
}

/**
 * Delete old sessions (cleanup)
 */
export function deleteOldSessions(daysOld: number = 30): number {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysOld)
  const cutoff = cutoffDate.toISOString()

  try {
    // Get session IDs to delete
    const sessionsToDelete = db.prepare(`
      SELECT id FROM recorded_session WHERE startedAt < ?
    `).all(cutoff) as { id: string }[]

    // Delete events first
    const deleteEvents = db.prepare("DELETE FROM session_event WHERE sessionId = ?")
    for (const session of sessionsToDelete) {
      deleteEvents.run(session.id)
    }

    // Delete sessions
    const result = db.prepare("DELETE FROM recorded_session WHERE startedAt < ?").run(cutoff)

    return result.changes
  } catch (error) {
    console.error("[Sessions] Failed to delete old sessions:", error)
    return 0
  }
}
