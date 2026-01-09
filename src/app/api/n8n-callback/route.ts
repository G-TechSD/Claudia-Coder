/**
 * N8N Callback API
 *
 * Receives progress updates and final results from N8N workflows.
 * Stores updates in memory for polling by the execution panel.
 *
 * POST /api/n8n-callback - Receive progress/completion/error updates
 * GET /api/n8n-callback?sessionId=xxx - Poll for updates (or use SSE)
 * DELETE /api/n8n-callback?sessionId=xxx - Clean up session data
 */

import { NextRequest, NextResponse } from "next/server"

// Types for N8N callback data
interface N8NCallbackData {
  iteration?: number
  score?: number
  filesChanged?: string[]
  output?: string
  error?: string
  // Additional fields for flexibility
  message?: string
  metadata?: Record<string, unknown>
}

interface N8NCallbackPayload {
  sessionId: string
  type: "progress" | "complete" | "error"
  data: N8NCallbackData
}

interface SessionUpdate {
  timestamp: string
  type: "progress" | "complete" | "error"
  data: N8NCallbackData
}

interface SessionState {
  sessionId: string
  createdAt: string
  updatedAt: string
  status: "running" | "complete" | "error"
  updates: SessionUpdate[]
  // Aggregate data
  currentIteration: number
  latestScore?: number
  filesChanged: string[]
  finalOutput?: string
  error?: string
}

// In-memory storage for session states
// In production, consider Redis or similar for multi-instance support
const sessionStore = new Map<string, SessionState>()

// Clean up old sessions after 1 hour
const SESSION_TTL_MS = 60 * 60 * 1000

// Periodic cleanup of stale sessions
function cleanupStaleSessions() {
  const now = Date.now()
  for (const [sessionId, state] of sessionStore.entries()) {
    const updatedAt = new Date(state.updatedAt).getTime()
    if (now - updatedAt > SESSION_TTL_MS) {
      sessionStore.delete(sessionId)
      console.log(`[n8n-callback] Cleaned up stale session: ${sessionId}`)
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupStaleSessions, 10 * 60 * 1000)

/**
 * POST /api/n8n-callback
 * Receive progress updates from N8N workflows
 */
export async function POST(request: NextRequest) {
  try {
    const payload: N8NCallbackPayload = await request.json()
    const { sessionId, type, data } = payload

    // Validate required fields
    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: "sessionId is required" },
        { status: 400 }
      )
    }

    if (!type || !["progress", "complete", "error"].includes(type)) {
      return NextResponse.json(
        { success: false, error: "type must be 'progress', 'complete', or 'error'" },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()

    // Get or create session state
    let session = sessionStore.get(sessionId)
    if (!session) {
      session = {
        sessionId,
        createdAt: now,
        updatedAt: now,
        status: "running",
        updates: [],
        currentIteration: 0,
        filesChanged: []
      }
      sessionStore.set(sessionId, session)
      console.log(`[n8n-callback] Created new session: ${sessionId}`)
    }

    // Add update to history
    const update: SessionUpdate = {
      timestamp: now,
      type,
      data
    }
    session.updates.push(update)
    session.updatedAt = now

    // Update aggregate state based on type
    switch (type) {
      case "progress":
        if (data.iteration !== undefined) {
          session.currentIteration = data.iteration
        }
        if (data.score !== undefined) {
          session.latestScore = data.score
        }
        if (data.filesChanged) {
          // Merge new files with existing (avoid duplicates)
          const existingFiles = new Set(session.filesChanged)
          data.filesChanged.forEach(f => existingFiles.add(f))
          session.filesChanged = Array.from(existingFiles)
        }
        break

      case "complete":
        session.status = "complete"
        if (data.output) {
          session.finalOutput = data.output
        }
        if (data.filesChanged) {
          session.filesChanged = data.filesChanged
        }
        if (data.score !== undefined) {
          session.latestScore = data.score
        }
        console.log(`[n8n-callback] Session completed: ${sessionId}`)
        break

      case "error":
        session.status = "error"
        session.error = data.error || data.message || "Unknown error"
        console.log(`[n8n-callback] Session error: ${sessionId} - ${session.error}`)
        break
    }

    return NextResponse.json({
      success: true,
      sessionId,
      status: session.status,
      updateCount: session.updates.length
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error("[n8n-callback] POST error:", message)

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/n8n-callback?sessionId=xxx
 * Poll for session updates
 *
 * Query params:
 *   - sessionId: (required) The session to get updates for
 *   - since: (optional) Only return updates after this index
 *   - sse: (optional) If "true", return Server-Sent Events stream
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get("sessionId")
  const sinceParam = searchParams.get("since")
  const useSSE = searchParams.get("sse") === "true"

  // If no sessionId, return list of active sessions (for debugging)
  if (!sessionId) {
    const sessions = Array.from(sessionStore.values()).map(s => ({
      sessionId: s.sessionId,
      status: s.status,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      updateCount: s.updates.length,
      currentIteration: s.currentIteration
    }))

    return NextResponse.json({
      success: true,
      activeSessions: sessions.length,
      sessions
    })
  }

  const session = sessionStore.get(sessionId)

  if (!session) {
    return NextResponse.json(
      { success: false, error: "Session not found", sessionId },
      { status: 404 }
    )
  }

  // SSE mode - stream updates
  if (useSSE) {
    return createSSEResponse(session)
  }

  // Polling mode - return current state
  const since = sinceParam ? parseInt(sinceParam, 10) : 0
  const newUpdates = session.updates.slice(since)

  return NextResponse.json({
    success: true,
    sessionId: session.sessionId,
    status: session.status,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    currentIteration: session.currentIteration,
    latestScore: session.latestScore,
    filesChanged: session.filesChanged,
    finalOutput: session.finalOutput,
    error: session.error,
    // For incremental updates
    updateCount: session.updates.length,
    newUpdates,
    // For next poll
    nextSince: session.updates.length
  })
}

/**
 * DELETE /api/n8n-callback?sessionId=xxx
 * Clean up a session
 */
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get("sessionId")

  if (!sessionId) {
    return NextResponse.json(
      { success: false, error: "sessionId is required" },
      { status: 400 }
    )
  }

  const existed = sessionStore.has(sessionId)
  sessionStore.delete(sessionId)

  return NextResponse.json({
    success: true,
    sessionId,
    deleted: existed
  })
}

/**
 * Create SSE response for real-time updates
 */
function createSSEResponse(session: SessionState): Response {
  const encoder = new TextEncoder()
  let isActive = true
  let lastSentIndex = 0

  const stream = new ReadableStream({
    start(controller) {
      // Send initial state
      const initialData = {
        type: "init",
        sessionId: session.sessionId,
        status: session.status,
        currentIteration: session.currentIteration,
        latestScore: session.latestScore,
        filesChanged: session.filesChanged,
        updateCount: session.updates.length
      }
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialData)}\n\n`))
      lastSentIndex = session.updates.length

      // Poll for new updates
      const interval = setInterval(() => {
        if (!isActive) {
          clearInterval(interval)
          return
        }

        const currentSession = sessionStore.get(session.sessionId)
        if (!currentSession) {
          // Session was deleted
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "deleted" })}\n\n`))
          controller.close()
          clearInterval(interval)
          return
        }

        // Send new updates
        if (currentSession.updates.length > lastSentIndex) {
          const newUpdates = currentSession.updates.slice(lastSentIndex)
          for (const update of newUpdates) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              ...update,
              type: "update",
              currentIteration: currentSession.currentIteration,
              latestScore: currentSession.latestScore,
              status: currentSession.status
            })}\n\n`))
          }
          lastSentIndex = currentSession.updates.length
        }

        // Close stream if session is complete or errored
        if (currentSession.status === "complete" || currentSession.status === "error") {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "final",
            status: currentSession.status,
            finalOutput: currentSession.finalOutput,
            error: currentSession.error,
            filesChanged: currentSession.filesChanged,
            latestScore: currentSession.latestScore
          })}\n\n`))
          controller.close()
          clearInterval(interval)
        }
      }, 500) // Check every 500ms

      // Cleanup on close
      return () => {
        isActive = false
        clearInterval(interval)
      }
    },
    cancel() {
      isActive = false
    }
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive"
    }
  })
}
